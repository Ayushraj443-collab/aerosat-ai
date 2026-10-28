import json
import math
import joblib
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import BayesianRidge, Ridge, ElasticNet
from sklearn.neighbors import KNeighborsRegressor
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

from app.config import settings
from app.database import db_session, get_observations_from_db, count_observations
from app.ml.evaluator import compute_metrics, compute_residual_distribution, format_observed_vs_predicted_sample

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "satellite_column",
    "latitude",
    "longitude",
    "temperature_c",
    "relative_humidity_pct",
    "wind_speed_ms",
    "wind_direction_deg",
    "boundary_layer_height_m",
    "ventilation_index",
    "elevation_m",
    "road_density_proxy",
    "day_sin",
    "day_cos"
]

class SpatialMLPipeline:
    def __init__(self, pollutant: str = "NO2", algorithm: str = "bayesian_ridge", data_mode: str = "DEMO"):
        self.pollutant = pollutant.upper()
        self.algorithm = algorithm.lower()
        self.data_mode = data_mode.upper()
        self.model = None
        self.scaler = StandardScaler()
        suffix = "real" if self.data_mode == "REAL" else "demo"
        self.model_id = f"{self.pollutant.lower()}_{self.algorithm}_{suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.metadata: Dict[str, Any] = {}

    def extract_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Extract spatial-temporal features, target, and station grouping array.
        Preserves natural missingness without coercing unobserved weather covariates to 0.0.
        """
        df_copy = df.copy()
        
        # Calculate ventilation index
        if "boundary_layer_height_m" not in df_copy.columns:
            df_copy["boundary_layer_height_m"] = 500.0
        if "wind_speed_ms" not in df_copy.columns:
            df_copy["wind_speed_ms"] = 2.0
            
        blh_num = pd.to_numeric(df_copy["boundary_layer_height_m"], errors="coerce")
        wind_num = pd.to_numeric(df_copy["wind_speed_ms"], errors="coerce")
        df_copy["ventilation_index"] = (blh_num * wind_num) / 1000.0
        
        # Cyclical day of year
        date_col = "observation_time" if "observation_time" in df_copy.columns and df_copy["observation_time"].notna().any() else "date"
        dates = pd.to_datetime(df_copy[date_col], errors="coerce").fillna(pd.Timestamp("2024-01-01"))
        day_of_year = dates.dt.dayofyear
        df_copy["day_sin"] = np.sin(2 * np.pi * day_of_year / 365.0)
        df_copy["day_cos"] = np.cos(2 * np.pi * day_of_year / 365.0)
        
        # Ensure all required feature columns exist and have numeric types without coercive fillna(0)
        for col in FEATURE_COLUMNS:
            if col not in df_copy.columns:
                df_copy[col] = np.nan
            else:
                df_copy[col] = pd.to_numeric(df_copy[col], errors="coerce")
                
        X = df_copy[FEATURE_COLUMNS].to_numpy(dtype=float)
        y = pd.to_numeric(df_copy["ground_value"], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        stn_col = "station_id" if "station_id" in df_copy.columns else "station_name"
        groups = df_copy[stn_col].fillna("STN_UNKNOWN").to_numpy()
        
        return X, y, groups

    def train_and_evaluate(
        self,
        dataset_path: Optional[Path] = None,
        n_estimators: int = 100,
        max_depth: Optional[int] = 12,
        spatial_cv_folds: int = 5,
        random_state: int = 42,
        data_mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute spatial machine learning pipeline with GroupKFold spatial cross-validation.
        Supports both REAL and DEMO datasets with strict provenance isolation.
        """
        if data_mode:
            self.data_mode = data_mode.upper()
            suffix = "real" if self.data_mode == "REAL" else "demo"
            self.model_id = f"{self.pollutant.lower()}_{self.algorithm}_{suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        if self.data_mode == "REAL":
            logger.info(f"Loading REAL observations from SQLite for {self.pollutant}")
            records = get_observations_from_db(data_mode="REAL", pollutant=self.pollutant, matched_only=True, limit=5000)
            if not records and self.pollutant == "NO2" and count_observations("REAL", matched_only=True) == 0:
                # Attempt populating verified observations from genuine S5P granules
                from app.data.paired_observation_builder import GenuinePairedObservationBuilder
                GenuinePairedObservationBuilder.ingest_genuine_pairs_into_database()
                records = get_observations_from_db(data_mode="REAL", pollutant=self.pollutant, matched_only=True, limit=5000)
                
            df_filtered = pd.DataFrame(records)
            # Strictly filter for genuine paired observations with valid satellite column and QA
            if not df_filtered.empty and "satellite_column" in df_filtered.columns:
                df_filtered = df_filtered[
                    df_filtered["satellite_column"].notna() & 
                    (pd.to_numeric(df_filtered["satellite_column"], errors="coerce") > 0) &
                    (pd.to_numeric(df_filtered.get("satellite_qa", 1.0), errors="coerce") >= 0.50)
                ].copy()

            if len(df_filtered) < 5:
                raise ValueError(
                    f"Insufficient verified real paired observations for pollutant {self.pollutant} "
                    f"(found {len(df_filtered)}, minimum 5 required for spatial cross-validation). "
                    "Please ingest genuine Sentinel-5P Level-2 granules."
                )
            training_source = "ESA Copernicus Sentinel-5P (TROPOMI Level-2 OFFL) & CPCB CAAQMS Ground Monitors"
            is_demo_flag = False
        else:
            if dataset_path is None or not dataset_path.exists():
                dataset_path = settings.DATA_RAW_DIR / "synthetic_sentinel5p_cpcb_pairs.csv"
            logger.info(f"Loading DEMO observations from {dataset_path} for {self.pollutant}")
            df_raw = pd.read_csv(dataset_path)
            df_filtered = df_raw[(df_raw["pollutant"] == self.pollutant) & (df_raw["satellite_qa"] >= 0.50)].copy()
            if len(df_filtered) < 30:
                raise ValueError(f"Insufficient training observations for pollutant {self.pollutant} (found {len(df_filtered)}, minimum 30 required).")
            training_source = "AeroSat-AI Synthetic Demonstration Generator"
            is_demo_flag = True

        X, y, groups = self.extract_features(df_filtered)
        date_col = "observation_time" if "observation_time" in df_filtered.columns else "date"
        dates = df_filtered[date_col].astype(str).tolist()
        stn_col = "station_name" if "station_name" in df_filtered.columns else "station_id"
        stations = df_filtered[stn_col].astype(str).tolist()
        
        # Spatial Cross-Validation: GroupKFold by ground station
        unique_stations = np.unique(groups)
        actual_folds = min(spatial_cv_folds, len(unique_stations))
        if actual_folds < 2:
            actual_folds = 2
            
        gkf = GroupKFold(n_splits=actual_folds)
        cv_fold_results = []
        oof_predictions = np.zeros(len(y))
        baseline_oof_predictions = np.zeros(len(y))
        
        coords = df_filtered[["latitude", "longitude"]].to_numpy()
        
        # Detect feature columns with non-zero variance ignoring NaNs
        feature_vars = np.nanvar(X, axis=0)
        active_feature_indices = [i for i, v in enumerate(feature_vars) if not np.isnan(v) and v > 1e-7]
        if not active_feature_indices:
            active_feature_indices = list(range(X.shape[1]))

        # In small-sample regimes (N < 20), coordinate features cause spatial overfitting (p > N_train).
        # We select physical invariant features: spaceborne column density and surface road density proxy.
        if len(y) < 20:
            phys_candidates = ["satellite_column", "road_density_proxy"]
            selected_indices = [FEATURE_COLUMNS.index(f) for f in phys_candidates if FEATURE_COLUMNS.index(f) in active_feature_indices]
            if not selected_indices:
                selected_indices = active_feature_indices
        else:
            selected_indices = active_feature_indices

        def create_regressor(alg: str):
            alg_clean = alg.lower().strip()
            if alg_clean == "bayesian_ridge":
                return BayesianRidge()
            elif alg_clean == "ridge":
                return Ridge(alpha=2.0)
            elif alg_clean == "elastic_net":
                return ElasticNet(alpha=0.5, l1_ratio=0.5)
            elif alg_clean == "gradient_boosting":
                return HistGradientBoostingRegressor(
                    max_iter=min(100, n_estimators),
                    max_depth=min(4, max_depth or 4),
                    random_state=random_state
                )
            else:  # random_forest
                if len(y) < 20:
                    return RandomForestRegressor(
                        n_estimators=min(50, n_estimators),
                        max_depth=min(3, max_depth or 3),
                        min_samples_leaf=2,
                        max_features=1.0,
                        random_state=random_state
                    )
                else:
                    return RandomForestRegressor(
                        n_estimators=n_estimators,
                        max_depth=max_depth,
                        random_state=random_state,
                        n_jobs=-1
                    )

        def create_pipeline(alg: str, cols: List[int]):
            num_pipe = Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler())
            ])
            col_trans = ColumnTransformer(
                transformers=[("num", num_pipe, cols)],
                remainder="drop"
            )
            return Pipeline([
                ("prep", col_trans),
                ("reg", create_regressor(alg))
            ])

        fold_idx = 1
        for train_idx, val_idx in gkf.split(X, y, groups=groups):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            coords_train, coords_val = coords[train_idx], coords[val_idx]
            
            fold_model = create_pipeline(self.algorithm, selected_indices)
            fold_model.fit(X_train, y_train)
            val_preds = fold_model.predict(X_val)
            oof_predictions[val_idx] = val_preds
            
            # Baseline: Spatial 2-NN on station coordinates (IDW)
            baseline_knn = KNeighborsRegressor(n_neighbors=min(2, len(coords_train)), weights="distance")
            baseline_knn.fit(coords_train, y_train)
            baseline_preds = baseline_knn.predict(coords_val)
            baseline_oof_predictions[val_idx] = baseline_preds
            
            fold_metrics = compute_metrics(y_val, val_preds)
            held_out = list(np.unique(groups[val_idx]))
            
            cv_fold_results.append({
                "fold": fold_idx,
                "held_out_stations": held_out,
                "train_count": int(len(train_idx)),
                "val_count": int(len(val_idx)),
                "mae": fold_metrics["mae"],
                "rmse": fold_metrics["rmse"],
                "r2": fold_metrics["r2"]
            })
            fold_idx += 1
            
        # Fit final pipeline model on all data
        final_model = create_pipeline(self.algorithm, selected_indices)
        final_model.fit(X, y)
        self.model = final_model
        
        # Overall Spatial OOF Metrics
        overall_metrics = compute_metrics(y, oof_predictions)
        baseline_metrics = compute_metrics(y, baseline_oof_predictions)
        
        mae_imp_pct = round(((baseline_metrics["mae"] - overall_metrics["mae"]) / max(0.01, baseline_metrics["mae"])) * 100.0, 1)
        rmse_imp_pct = round(((baseline_metrics["rmse"] - overall_metrics["rmse"]) / max(0.01, baseline_metrics["rmse"])) * 100.0, 1)
        
        # Calculate feature importances
        inner_reg = final_model.named_steps["reg"]
        feature_importances = []
        if hasattr(inner_reg, "feature_importances_"):
            raw_imps = inner_reg.feature_importances_
            tot = float(np.sum(raw_imps)) or 1.0
            norm_imps = raw_imps / tot
            for f_idx, feat in enumerate(FEATURE_COLUMNS):
                if f_idx in selected_indices:
                    imp_val = norm_imps[selected_indices.index(f_idx)]
                else:
                    imp_val = 0.0
                feature_importances.append({"feature": feat, "importance": round(float(imp_val), 4)})
        elif hasattr(inner_reg, "coef_"):
            raw_coefs = np.abs(inner_reg.coef_)
            tot = float(np.sum(raw_coefs)) or 1.0
            norm_coefs = raw_coefs / tot
            for f_idx, feat in enumerate(FEATURE_COLUMNS):
                if f_idx in selected_indices:
                    imp_val = norm_coefs[selected_indices.index(f_idx)]
                else:
                    imp_val = 0.0
                feature_importances.append({"feature": feat, "importance": round(float(imp_val), 4)})
        else:
            for feat in FEATURE_COLUMNS:
                feature_importances.append({"feature": feat, "importance": round(1.0 / len(FEATURE_COLUMNS), 4)})
        feature_importances.sort(key=lambda x: x["importance"], reverse=True)
                
        residuals_info = compute_residual_distribution(y, oof_predictions)
        scatter_samples = format_observed_vs_predicted_sample(y, oof_predictions, dates, stations)
        
        # Deterministic dataset fingerprint and provenance metadata
        rec_summary = [{"stn": str(g), "val": float(v), "sat": float(s)} for g, v, s in zip(groups, y, X[:, 0])]
        dataset_fingerprint = hashlib.sha256(json.dumps(rec_summary, sort_keys=True).encode()).hexdigest()[:12]
        dataset_ver = "S5P_L2_TROPOMI_CPCB_PAIRED_V2" if not is_demo_flag else "AEROSAT_DEMO_SYNTHETIC_V1"
        val_method_str = f"GroupKFold Spatial Cross-Validation by Ground Station ({actual_folds} Folds, Zero Spatial Leakage)"
        is_preliminary_flag = bool(len(y) < 30 and not is_demo_flag)
        data_limitation_msg = (
            f"Preliminary Spatial Evaluation: Ground truth is evaluated across {len(np.unique(groups))} verified CPCB monitoring stations "
            f"(N={len(y)} collocations) during Sentinel-5P TROPOMI overpass. Spatial GroupKFold validation strictly isolates held-out stations."
            if is_preliminary_flag else None
        )

        # Save model artifact
        model_filename = f"{self.model_id}.joblib"
        model_path = settings.DATA_MODELS_DIR / model_filename
        joblib.dump(final_model, model_path)
        
        # Metadata dict
        self.metadata = {
            "model_id": self.model_id,
            "model_name": f"AeroSat-{self.pollutant}-{self.algorithm.upper()}-{'REAL' if not is_demo_flag else 'DEMO'}",
            "target_pollutant": self.pollutant,
            "algorithm": self.algorithm,
            "data_mode": self.data_mode,
            "training_source": training_source,
            "dataset_version": dataset_ver,
            "dataset_fingerprint": dataset_fingerprint,
            "validation_method": val_method_str,
            "is_preliminary": is_preliminary_flag,
            "data_limitation_notice": data_limitation_msg,
            "trained_at": datetime.now().isoformat(),
            "train_samples": int(len(y) * (actual_folds - 1) / actual_folds),
            "val_samples": int(len(y)),
            "mae": overall_metrics["mae"],
            "rmse": overall_metrics["rmse"],
            "r2": overall_metrics["r2"],
            "mean_bias_error": overall_metrics["mbe"],
            "normalized_rmse_pct": overall_metrics["nrmse_pct"],
            "baseline_comparison": {
                "baseline_type": "Nearest Station Inverse-Distance Weighting (IDW)",
                "baseline_mae": baseline_metrics["mae"],
                "baseline_rmse": baseline_metrics["rmse"],
                "baseline_r2": baseline_metrics["r2"],
                "ml_improvement_mae_pct": mae_imp_pct,
                "ml_improvement_rmse_pct": rmse_imp_pct
            },
            "spatial_validation_folds": cv_fold_results,
            "feature_importances": feature_importances,
            "observed_vs_predicted": scatter_samples,
            "residual_distribution": residuals_info,
            "is_demo": is_demo_flag,
            "is_active": True
        }
        
        # Save metadata JSON
        meta_path = settings.DATA_MODELS_DIR / f"{self.model_id}_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2)
            
        # Record into database
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE model_registry SET is_active = 0 WHERE target_pollutant = ? AND data_mode = ?",
                (self.pollutant, self.data_mode)
            )
            cursor.execute("""
            INSERT OR REPLACE INTO model_registry (
                model_id, model_name, target_pollutant, trained_at, algorithm,
                train_samples, val_samples, mae, rmse, r2,
                baseline_mae, baseline_rmse, baseline_r2,
                is_active, is_demo, data_mode, hyperparams_json, feature_names_json,
                dataset_version, dataset_fingerprint, validation_method, is_preliminary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                self.model_id,
                self.metadata["model_name"],
                self.pollutant,
                self.metadata["trained_at"],
                self.algorithm,
                self.metadata["train_samples"],
                self.metadata["val_samples"],
                self.metadata["mae"],
                self.metadata["rmse"],
                self.metadata["r2"],
                baseline_metrics["mae"],
                baseline_metrics["rmse"],
                baseline_metrics["r2"],
                1 if is_demo_flag else 0,
                self.data_mode,
                json.dumps({"n_estimators": n_estimators, "max_depth": max_depth, "cv_folds": actual_folds, "algorithm": self.algorithm}),
                json.dumps([FEATURE_COLUMNS[i] for i in selected_indices]),
                dataset_ver,
                dataset_fingerprint,
                val_method_str,
                1 if is_preliminary_flag else 0
            ))
            
        logger.info(
            f"Model {self.model_id} ({self.data_mode}) trained successfully. "
            f"OOF R²: {overall_metrics['r2']}, MAE: {overall_metrics['mae']}"
        )
        return self.metadata

def get_active_model(pollutant: str = "NO2", data_mode: str = "DEMO") -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """Load active model and its metadata for the requested pollutant and data mode."""
    target_pollutant = pollutant.upper()
    mode = data_mode.upper()
    
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT model_id FROM model_registry WHERE target_pollutant = ? AND data_mode = ? AND is_active = 1 ORDER BY trained_at DESC LIMIT 1",
            (target_pollutant, mode)
        )
        row = cursor.fetchone()
        if row:
            model_id = row["model_id"]
            meta_path = settings.DATA_MODELS_DIR / f"{model_id}_meta.json"
            model_path = settings.DATA_MODELS_DIR / f"{model_id}.joblib"
            if meta_path.exists() and model_path.exists():
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                model = joblib.load(model_path)
                return model, meta
                
    # Filesystem fallback matching mode
    meta_pattern = f"{target_pollutant.lower()}_*_{mode.lower()}_*_meta.json"
    meta_files = list(settings.DATA_MODELS_DIR.glob(meta_pattern))
    if not meta_files and mode == "DEMO":
        meta_files = list(settings.DATA_MODELS_DIR.glob(f"{target_pollutant.lower()}_*_meta.json"))
        # Exclude real models if searching for demo
        meta_files = [p for p in meta_files if "_real_" not in p.name]

    if not meta_files:
        return None, None
        
    meta_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    with open(meta_files[0], "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    model_id = meta["model_id"]
    model_path = settings.DATA_MODELS_DIR / f"{model_id}.joblib"
    if not model_path.exists():
        return None, None
        
    model = joblib.load(model_path)
    return model, meta
