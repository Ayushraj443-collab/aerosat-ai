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

#### Verified Test Inventory (70/70 Tests Passing):
| Test File | Test Count | Scope & Focus Areas | Result |
| :--- | :---: | :--- | :---: |
| `test_health.py` | 2 | Root `/` service summary, `/api/health`, DB status, real vs demo record counts | **PASSED** |
| `test_data_api.py` | 10 | Connector registry, stations, paired observations, date filters, observation provenance breakdown, observation type filters, satellite ingestion report, prediction history data mode | **PASSED** |
| `test_data_isolation.py` | 6 | DB partition isolation, mode filtering (`?mode=real\|demo`), prediction mode provenance, untrained pollutant error handling, downscaled grid mode metadata, CSV/GeoJSON exports | **PASSED** |
| `test_downscaler.py` | 3 | Haversine distance, single-location downscaling with 90% CI, GeoJSON grid generator with bounding box pre-filtering | **PASSED** |
| `test_location_summary.py` | 4 | Regional multi-city coordinate summaries (Patna, Ludhiana, Mumbai), historical date handling, invalid coordinates rejection | **PASSED** |
| `test_ml_pipeline.py` | 1 | Spatial ML pipeline training, GroupKFold station cross-validation, median imputation, baseline IDW comparison | **PASSED** |
| `test_model_evaluation.py` | 5 | Genuine NO2 pollutant filtering, spatial holdout zero-leakage, Bayesian Ridge baseline, data provenance fingerprint, uncertainty calibration | **PASSED** |
| `test_p19_verification.py` | 14 | Idempotent dataset registration, SHA256 checksum differentiation, registry deduplication, valid observation preservation, schema validation, source provenance separation, unmatched row exclusion, spatial matching logic, NaN preservation, model metrics from actual predictions, real/demo isolation, API backwards compatibility | **PASSED** |
| `test_predict_api.py` | 2 | Point prediction, domain boundary validation, prediction history logging, CSV/GeoJSON export | **PASSED** |
| `test_real_connectors.py` | 12 | Live Copernicus CDSE OData catalogue discovery, download blocker with setup guide, Open-Meteo ERA5 & BLH, Copernicus CAMS surface air quality, OpenAQ key check, Copernicus OAuth manager diagnostics (mock & unconfigured), Sentinel-5P pixel observation retrieval, CPCB CAAQMS CSV importer, and sample Delhi dataset ingestion | **PASSED** |
| `test_sentinel5p_netcdf.py` | 4 | NetCDF Level-2 granule existence, NetCDF variable & QA extraction, station spatial collocations, paired observation builder without target leakage | **PASSED** |
| `test_upload_validation.py` | 7 | Upload validation engine, coordinate boundaries, station name resolution, sample Delhi CSV parsing, mixed pollutant determination, duplicate handling, NO2/PM2.5 strict exclusion | **PASSED** |

**Summary:** 70/70 unit, integration, NetCDF parsing, ML validation, and live connector tests passed (100% pass rate) in 21.52 seconds.

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
