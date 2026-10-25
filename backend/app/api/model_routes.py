import json
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional

from app.config import settings
from app.database import db_session
from app.models.schemas import ModelTrainRequest, ModelMetricsResponse
from app.ml.pipeline import SpatialMLPipeline, get_active_model

router = APIRouter(prefix="/model", tags=["Model Management & Evaluation"])

@router.post("/train", response_model=ModelMetricsResponse)
def train_model(req: ModelTrainRequest):
    """
    Trigger reproducible spatial machine learning pipeline for a target pollutant.
    Applies GroupKFold spatial cross-validation grouped by ground station to prevent spatial data leakage.
    Calculates MAE, RMSE, R², compares against spatial IDW baseline, and stores model artifacts.
    Supports data_mode='REAL' (verified observations) or 'DEMO'.
    """
    p = req.pollutant.upper()
    if p not in settings.SUPPORTED_POLLUTANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported pollutant '{req.pollutant}'. Must be one of {list(settings.SUPPORTED_POLLUTANTS.keys())}"
        )
        
    mode = req.data_mode.upper() if hasattr(req, "data_mode") and req.data_mode else "DEMO"
    pipeline = SpatialMLPipeline(pollutant=p, algorithm=req.algorithm, data_mode=mode)
    try:
        metrics = pipeline.train_and_evaluate(
            n_estimators=req.n_estimators,
            max_depth=req.max_depth,
            spatial_cv_folds=req.spatial_cv_folds,
            random_state=req.random_state,
            data_mode=mode
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
        
    return metrics

@router.get("/status")
def get_model_status(mode: Optional[str] = Query(None, description="'real' or 'demo'")):
    """Retrieve operational status and active model versions for all supported pollutants, optionally filtered by mode."""
    with db_session() as conn:
        cursor = conn.cursor()
        if mode:
            cursor.execute("SELECT * FROM model_registry WHERE UPPER(data_mode) = ? ORDER BY trained_at DESC", (mode.upper(),))
        else:
            cursor.execute("SELECT * FROM model_registry ORDER BY trained_at DESC")
        rows = cursor.fetchall()
        
    target_mode = mode.upper() if mode else None
    models_by_pollutant = {}
    for pol in settings.SUPPORTED_POLLUTANTS:
        if target_mode:
            active_row = next((r for r in rows if r["target_pollutant"] == pol and r["is_active"] == 1 and r["data_mode"] == target_mode), None)
        else:
            active_row = next((r for r in rows if r["target_pollutant"] == pol and r["is_active"] == 1), None)
            
        if active_row:
            models_by_pollutant[pol] = {
                "has_model": True,
                "model_id": active_row["model_id"],
                "model_name": active_row["model_name"],
                "algorithm": active_row["algorithm"],
                "data_mode": active_row["data_mode"] if "data_mode" in active_row.keys() else "DEMO",
                "trained_at": active_row["trained_at"],
                "train_samples": active_row["train_samples"],
                "val_samples": active_row["val_samples"],
                "mae": active_row["mae"],
                "rmse": active_row["rmse"],
                "r2": active_row["r2"],
                "is_demo": bool(active_row["is_demo"])
            }
        else:
            models_by_pollutant[pol] = {
                "has_model": False,
                "message": f"No active model trained for {pol} ({target_mode or 'any mode'}) yet."
            }
            
    return {
        "supported_pollutants": list(settings.SUPPORTED_POLLUTANTS.keys()),
        "status_by_pollutant": models_by_pollutant,
        "total_registered_models": len(rows),
        "queried_mode": target_mode or "ALL"
    }

@router.get("/metrics", response_model=ModelMetricsResponse)
def get_model_metrics(
    pollutant: str = Query("NO2", description="Pollutant: NO2, PM2.5, SO2, CO, O3"),
    mode: str = Query("demo", description="Data mode: 'real' or 'demo'")
):
    """
    Retrieve comprehensive evaluation metrics, spatial cross-validation fold results,
    baseline comparisons, feature importances, and residual distributions for the active model.
    Strictly isolates REAL and DEMO models.
    """
    p = pollutant.upper()
    data_mode = mode.upper()
    if p not in settings.SUPPORTED_POLLUTANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported pollutant '{pollutant}'. Must be one of {list(settings.SUPPORTED_POLLUTANTS.keys())}"
        )
        
    model, meta = get_active_model(p, data_mode=data_mode)
    if meta is None:
        if data_mode == "REAL":
            # Check if we can train on existing real observations
            pipeline = SpatialMLPipeline(pollutant=p, algorithm="random_forest", data_mode="REAL")
            try:
                meta = pipeline.train_and_evaluate(n_estimators=50, max_depth=10, spatial_cv_folds=5, data_mode="REAL")
            except ValueError as ve:
                raise HTTPException(
                    status_code=404,
                    detail=f"NO_VERIFIED_REAL_MODEL: No trained model available for {p} on REAL data. {str(ve)}"
                )
        else:
            # Auto-train initial demo model
            pipeline = SpatialMLPipeline(pollutant=p, algorithm="random_forest", data_mode="DEMO")
            meta = pipeline.train_and_evaluate(n_estimators=75, max_depth=12, data_mode="DEMO")
            
    return meta
