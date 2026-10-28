# AeroSat-AI REST API Reference Documentation

Base URL: `http://127.0.0.1:8000/api`  
Interactive Swagger OpenAPI Docs: `http://127.0.0.1:8000/docs`  
ReDoc: `http://127.0.0.1:8000/redoc`

---

## 1. System Health

### `GET /health`
Returns system status, environment mode, database connectivity, and registered model inventory.

#### Response `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-10-25T21:15:30.123456",
  "version": "1.0.0",
  "demo_mode": true,
  "environment": "development",
  "loaded_models": [
    "no2_random_forest_20261025_211530",
    "pm2.5_random_forest_20261025_211530"
  ],
  "storage_status": {
    "database_exists": true,
    "raw_dir_exists": true,
    "models_dir_exists": true
  }
}
```

---

## 2. Data Sources & Observations

### `GET /data/sources`
Lists registered satellite sensors, ground networks, and meteorological data providers with operational status and credential guides.

#### Response `200 OK`
```json
[
  {
    "id": "sentinel-5p-tropomi",
    "name": "Sentinel-5P / TROPOMI Atmospheric Sensor",
    "category": "satellite",
    "product": "L2_NO2 / L2_CO / L2_SO2 / L2_O3",
    "status": "demo_mode",
    "spatial_coverage": "Global (2600 km swath width)",
    "native_resolution": "5.5 km x 3.5 km",
    "temporal_frequency": "Daily revisits (~13:30 local solar time)",
    "data_provider": "ESA Copernicus Data Space Ecosystem (CDSE)",
    "auth_required": true,
    "is_demo": true,
    "setup_guide": "Configure COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in .env"
  }
]
```

### `GET /data/stations`
Retrieves CPCB continuous ambient air quality monitoring stations in the study region.

#### Response `200 OK`
```json
[
  {
    "station_id": "DEL_ANAND_VIHAR",
    "name": "Anand Vihar, Delhi",
    "city": "Delhi",
    "latitude": 28.6476,
    "longitude": 77.3158,
    "elevation_m": 215.0,
    "station_type": "Traffic / Commercial Border",
    "operational_status": "Active",
    "latest_reading": {
      "date": "2024-03-01",
      "NO2": { "value": 52.4, "unit": "µg/m³" },
      "PM2.5": { "value": 145.2, "unit": "µg/m³" }
    },
    "is_demo": true
  }
]
```

### `GET /data/observations`
Filters paired satellite column and ground station observation records.

**Query Parameters:**
- `pollutant` (optional): `NO2`, `PM2.5`, `SO2`, `CO`, `O3`
- `date` (optional): `YYYY-MM-DD`
- `station_id` (optional): station identifier string
- `mode` (optional): `real` or `demo` (default: `real`)
- `matched_only` (optional): boolean (if `true`, strictly filters for genuine collocated records with `satellite_column IS NOT NULL` and `quality_flag = 1.0`)
- `observation_type` (optional): `VERIFIED_COLLOCATION`, `GROUND_MONITOR`, `CAMS_REANALYSIS`, `DIRECT_SATELLITE`, `SYNTHETIC_DEMO`
- `limit` (optional): integer (default: 200, max: 1000)

#### Response `200 OK`
```json
{
  "total": 7,
  "data_mode": "REAL",
  "observations": [
    {
      "id": "COLLOC_S5P_DEL_ANAND_VIHAR_NO2_20240110",
      "data_mode": "REAL",
      "source_name": "Sentinel-5P OFFL L2 Collocation",
      "source_product": "S5P_L2__NO2____",
      "observation_time": "2024-01-10T08:15:22Z",
      "station_id": "DEL_ANAND_VIHAR",
      "station_name": "Anand Vihar, Delhi - DPCC",
      "latitude": 28.6476,
      "longitude": 77.3158,
      "pollutant": "NO2",
      "ground_value": 78.4,
      "unit": "µg/m³",
      "satellite_column": 12.8,
      "satellite_qa": 0.82,
      "observation_type": "VERIFIED_COLLOCATION",
      "is_verified_collocation": true
    }
  ]
}
```

### `GET /data/provenance-summary`
Returns an empirical database breakdown across all 5 observation provenance types, strictly isolating verified satellite-ground collocations from ground monitors, CAMS model estimates, raw granules, and synthetic demo records.

**Query Parameters:**
- `mode` (optional): `real` or `demo` (default: `real`)

#### Response `200 OK`
```json
{
  "data_mode": "REAL",
  "total_records": 507,
  "breakdown": {
    "verified_collocations": 7,
    "ground_monitors": 52,
    "cams_reanalysis": 448,
    "direct_satellite": 0,
    "synthetic_demo": 0
  },
  "provenance_rules": {
    "verified_collocations": "Genuine Sentinel-5P OFFL L2 TROPOMI column paired with CPCB CAAQMS ground monitor within 5.5 km and matching overpass window (QA >= 0.50).",
    "ground_monitors": "In-situ ground regulatory continuous monitoring stations from CPCB CAAQMS (surface concentration only).",
    "cams_reanalysis": "Copernicus Atmosphere Monitoring Service atmospheric model estimates (never treated as direct satellite retrievals).",
    "direct_satellite": "Raw spaceborne spectrometer pixel retrievals without station collocation (archived as NetCDF L2 files in data/raw/sentinel5p/).",
    "synthetic_demo": "Calibrated physical simulation data strictly partitioned in DEMO mode (never mixed into REAL training or evaluation)."
  }
}
```

### `GET /data/satellite/ingestion-report`
Provides an auditable report on the local Sentinel-5P Level-2 NetCDF archive, documented QA thresholds, physical unit conversion factors, spatial bounding boxes, and ground collocation counts.

#### Response `200 OK`
```json
{
  "status": "success",
  "pipeline_name": "Sentinel-5P TROPOMI Level-2 Offline (OFFL) Ingestion Pipeline",
  "archive_directory": "data/raw/sentinel5p",
  "total_granules_found": 4,
  "granules": [
    {
      "filename": "S5P_OFFL_L2__NO2____20240110T073000_20240110T091200_32345_03_020600_20240112T100000.nc",
      "size_mb": 624.5,
      "pollutant": "NO2",
      "orbit": "32345",
      "product_type": "OFFL_L2__NO2____"
    }
  ],
  "qa_filtering": {
    "threshold": 0.50,
    "justification": "ESA TROPOMI Product User Manual recommendation: QA >= 0.50 removes cloud-covered scenes (cloud radiance fraction > 0.5), snow/ice contamination, and high solar zenith angle anomalies while preserving clear-sky tropospheric signals."
  },
  "units_and_conversions": {
    "netcdf_native_unit": "mol/m^2",
    "internal_feature_unit": "10^15 molec/cm^2",
    "conversion_factor": "1 mol/m^2 = 6.02214076e19 molec/m^2 = 60221.4076 * 10^15 molec/cm^2",
    "ground_target_unit": "µg/m³"
  },
  "spatial_study_region": {
    "region_name": "Delhi-NCR",
    "bounds": { "min_lat": 28.20, "max_lat": 28.95, "min_lon": 76.80, "max_lon": 77.55 }
  },
  "verified_ground_collocations_count": 7,
  "requires_external_credentials_for_live_download": true,
  "external_credentials_guide": "Add COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET to backend/.env for live Copernicus Data Space Ecosystem (CDSE) downloads."
}
```

### `POST /data/upload`
Uploads and validates an external CSV or GeoJSON dataset.

**Form Data:**
- `file`: binary file upload (`.csv`, `.json`, `.geojson`)

**Validation Rules:**
- Maximum file size: 15 MB
- Required columns: `latitude` and `longitude`
- Coordinate bounding check: latitude $\in [-90, 90]$, longitude $\in [-180, 180]$
- Pollutant identification: detects `no2`, `pm2.5`, `so2`, `co`, `o3`

#### Response `200 OK`
```json
{
  "dataset_id": "ds_a8b9c0d1e2",
  "filename": "external_air_data.csv",
  "uploaded_at": "2026-10-25T21:18:00",
  "row_count": 450,
  "columns": ["date", "latitude", "longitude", "no2", "temperature_c"],
  "pollutant_detected": "NO2",
  "coordinate_bounds": {
    "min_lat": 28.32,
    "max_lat": 28.85,
    "min_lon": 76.95,
    "max_lon": 77.42
  },
  "date_range": { "start": "2024-01-01", "end": "2024-03-01" },
  "missing_value_summary": {},
  "is_valid": true,
  "validation_messages": [],
  "preview_rows": [...]
}
```

---

## 3. Interactive Map Layers

### `GET /map/layers`
Returns configuration, description, and styling toggles for all interactive Leaflet map layers.

### `GET /map/downscaled-grid`
Generates a GeoJSON `FeatureCollection` of fine-resolution polygon grid cells with downscaled estimates, uncertainty limits, and cloud missingness masks.

**Query Parameters:**
- `pollutant` (required): `NO2`, `PM2.5`, `SO2`, `CO`, `O3`
- `resolution_km` (default: 2.0): Target grid cell size ($0.5 - 10.0\text{ km}$)
- `date` (optional): `YYYY-MM-DD`
- `min_lat`, `max_lat`, `min_lon`, `max_lon` (optional): Bounding box override

#### Response `200 OK` (GeoJSON FeatureCollection)
```json
{
  "type": "FeatureCollection",
  "metadata": {
    "pollutant": "NO2",
    "unit": "µg/m³",
    "date": "2024-03-01",
    "target_resolution_km": 2.0,
    "cell_count": 312,
    "valid_cells": 298,
    "data_gap_cells": 14,
    "model_version": "no2_random_forest_20261025",
    "crs": "EPSG:4326 (WGS84)"
  },
  "features": [
    {
      "type": "Feature",
      "id": "cell_0",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[76.90, 28.30], [76.92, 28.30], [76.92, 28.32], [76.90, 28.32], [76.90, 28.30]]]
      },
      "properties": {
        "cell_id": "cell_0",
        "center_lat": 28.31,
        "center_lon": 76.91,
        "pollutant": "NO2",
        "unit": "µg/m³",
        "estimated_value": 42.5,
        "uncertainty_sd": 3.8,
        "uncertainty_lower_90ci": 36.25,
        "uncertainty_upper_90ci": 48.75,
        "satellite_column": 10.5,
        "satellite_qa": 0.88,
        "is_data_gap": false,
        "aqi_category": "Satisfactory (51-100)"
      }
    }
  ]
}
```

---

## 4. Point Prediction & Export Workspace

### `POST /predict`
Executes downscaled ground concentration inference for a single coordinate with full uncertainty estimation and input provenance logging.

#### Request Body
```json
{
  "latitude": 28.6476,
  "longitude": 77.3158,
  "date": "2024-03-01",
  "pollutant": "NO2",
  "target_resolution_km": 1.0,
  "model_algorithm": "random_forest"
}
```

#### Response `200 OK`
```json
{
  "prediction_id": "pred_20261025211530_482",
  "timestamp": "2026-10-25T21:15:30.123",
  "latitude": 28.6476,
  "longitude": 77.3158,
  "date": "2024-03-01",
  "pollutant": "NO2",
  "target_resolution_km": 1.0,
  "estimated_value": 52.4,
  "unit": "µg/m³",
  "aqi_category": "Satisfactory (51-100)",
  "uncertainty": {
    "lower_bound_90ci": 45.8,
    "upper_bound_90ci": 59.0,
    "standard_deviation": 4.01,
    "confidence_level": "90%"
  },
  "model_info": {
    "model_id": "no2_random_forest_20261025",
    "model_name": "AeroSat-NO2-RANDOM_FOREST",
    "algorithm": "random_forest",
    "r2_score": 0.864,
    "mae": 4.82
  },
  "provenance": {
    "satellite_product": "Sentinel-5P L2 Tropospheric NO2 Column",
    "satellite_column_value": 13.25,
    "satellite_unit": "10¹⁵ molec/cm²",
    "satellite_qa_value": 0.88,
    "meteorological_features": {
      "temperature_c": 22.4,
      "relative_humidity_pct": 52.0,
      "wind_speed_ms": 1.8,
      "wind_direction_deg": 285.0,
      "boundary_layer_height_m": 620.0,
      "ventilation_index": 1.116
    },
    "nearest_ground_station_id": "DEL_ANAND_VIHAR",
    "nearest_station_name": "Anand Vihar, Delhi",
    "distance_to_station_km": 0.0,
    "elevation_m": 215.0,
    "road_density_proxy": 0.85,
    "is_demo": true,
    "scientific_disclaimer": "IMPORTANT SCIENTIFIC LIMITATION: Sentinel-5P pixels (~5.5x3.5 km) measure atmospheric columns. Downscaled values are statistical model estimates."
  }
}
```

### `GET /predictions/history`
Returns history of user inferences logged into the SQLite database.

### `GET /export/{prediction_id}?format=csv|json|geojson`
Downloads a prediction or dataset as a standalone CSV, JSON, or GeoJSON file.

---

## 5. Model Management & Evaluation

### `POST /model/train`
Triggers an on-demand spatial training pipeline with `GroupKFold` cross-validation.

#### Request Body
```json
{
  "pollutant": "NO2",
  "algorithm": "random_forest",
  "n_estimators": 100,
  "max_depth": 12,
  "spatial_cv_folds": 5,
  "random_state": 42
}
```

### `GET /model/status`
Lists active model status, training timestamps, and validation metrics across all 5 supported criteria pollutants.

### `GET /model/metrics?pollutant=NO2`
Returns comprehensive out-of-fold spatial evaluation metrics, fold-by-fold results, baseline comparisons, feature importances, scatter plot arrays, and residual distribution histograms.
