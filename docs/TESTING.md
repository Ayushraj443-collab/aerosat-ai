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
| `test_health.py` | `test_health_endpoint` | Verifies `/api/health`, DB status, and demo mode flag | **PASSED** |
| `test_data_api.py` | `test_get_data_sources` | Validates registration of all 4 data source connectors | **PASSED** |
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

**Summary:** 13/13 unit and integration tests passed in 1.89 seconds.

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
