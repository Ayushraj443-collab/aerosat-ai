import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db, count_observations
from app.data.synthetic_generator import initialize_demo_data_if_needed
from app.data.connectors import run_all_connector_audits, populate_verified_real_dataset
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
    # 1. Initialize SQLite database schema & migrations
    init_db()
    
    # 2. Ensure demonstration data and station registry exist
    initialize_demo_data_if_needed()

    # 3. Audit connectors and ensure real observations are populated
    try:
        real_cnt = count_observations("REAL")
        if real_cnt < 30:
            logger.info("Seeding genuine verified observations into database from Copernicus CAMS & ERA5...")
            populate_verified_real_dataset()
        run_all_connector_audits()
    except Exception as e:
        logger.warning(f"Connector initialization warning: {e}")
    
    # 4. Ensure an active trained model exists for NO2 and PM2.5 in both DEMO and REAL modes
    for pol in ["NO2", "PM2.5"]:
        # Demo model
        d_model, d_meta = get_active_model(pol, data_mode="DEMO")
        if d_model is None:
            logger.info(f"Training initial DEMO spatial ML model for {pol}...")
            try:
                p_demo = SpatialMLPipeline(pollutant=pol, algorithm="random_forest", data_mode="DEMO")
                p_demo.train_and_evaluate(n_estimators=60, max_depth=10, spatial_cv_folds=5)
            except Exception as e:
                logger.error(f"Failed to auto-train DEMO model for {pol}: {e}")
                
        # Real model
        r_model, r_meta = get_active_model(pol, data_mode="REAL")
        if r_model is None:
            logger.info(f"Training initial REAL spatial ML model for {pol} on verified observations...")
            try:
                p_real = SpatialMLPipeline(pollutant=pol, algorithm="random_forest", data_mode="REAL")
                p_real.train_and_evaluate(n_estimators=50, max_depth=10, spatial_cv_folds=5)
            except Exception as e:
                logger.error(f"Failed to auto-train REAL model for {pol}: {e}")
                
    logger.info("AeroSat-AI Backend is ready to serve both REAL and DEMO requests.")
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
        "supported_modes": ["REAL", "DEMO"],
        "api_docs": "/docs",
        "health_check": f"{settings.API_PREFIX}/health"
    }
