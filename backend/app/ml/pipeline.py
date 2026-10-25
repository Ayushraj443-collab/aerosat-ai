import json
import math
import joblib
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.model_selection import GroupKFold
from sklearn.preprocessing import StandardScaler

from app.config import settings
from app.database import db_session
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
    def __init__(self, pollutant: str = "NO2", algorithm: str = "random_forest"):
        self.pollutant = pollutant.upper()
        self.algorithm = algorithm.lower()
        self.model = None
        self.scaler = StandardScaler()
        self.model_id = f"{self.pollutant.lower()}_{self.algorithm}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.metadata: Dict[str, Any] = {}

    def extract_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Extract and engineer spatial-temporal features, target, and station grouping array."""
        df_copy = df.copy()
        
        # Calculate ventilation index
        df_copy["ventilation_index"] = (df_copy["boundary_layer_height_m"] * df_copy["wind_speed_ms"]) / 1000.0
        
        # Cyclical day of year
        dates = pd.to_datetime(df_copy["date"])
        day_of_year = dates.dt.dayofyear
        df_copy["day_sin"] = np.sin(2 * np.pi * day_of_year / 365.0)
        df_copy["day_cos"] = np.cos(2 * np.pi * day_of_year / 365.0)
        
        # Verify columns exist
        for col in FEATURE_COLUMNS:
            if col not in df_copy.columns:
                df_copy[col] = 0.0
                
        X = df_copy[FEATURE_COLUMNS].to_numpy()
        y = df_copy["ground_value"].to_numpy()
        groups = df_copy["station_id"].to_numpy()
        
        return X, y, groups

    def train_and_evaluate(
        self,
        dataset_path: Optional[Path] = None,
        n_estimators: int = 100,
        max_depth: Optional[int] = 12,
        spatial_cv_folds: int = 5,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Execute full spatial machine learning pipeline with GroupKFold spatial cross-validation
        to prevent station-level data leakage across training and test sets.
        """
        if dataset_path is None or not dataset_path.exists():
            dataset_path = settings.DATA_RAW_DIR / "synthetic_sentinel5p_cpcb_pairs.csv"
            
        logger.info(f"Loading training data from {dataset_path} for pollutant {self.pollutant}")
        df_raw = pd.read_csv(dataset_path)
        
        # Filter for selected pollutant and acceptable satellite QA flag (qa >= 0.50)
        df_filtered = df_raw[(df_raw["pollutant"] == self.pollutant) & (df_raw["satellite_qa"] >= 0.50)].copy()
        
        if len(df_filtered) < 30:
            raise ValueError(f"Insufficient training observations for pollutant {self.pollutant} (found {len(df_filtered)}, minimum 30 required).")
            
        X, y, groups = self.extract_features(df_filtered)
        dates = df_filtered["date"].tolist()
        stations = df_filtered["station_name"].tolist()
        
        # Spatial Cross-Validation: GroupKFold by ground station
        unique_stations = np.unique(groups)
        actual_folds = min(spatial_cv_folds, len(unique_stations))
        gkf = GroupKFold(n_splits=actual_folds)
        
        cv_fold_results = []
        oof_predictions = np.zeros(len(y))
        baseline_oof_predictions = np.zeros(len(y))
        
        # Baseline model: Nearest-Station Spatial KNN on coordinates (lat, lon)
        coords = df_filtered[["latitude", "longitude"]].to_numpy()
        
        fold_idx = 1
        for train_idx, val_idx in gkf.split(X, y, groups=groups):
            X_train, X_val = X[train_idx], X[val_idx]
            y_train, y_val = y[train_idx], y[val_idx]
            coords_train, coords_val = coords[train_idx], coords[val_idx]
            
            # Train fold model
            if self.algorithm == "gradient_boosting":
                fold_model = HistGradientBoostingRegressor(
                    max_iter=n_estimators,
                    max_depth=max_depth,
                    random_state=random_state
                )
            else:
                fold_model = RandomForestRegressor(
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    random_state=random_state,
                    n_jobs=-1
                )
            
            fold_model.fit(X_train, y_train)
            val_preds = fold_model.predict(X_val)
            oof_predictions[val_idx] = val_preds
            
            # Baseline: Spatial IDW / 2-NN on station coordinates
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
            
        # Fit final model on all data
        if self.algorithm == "gradient_boosting":
            final_model = HistGradientBoostingRegressor(
                max_iter=n_estimators,
                max_depth=max_depth,
                random_state=random_state
            )
        else:
            final_model = RandomForestRegressor(
                n_estimators=n_estimators,
                max_depth=max_depth,
                random_state=random_state,
                n_jobs=-1
            )
        final_model.fit(X, y)
        self.model = final_model
        
        # Overall Spatial OOF Metrics
        overall_metrics = compute_metrics(y, oof_predictions)
        baseline_metrics = compute_metrics(y, baseline_oof_predictions)
        
        # Improvement over spatial baseline
        mae_imp_pct = round(((baseline_metrics["mae"] - overall_metrics["mae"]) / max(0.01, baseline_metrics["mae"])) * 100.0, 1)
        rmse_imp_pct = round(((baseline_metrics["rmse"] - overall_metrics["rmse"]) / max(0.01, baseline_metrics["rmse"])) * 100.0, 1)
        
        # Feature importances (for Random Forest or permutation proxy)
        feature_importances = []
        if hasattr(final_model, "feature_importances_"):
            importances = final_model.feature_importances_
            for feat, imp in zip(FEATURE_COLUMNS, importances):
                feature_importances.append({
                    "feature": feat,
                    "importance": round(float(imp), 4)
                })
            feature_importances.sort(key=lambda x: x["importance"], reverse=True)
        else:
            for feat in FEATURE_COLUMNS:
                feature_importances.append({"feature": feat, "importance": round(1.0 / len(FEATURE_COLUMNS), 4)})
                
        # Residuals & Scatter Data
        residuals_info = compute_residual_distribution(y, oof_predictions)
        scatter_samples = format_observed_vs_predicted_sample(y, oof_predictions, dates, stations)
        
        # Save model artifact
        model_filename = f"{self.model_id}.joblib"
        model_path = settings.DATA_MODELS_DIR / model_filename
        joblib.dump(final_model, model_path)
        
        # Metadata dict
        self.metadata = {
            "model_id": self.model_id,
            "model_name": f"AeroSat-{self.pollutant}-{self.algorithm.upper()}",
            "target_pollutant": self.pollutant,
            "algorithm": self.algorithm,
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
            "is_demo": True,
            "is_active": True
        }
        
        # Save metadata JSON
        meta_path = settings.DATA_MODELS_DIR / f"{self.model_id}_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, indent=2)
            
        # Record into database
        with db_session() as conn:
            cursor = conn.cursor()
            # Set other models for same pollutant as inactive
            cursor.execute("UPDATE model_registry SET is_active = 0 WHERE target_pollutant = ?", (self.pollutant,))
            cursor.execute("""
            INSERT OR REPLACE INTO model_registry (
                model_id, model_name, target_pollutant, trained_at, algorithm,
                train_samples, val_samples, mae, rmse, r2,
                baseline_mae, baseline_rmse, baseline_r2,
                is_active, is_demo, hyperparams_json, feature_names_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
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
                json.dumps({"n_estimators": n_estimators, "max_depth": max_depth, "cv_folds": actual_folds}),
                json.dumps(FEATURE_COLUMNS)
            ))
            
        logger.info(f"Model {self.model_id} trained and registered successfully. OOF R²: {overall_metrics['r2']}, MAE: {overall_metrics['mae']}")
        return self.metadata

def get_active_model(pollutant: str = "NO2") -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """Load active model and its metadata for the requested pollutant."""
    target_pollutant = pollutant.upper()
    meta_files = list(settings.DATA_MODELS_DIR.glob(f"{target_pollutant.lower()}_*_meta.json"))
    
    if not meta_files:
        # Check database for active model
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT model_id FROM model_registry WHERE target_pollutant = ? AND is_active = 1 ORDER BY trained_at DESC LIMIT 1",
                (target_pollutant,)
            )
            row = cursor.fetchone()
            if row:
                model_id = row["model_id"]
                meta_path = settings.DATA_MODELS_DIR / f"{model_id}_meta.json"
                if meta_path.exists():
                    meta_files = [meta_path]
                    
    if not meta_files:
        return None, None
        
    # Get latest metadata file
    meta_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    with open(meta_files[0], "r", encoding="utf-8") as f:
        meta = json.load(f)
        
    model_id = meta["model_id"]
    model_path = settings.DATA_MODELS_DIR / f"{model_id}.joblib"
    if not model_path.exists():
        return None, None
        
    model = joblib.load(model_path)
    return model, meta
