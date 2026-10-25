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
- `limit` (optional): integer (default: 200, max: 1000)

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
