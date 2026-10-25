import requests
import logging
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class DataSourceRegistry:
    """Registry of environmental and satellite data connectors."""

    @staticmethod
    def get_registered_sources() -> List[Dict[str, Any]]:
        is_copernicus_auth = bool(settings.COPERNICUS_CLIENT_ID and settings.COPERNICUS_CLIENT_SECRET)
        is_openaq_auth = bool(settings.OPENAQ_API_KEY)
        
        return [
            {
                "id": "sentinel-5p-tropomi",
                "name": "Sentinel-5P / TROPOMI Atmospheric Sensor",
                "description": "ESA Copernicus polar-orbiting satellite measuring atmospheric column concentrations of NO2, SO2, CO, O3, and aerosol absorption index at ~5.5 x 3.5 km nadir resolution.",
                "category": "satellite",
                "product": "L2_NO2 / L2_CO / L2_SO2 / L2_O3",
                "status": "connected" if is_copernicus_auth else "demo_mode",
                "spatial_coverage": "Global (2600 km swath width)",
                "native_resolution": "5.5 km x 3.5 km",
                "temporal_frequency": "Daily revisits (~13:30 local solar time)",
                "data_provider": "European Space Agency (ESA) Copernicus Data Space Ecosystem (CDSE)",
                "auth_required": True,
                "is_demo": not is_copernicus_auth,
                "setup_guide": (
                    "To enable real Copernicus Sentinel-5P queries: "
                    "1. Register at https://dataspace.copernicus.eu\n"
                    "2. Generate an OAuth2 Client ID and Client Secret in User Profile\n"
                    "3. Add COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET to backend/.env"
                )
            },
            {
                "id": "cpcb-ground-stations",
                "name": "CPCB / CAAQMS Ground Air Quality Network",
                "description": "Continuous Ambient Air Quality Monitoring Stations operated by Central Pollution Control Board (India) and State PCBs measuring ground-level criteria pollutants.",
                "category": "ground",
                "product": "Surface Criteria Pollutants (PM2.5, NO2, SO2, CO, O3)",
                "status": "connected" if is_openaq_auth else "demo_mode",
                "spatial_coverage": "India (Delhi-NCR & 300+ Indian cities)",
                "native_resolution": "Point observation (fixed station shelter)",
                "temporal_frequency": "Hourly & 24-hour averages",
                "data_provider": "Central Pollution Control Board (CPCB) / OpenAQ Integration",
                "auth_required": False,
                "is_demo": not is_openaq_auth,
                "setup_guide": (
                    "CPCB real-time observations can be ingested directly via official CPCB bulk reports or OpenAQ API v3. "
                    "Set OPENAQ_API_KEY in .env for higher rate limits."
                )
            },
            {
                "id": "open-meteo-weather",
                "name": "Open-Meteo Atmospheric & Planetary Boundary Layer API",
                "description": "High-resolution numerical weather prediction (NWP) model providing boundary layer height (BLH), 10m wind vector, 2m temperature, and relative humidity.",
                "category": "meteorology",
                "product": "Boundary Layer Height, Wind Speed/Dir, Temp, Relative Humidity",
                "status": "connected",
                "spatial_coverage": "Global (0.1 degree grid / ~11 km)",
                "native_resolution": "11 km NWP grid",
                "temporal_frequency": "Hourly / Reanalysis",
                "data_provider": "Open-Meteo & ECMWF IFS / ERA5 models",
                "auth_required": False,
                "is_demo": False,
                "setup_guide": "Publicly accessible endpoint without API key for non-commercial educational use."
            },
            {
                "id": "shuttle-radar-topography",
                "name": "SRTM Digital Elevation & Topography",
                "description": "NASA Shuttle Radar Topography Mission (SRTM) 30m / 90m digital elevation model used to model aerodynamic drainage and valley inversions.",
                "category": "geographic",
                "product": "Surface Elevation (m MSL)",
                "status": "active",
                "spatial_coverage": "Global (60N to 56S)",
                "native_resolution": "30-90 meters",
                "temporal_frequency": "Static geographic predictor",
                "data_provider": "NASA JPL / USGS Earth Resources Observation",
                "auth_required": False,
                "is_demo": False,
                "setup_guide": "Integrated into offline spatial grid engine using topographic approximations."
            }
        ]

    @staticmethod
    def test_open_meteo_live(lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Attempt a live fetch from Open-Meteo weather API for current conditions."""
        try:
            url = "https://api.open-meteo.com/v1/forecast"
            params = {
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",
                "hourly": "boundary_layer_height",
                "timezone": "auto",
                "forecast_days": 1
            }
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current", {})
                hourly_blh = data.get("hourly", {}).get("boundary_layer_height", [800])
                avg_blh = sum(hourly_blh[:24]) / len(hourly_blh[:24]) if hourly_blh else 800.0
                return {
                    "temperature_c": current.get("temperature_2m", 25.0),
                    "relative_humidity_pct": current.get("relative_humidity_2m", 50.0),
                    "wind_speed_ms": current.get("wind_speed_10m", 2.0),
                    "wind_direction_deg": current.get("wind_direction_10m", 270.0),
                    "boundary_layer_height_m": round(avg_blh, 1),
                    "is_live": True
                }
        except Exception as e:
            logger.warning(f"Could not connect to live Open-Meteo API ({e}). Falling back to simulated meteorology.")
        return None
