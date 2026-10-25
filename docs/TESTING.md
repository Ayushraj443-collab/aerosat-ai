# AeroSat-AI Testing & Quality Assurance Verification Guide

This document details the automated testing strategy, execution commands, and verified results for the AeroSat-AI system.

---

## 1. Automated Test Execution

### 1.1 Backend Test Suite (Pytest)
The backend test suite is configured via `backend/pytest.ini` and executed against the virtual environment in `backend/venv`:

```powershell
# From project root
& .\backend\venv\Scripts\pytest.exe .\backend\tests -v
```

#### Verified Test Inventory:
| Test File | Test Name | Purpose | Result |
| :--- | :--- | :--- | :---: |
| `test_health.py` | `test_root` | Verifies root `/` service summary and docs link | **PASSED** |
| `test_health.py` | `test_health_endpoint` | Verifies `/api/health`, DB status, real vs demo record counts | **PASSED** |
| `test_data_api.py` | `test_get_data_sources` | Validates registration of all data source connectors | **PASSED** |
| `test_data_api.py` | `test_get_stations` | Validates Delhi-NCR CPCB monitoring station coordinates | **PASSED** |
| `test_data_api.py` | `test_get_observations` | Tests paired observation filtering by date and pollutant | **PASSED** |
| `test_ml_pipeline.py` | `test_spatial_ml_pipeline_training` | Validates feature matrix extraction, GroupKFold station splitting, and metrics | **PASSED** |
| `test_downscaler.py` | `test_haversine_distance` | Validates physical distance calculation across Delhi | **PASSED** |
| `test_downscaler.py` | `test_estimate_single_location` | Verifies point inference, 90% CI bounds, and provenance | **PASSED** |
| `test_downscaler.py` | `test_generate_downscaled_grid_geojson` | Verifies polygon grid geometry and metadata formatting | **PASSED** |
| `test_predict_api.py` | `test_predict_valid_request` | Verifies POST `/api/predict`, history logging, and exports | **PASSED** |
| `test_predict_api.py` | `test_predict_out_of_bounds_coordinate` | Tests rejection (422) for coordinates outside India | **PASSED** |
| `test_upload_validation.py` | `test_upload_valid_csv` | Tests successful CSV upload and schema extraction | **PASSED** |
| `test_upload_validation.py` | `test_upload_missing_coordinates_csv` | Verifies rejection of CSV missing lat/lon columns | **PASSED** |
| `test_real_connectors.py` | `test_sentinel5p_catalogue_discovery` | Verifies live ESA Copernicus CDSE OData catalogue discovery | **PASSED** |
| `test_real_connectors.py` | `test_sentinel5p_download_blocked_without_credentials` | Verifies authenticated download reports BLOCKED with setup guide | **PASSED** |
| `test_real_connectors.py` | `test_open_meteo_weather_connector` | Verifies live ERA5 historical weather & forecast boundary layer height | **PASSED** |
| `test_real_connectors.py` | `test_copernicus_cams_air_quality_connector` | Verifies live Copernicus CAMS surface PM2.5 and NO2 observations | **PASSED** |
| `test_real_connectors.py` | `test_openaq_connector_status` | Verifies OpenAQ v3 reports BLOCKED when API key is missing | **PASSED** |
| `test_real_connectors.py` | `test_cpcb_csv_importer_valid` | Verifies standardized CPCB CCR CSV ingestion and validation | **PASSED** |
| `test_real_connectors.py` | `test_cpcb_csv_importer_missing_columns` | Verifies rejection of malformed files missing required headers | **PASSED** |
| `test_data_isolation.py` | `test_database_isolation` | Verifies REAL and DEMO records are cleanly partitioned in DB | **PASSED** |
| `test_data_isolation.py` | `test_api_observations_mode_filtering` | Verifies `/api/data/observations?mode=real|demo` isolation | **PASSED** |
| `test_data_isolation.py` | `test_prediction_api_mode_isolation` | Verifies `/api/predict` respects data_mode and logs provenance | **PASSED** |
| `test_data_isolation.py` | `test_unsupported_pollutant_real_mode_error` | Verifies untrained pollutant in REAL mode returns 400 (no fake data) | **PASSED** |
| `test_data_isolation.py` | `test_downscaled_grid_mode_parameter` | Verifies `/api/map/downscaled-grid` reflects data_mode in metadata | **PASSED** |
| `test_data_isolation.py` | `test_prediction_export_formats` | Verifies CSV and GeoJSON prediction export downloads | **PASSED** |

**Summary:** 26/26 unit, integration, and live connector tests passed in 19.77 seconds.

---

## 2. Frontend Production Build & Type Checking

To guarantee zero runtime syntax errors, missing type declarations, or broken imports, the frontend build was verified using TypeScript compiler and Vite:

```bash
cd frontend
npm run build
```

#### Build Output:
```text
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2519 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.97 kB │ gzip:   0.54 kB
dist/assets/index-BcPXMpv1.css   43.58 kB │ gzip:  12.16 kB
dist/assets/index-CXSVOH-G.js   863.95 kB │ gzip: 248.31 kB
✓ built in 772ms
```

---

## 3. Manual Smoke Testing & Verification Checklist

1. [x] **Database Auto-Initialization:** SQLite database `data/satellite_aq.db` automatically creates tables on first run.
2. [x] **Demo Data Generation:** Synthetic Delhi-NCR paired dataset generated automatically on startup if missing.
3. [x] **Initial Model Training:** Auto-trains baseline Random Forest models for $\text{NO}_2$ and $\text{PM}_{2.5}$ on first startup.
4. [x] **Interactive Map Rendering:** Leaflet map displays CartoDB Dark Matter tiles, station pins, downscaled polygon grids, uncertainty layer, and cloud masks.
5. [x] **Prediction Workspace Execution:** Submits latitude/longitude, calculates downscaling, computes 90% confidence intervals, and records to history.
6. [x] **Multi-format Exports:** Verified CSV, JSON, and GeoJSON export downloads for predictions.
7. [x] **Model Evaluation Dashboard:** Renders out-of-fold metrics, spatial GroupKFold fold matrix, Recharts scatter plot, and residual histogram.
8. [x] **Dataset Upload Validation:** Successfully parses valid CSVs and flags missing coordinates or out-of-bounds geographic coordinates.
9. [x] **Scientific Disclaimers:** Visible demo mode pill and atmospheric limitations banner displayed across all views.
