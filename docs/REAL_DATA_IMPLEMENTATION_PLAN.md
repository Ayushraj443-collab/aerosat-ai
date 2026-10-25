# Real Satellite Air-Quality Prediction & Downscaling Implementation Plan

## Executive Summary
This document outlines the engineering and scientific roadmap to transition the **Satellite Air-Quality Prediction & Downscaling (AeroSat-AI)** system from a synthetic demonstration prototype into a scientifically defensible, real-data-capable geospatial platform.

---

## 1. Architectural Baseline & Audit Findings

### 1.1 Current Architecture
- **Backend:** FastAPI (Python 3.12) running under Uvicorn, SQLite database (`data/aerosat.db`), Scikit-Learn ML models (Random Forest, Gradient Boosting, Linear Regression).
- **Frontend:** React 18 with TypeScript, Tailwind CSS, Vite, Leaflet interactive mapping, Recharts data visualization.
- **Data Flow:** Currently, observations in `data/raw/synthetic_sentinel5p_cpcb_pairs.csv` and stations in `data/raw/synthetic_cpcb_stations.json` are generated deterministically by `backend/app/data/synthetic_generator.py`.
- **Connector State:** `backend/app/data/connectors.py` contains stubs for Sentinel-5P and CPCB, and an uncalled `OpenMeteoConnector`.

### 1.2 Synthetic Ingress Points
1. `backend/app/data/synthetic_generator.py` (`generate_synthetic_pairs`, `generate_synthetic_stations`): Generates 200 synthetic matched observation rows starting from 2024-01-01 with simulated tropospheric column NO2, simulated ground PM2.5/NO2, and synthetic meteorological parameters.
2. `backend/app/api/data.py` (`get_observations`, `get_stations`): Automatically invokes `generate_synthetic_pairs()` if no raw CSV exists.
3. `backend/app/ml/downscaler.py` (`SpatialDownscaler.downscale`): Generates a regular geospatial grid over Delhi-NCR and computes predictions using the trained model or a distance-decay fallback.

---

## 2. Multi-Phase Implementation Roadmap

### Phase 2: Genuine Data Connectors
- **2A. Sentinel-5P / TROPOMI (Copernicus Data Space Ecosystem - CDSE):**
  - Implement real OData catalogue queries via `https://catalogue.dataspace.copernicus.eu/odata/v1/Products` for `S5P_L2_NO2____`, `S5P_L2_AER_AI`, `S5P_L2_CO_____`.
  - Filter by geographic bounding box (e.g. Delhi NCR: `POLYGON((76.8 28.3, 77.5 28.3, 77.5 28.9, 76.8 28.9, 76.8 28.3))`) and acquisition date ranges.
  - Implement live catalogue verification (inspect real product metadata, granule IDs, footprint geometries, and cloud cover/quality parameters).
  - Provide authenticated OAuth2 download flow (`https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`). Document exact credentials required (`COPERNICUS_CLIENT_ID`, `COPERNICUS_CLIENT_SECRET`).
- **2B. Ground Observations (CPCB / OpenAQ & Official Government Datasets):**
  - Implement connector to the official OpenAQ v3 API (`https://api.openaq.org/v3/`) covering Indian ground stations (Delhi-NCR CPCB, DPCC network) for continuous surface PM2.5, PM10, and NO2.
  - Implement official CPCB historical dataset validator and importer for standardized CSV dumps downloaded from the CPCB CCR portal (`https://app.cpcbccr.com/ccr/`).
  - Validate coordinates, station IDs, observation timestamps (IST vs UTC), units ($\mu g/m^3$ for PM2.5/NO2), and invalid flags (e.g. negative readings, equipment calibration codes).
- **2C. Genuine Meteorological Observations (Open-Meteo Public API):**
  - Connect to Open-Meteo ERA5 / Reanalysis and High-Resolution Historical API (`https://archive-api.open-meteo.com/v1/archive`).
  - Extract true hourly meteorological variables: Planetary Boundary Layer Height (BLH / `boundary_layer_height`), 2m Temperature (`temperature_2m`), 10m Wind Speed (`wind_speed_10m`), Wind Direction (`wind_direction_10m`), Relative Humidity (`relative_humidity_2m`), and Surface Pressure (`surface_pressure`).
  - Strictly preserve provenance, coordinates, and units without synthetic interpolation.

---

### Phase 3: Strict Isolation of Real and Demo Data
- **Data Mode Schemas:**
  - Define `DataMode` enum: `"REAL"` and `"DEMO"`.
  - Add provenance metadata fields to all observation records:
    - `data_mode: DataMode`
    - `source_name: str` (e.g., `Sentinel-5P TROPOMI L2`, `CPCB / DPCC`, `Open-Meteo ERA5`)
    - `source_product: str` (e.g., `S5P_OFFL_L2__NO2____`, `OpenAQ_v3_Location_7024`, `ERA5_Reanalysis`)
    - `source_record_id: Optional[str]`
    - `observation_time: str` (ISO 8601 UTC)
    - `retrieved_at: str` (ISO 8601 UTC)
    - `latitude: float`, `longitude: float`
    - `pollutant: str`, `measurement_value: float`, `unit: str`
    - `quality_flag: float` (e.g., `qa_value >= 0.50`)
    - `dataset_version: str`
- **Zero Silent Fallback Policy:**
  - If a user or API requests `mode=REAL` and no verified observations exist, return HTTP 404 / empty state with status `NO VERIFIED REAL DATA AVAILABLE`.
  - Never substitute synthetic data for real queries.
  - Preserve `mode=DEMO` for offline testing, demos, and presentations.
- **Frontend Mode Integration:**
  - Provide a prominent `[ REAL DATA | DEMO DATA ]` toggle in the navigation bar and Data Explorer.
  - Clearly display source connection status, last retrieval timestamp, verified record count, and errors.

---

### Phase 4: Scientifically Defensible Spatiotemporal Matching
- **Scientific Foundation:**
  - Satellite TROPOMI observations are column-integrated tropospheric densities (e.g. $mol/m^2$ or $\mu mol/m^2$). Ground stations measure surface mass concentration ($\mu g/m^3$). They cannot be equated directly.
  - Matching criteria:
    - Temporal window: $\pm 3$ hours around Sentinel-5P overpass time (typically ~13:30 local solar time).
    - Spatial window: Nearest pixel within 5 km (or bilinear interpolation within the TROPOMI ground pixel resolution ~5.5 km $\times$ 3.5 km).
    - Quality assurance: Filter satellite pixels with `qa_value < 0.50` (or $< 0.75$ for strict cloud-free scenarios) as recommended by Copernicus S5P user manuals.
    - Missingness handling: Preserve true missing values (`NaN`/`None`). Never invent ground or satellite observations.

---

### Phase 5: Real AI/ML Training Pipeline
- **Dataset Partitioning & Validation:**
  - Spatial-temporal holdout validation: GroupKFold by station ID to assess spatial generalizability to unmonitored locations.
  - Baseline comparison: Ridge regression / persistence baseline vs Random Forest / Gradient Boosting.
  - Evaluation metrics: Root Mean Squared Error (RMSE), Mean Absolute Error (MAE), Coefficient of Determination ($R^2$), Sample Count ($N$).
  - Missing-data diagnostics: If matched real observations are insufficient ($N < 30$), report exact missing counts without fabricating metrics.

---

### Phase 6: Spatial Downscaling Engine
- **Downscaling Pipeline:**
  - Define high-resolution output grid (e.g., 0.01° $\approx$ 1 km resolution over Delhi-NCR bounding box).
  - Coordinate Reference System: WGS 84 (EPSG:4326).
  - Feature stacking for prediction: Satellite column estimate, meteorological fields (boundary layer height, wind components, temperature), geographic coordinates (latitude, longitude, elevation/distance to urban center).
  - Output formats: GeoJSON feature collections, tabular CSV, and GeoTIFF raster export.
  - Transparent labeling: Distinguish raw satellite pixels, ground station points, and model downscaled surface predictions.

---

### Phase 7: Frontend Interface Modernization
- **Full Real/Demo React UI:**
  - Top-level persistent mode switcher.
  - Live data status badges (`CONNECTED (VERIFIED)`, `BLOCKED (CREDENTIALS NEEDED)`, `DEMO ACTIVE`).
  - Dynamic inspection of raw source records with full provenance metadata.
  - Clear alerts when real data is unavailable.

---

### Phase 8 & 9: Verification, Testing & Audit Documentation
- **Testing:**
  - Unit tests for all connectors (live network tests with timeouts, schema validation, isolation tests).
  - Pytest verification for real/demo isolation.
  - Production frontend build validation (`npm run build`).
- **Deliverables:**
  - `docs/REAL_DATA_AUDIT.md`: Complete audit of all connectors with explicit statuses (`VERIFIED`, `IMPLEMENTED_BUT_UNVERIFIED`, `BLOCKED`, `FAILED`).
  - Updated `README.md`, `docs/DATA_DICTIONARY.md`, `docs/METHODOLOGY.md`, `docs/TESTING.md`, `.env.example`.
