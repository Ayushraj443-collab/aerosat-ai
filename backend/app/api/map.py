from fastapi import APIRouter, Query, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime

from app.config import settings
from app.ml.downscaler import generate_downscaled_grid_geojson

router = APIRouter(prefix="/map", tags=["Interactive Map Layers"])

@router.get("/layers")
def get_map_layers():
    """Retrieve metadata, styling properties, and toggles for interactive map layers."""
    return {
        "region": settings.DEFAULT_BBOX,
        "supported_pollutants": settings.SUPPORTED_POLLUTANTS,
        "supported_resolutions_km": settings.SUPPORTED_RESOLUTIONS_KM,
        "layers": [
            {
                "id": "downscaled_grid",
                "name": "AI Downscaled Pollution Grid",
                "type": "polygon_grid",
                "description": "Model-estimated ground concentrations at fine spatial resolution (1-5 km) combining satellite columns and environmental predictors.",
                "enabled_by_default": True,
                "supports_uncertainty": True,
                "unit": "Dynamic (by pollutant)",
                "opacity": 0.65
            },
            {
                "id": "ground_stations",
                "name": "CPCB Ground Monitoring Stations",
                "type": "point_markers",
                "description": "In-situ reference monitors measuring surface criteria pollutants at continuous stations.",
                "enabled_by_default": True,
                "supports_uncertainty": False,
                "opacity": 1.0
            },
            {
                "id": "satellite_footprint",
                "name": "Sentinel-5P / TROPOMI Coarse Footprint",
                "type": "raster_cells",
                "description": "Coarse native satellite pixels (~5.5 x 3.5 km) showing total or tropospheric column densities.",
                "enabled_by_default": False,
                "supports_uncertainty": False,
                "opacity": 0.45
            },
            {
                "id": "uncertainty_layer",
                "name": "Prediction Uncertainty (90% CI Width)",
                "type": "polygon_grid",
                "description": "Model uncertainty derived from tree ensemble variance across spatial covariates.",
                "enabled_by_default": False,
                "supports_uncertainty": True,
                "opacity": 0.60
            },
            {
                "id": "cloud_mask",
                "name": "Cloud Mask & Missing Data Areas",
                "type": "hatched_mask",
                "description": "Areas where satellite QA < 0.50 due to cloud cover, aerosol optical thickness, or solar glint.",
                "enabled_by_default": True,
                "opacity": 0.50
            }
        ]
    }

@router.get("/downscaled-grid")
def get_downscaled_grid(
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    pollutant: str = Query("NO2", description="Pollutant: NO2, PM2.5, SO2, CO, O3"),
    resolution_km: float = Query(2.0, ge=0.5, le=10.0, description="Target grid resolution in kilometers"),
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None)
) -> Dict[str, Any]:
    """
    Generate and stream a GeoJSON FeatureCollection of fine-resolution downscaled pollutant estimates.
    Includes cell boundaries, point estimates, uncertainty limits, and missing-data flags.
    """
    p = pollutant.upper()
    if p not in settings.SUPPORTED_POLLUTANTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported pollutant '{pollutant}'. Must be one of {list(settings.SUPPORTED_POLLUTANTS.keys())}"
        )
        
    date_str = date or datetime.now().strftime("%Y-%m-%d")
    
    # Use bounding box or fallback to default Delhi-NCR
    bbox = settings.DEFAULT_BBOX
    bbox_min_lat = min_lat if min_lat is not None else bbox["min_lat"]
    bbox_max_lat = max_lat if max_lat is not None else bbox["max_lat"]
    bbox_min_lon = min_lon if min_lon is not None else bbox["min_lon"]
    bbox_max_lon = max_lon if max_lon is not None else bbox["max_lon"]
    
    # Boundary check
    if bbox_min_lat >= bbox_max_lat or bbox_min_lon >= bbox_max_lon:
        raise HTTPException(status_code=400, detail="Invalid bounding box coordinates: min must be strictly less than max.")
        
    geojson_grid = generate_downscaled_grid_geojson(
        min_lat=bbox_min_lat,
        max_lat=bbox_max_lat,
        min_lon=bbox_min_lon,
        max_lon=bbox_max_lon,
        date_str=date_str,
        pollutant=p,
        resolution_km=resolution_km
    )
    
    return geojson_grid
