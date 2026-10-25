import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "AeroSat-AI"
    PROJECT_TITLE: str = "Satellite Air-Quality Prediction & Downscaling"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Environment & Demo Mode
    DEMO_MODE: bool = True
    ENVIRONMENT: str = "development"
    
    # File Paths
    BASE_DIR: Path = BASE_DIR
    DATA_RAW_DIR: Path = BASE_DIR / "data" / "raw"
    DATA_PROCESSED_DIR: Path = BASE_DIR / "data" / "processed"
    DATA_MODELS_DIR: Path = BASE_DIR / "data" / "models"
    DATABASE_PATH: Path = BASE_DIR / "data" / "satellite_aq.db"
    
    # External API Keys (Optional - Demo mode activated if empty)
    COPERNICUS_CLIENT_ID: str = ""
    COPERNICUS_CLIENT_SECRET: str = ""
    OPENAQ_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Supported Pollutants and Metadata
    SUPPORTED_POLLUTANTS: dict = {
        "NO2": {
            "name": "Nitrogen Dioxide",
            "unit": "µg/m³",
            "satellite_product": "Sentinel-5P L2 Tropospheric NO2",
            "satellite_unit": "10¹⁵ molec/cm²",
            "cpcb_standard_24h": 80.0,
            "who_guideline_24h": 25.0,
            "typical_range": [5.0, 150.0],
            "description": "Formed from combustion in vehicles, power plants, and industrial facilities. Strongly concentrated along urban transport corridors."
        },
        "PM2.5": {
            "name": "Particulate Matter < 2.5µm",
            "unit": "µg/m³",
            "satellite_product": "Sentinel-5P Aerosol Optical Depth / AI",
            "satellite_unit": "Index / Unitless",
            "cpcb_standard_24h": 60.0,
            "who_guideline_24h": 15.0,
            "typical_range": [15.0, 450.0],
            "description": "Fine inhalable particles posing severe respiratory and cardiovascular health risks. Modulated by boundary layer trapping and regional biomass burning."
        },
        "SO2": {
            "name": "Sulfur Dioxide",
            "unit": "µg/m³",
            "satellite_product": "Sentinel-5P L2 Total Column SO2",
            "satellite_unit": "Dobson Units (DU)",
            "cpcb_standard_24h": 80.0,
            "who_guideline_24h": 40.0,
            "typical_range": [2.0, 60.0],
            "description": "Emitted by coal power plants, smelters, and heavy fuel oil combustion. Serves as a direct indicator of industrial sulfur emissions."
        },
        "CO": {
            "name": "Carbon Monoxide",
            "unit": "mg/m³",
            "satellite_product": "Sentinel-5P L2 Total Column CO",
            "satellite_unit": "10¹⁸ molec/cm²",
            "cpcb_standard_24h": 2.0,
            "who_guideline_24h": 4.0,
            "typical_range": [0.2, 5.0],
            "description": "Colorless toxic gas from incomplete combustion in vehicular engines and biomass fires. Long atmospheric lifetime (~1-2 months)."
        },
        "O3": {
            "name": "Tropospheric Ozone",
            "unit": "µg/m³",
            "satellite_product": "Sentinel-5P L2 Tropospheric Column O3",
            "satellite_unit": "Dobson Units (DU)",
            "cpcb_standard_24h": 100.0,
            "who_guideline_24h": 100.0,
            "typical_range": [10.0, 180.0],
            "description": "Secondary pollutant formed photochemically by NO2 and VOCs in sunlight. Peaks in warm afternoons."
        }
    }
    
    # Supported Resolutions in Kilometers
    SUPPORTED_RESOLUTIONS_KM: List[float] = [1.0, 2.0, 5.0, 10.0]
    
    # Default Region: Delhi-NCR & Indo-Gangetic Plain
    DEFAULT_BBOX: dict = {
        "min_lat": 28.30,
        "max_lat": 28.88,
        "min_lon": 76.90,
        "max_lon": 77.45,
        "center_lat": 28.6139,
        "center_lon": 77.2090,
        "region_name": "Delhi National Capital Region (NCR), India"
    }

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_RAW_DIR, exist_ok=True)
os.makedirs(settings.DATA_PROCESSED_DIR, exist_ok=True)
os.makedirs(settings.DATA_MODELS_DIR, exist_ok=True)
