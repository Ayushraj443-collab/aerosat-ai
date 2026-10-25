import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.data.synthetic_generator import initialize_demo_data_if_needed
from app.ml.pipeline import SpatialMLPipeline, get_active_model

from app.api.health import router as health_router
from app.api.data import router as data_router
from app.api.map import router as map_router
from app.api.predict import router as predict_router
from app.api.model_routes import router as model_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    logger.info("Initializing AeroSat-AI Backend...")
    # 1. Initialize SQLite database schema
    init_db()
    
    # 2. Ensure demonstration data and station registry exist
    initialize_demo_data_if_needed()
    
    # 3. Ensure an active trained model exists for NO2 and PM2.5 for instant demonstration
    for pol in ["NO2", "PM2.5"]:
        model, meta = get_active_model(pol)
        if model is None:
            logger.info(f"No existing active model for {pol}. Training initial spatial ML model...")
            try:
                pipeline = SpatialMLPipeline(pollutant=pol, algorithm="random_forest")
                pipeline.train_and_evaluate(n_estimators=60, max_depth=10, spatial_cv_folds=5)
            except Exception as e:
                logger.error(f"Failed to auto-train initial model for {pol}: {e}")
                
    logger.info("AeroSat-AI Backend is ready to serve requests.")
    yield
    logger.info("Shutting down AeroSat-AI Backend.")

app = FastAPI(
    title=settings.PROJECT_TITLE,
    description=(
        "Scientific AI/ML geospatial service for estimating and spatially downscaling "
        "air quality from Sentinel-5P/TROPOMI satellite column observations and CPCB ground stations."
    ),
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
            "path": request.url.path
        }
    )

# Include API Routers under /api
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(data_router, prefix=settings.API_PREFIX)
app.include_router(map_router, prefix=settings.API_PREFIX)
app.include_router(predict_router, prefix=settings.API_PREFIX)
app.include_router(model_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_TITLE,
        "version": settings.VERSION,
        "status": "operational",
        "demo_mode": settings.DEMO_MODE,
        "api_docs": "/docs",
        "health_check": f"{settings.API_PREFIX}/health"
    }
