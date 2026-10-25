from fastapi import APIRouter
from datetime import datetime
from typing import List
from app.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["System Health"])

@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint providing runtime status, loaded models, and demo mode indicator."""
    loaded_models: List[str] = []
    for meta_file in settings.DATA_MODELS_DIR.glob("*_meta.json"):
        loaded_models.append(meta_file.stem.replace("_meta", ""))
        
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.VERSION,
        "demo_mode": settings.DEMO_MODE,
        "environment": settings.ENVIRONMENT,
        "loaded_models": loaded_models,
        "storage_status": {
            "database_exists": settings.DATABASE_PATH.exists(),
            "raw_dir_exists": settings.DATA_RAW_DIR.exists(),
            "models_dir_exists": settings.DATA_MODELS_DIR.exists()
        }
    }
