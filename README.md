# AeroSat-AI: Satellite Air-Quality Prediction & Downscaling Using AI/ML

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python: 3.11+](https://img.shields.io/badge/Python-3.11%2B-brightgreen.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-teal.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue.svg)](https://react.dev)
[![Vite](https://img.shields.io/badge/Bundler-Vite-purple.svg)](https://vitejs.dev)
[![Status: Demonstration Ready](https://img.shields.io/badge/Status-Demonstration%20Ready-emerald.svg)]()

> **University Engineering Project Demonstration System**  
> A spatial machine learning and environmental intelligence framework pairing European Space Agency (ESA) **Sentinel-5P/TROPOMI** spaceborne spectrometer observations with Central Pollution Control Board (**CPCB**) ground monitors to estimate fine-scale surface air quality.

---

## 1. Project Overview & Motivation

Spaceborne atmospheric spectrometers such as the TROPOspheric Monitoring Instrument (**TROPOMI**) aboard Sentinel-5P provide unmatched synoptic coverage of criteria air pollutants ($\text{NO}_2$, $\text{SO}_2$, $\text{CO}$, $\text{O}_3$, Aerosol Index). However, spaceborne sensors suffer from two fundamental scientific limitations:
1. **Coarse Spatial Footprint:** Native nadir resolution is $\approx 5.5 \times 3.5\text{ km}$, obscuring localized street-level emission gradients and urban micro-plumes.
2. **Atmospheric Column Integration:** Satellites measure vertically integrated atmospheric column densities ($\text{mol/m}^2$ or $10^{15}\ \text{molec/cm}^2$), whereas regulatory bodies and human health guidelines (CPCB, WHO) enforce ground-level volumetric breathing concentrations ($\mu\text{g/m}^3$).

**AeroSat-AI** addresses these limitations by fusing spaceborne columns with numerical weather predictions (**Planetary Boundary Layer Height**, wind vectors, humidity) and fine-scale spatial covariates (SRTM topography, road density proxies). Using spatial machine learning with **GroupKFold cross-validation by station**, the system downscales coarse satellite swaths into high-resolution ($1.0 - 2.0\text{ km}$) ground-level estimates accompanied by rigorous $90\%$ confidence uncertainty intervals.

> **IMPORTANT SCIENTIFIC LIMITATION & TRUTH DISTINCTION:**  
> Downscaled outputs are model-estimated statistical inferences and must **not** be presented as newly observed street-level truth. All downscaled outputs feature explicit uncertainty bounds, cloud-mask missingness flags, and input-data provenance.

---

## 2. System Architecture

```text
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           Data Ingestion                               │
  │  Sentinel-5P L2 (Copernicus)  │  CPCB In-Situ Monitors  │  Open-Meteo  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    Spatiotemporal Pairing Engine                       │
  │  Matching Window: ±3 hrs  │  Spatial Tolerance: Station Coords         │
  │  Quality Flag Mask: QA ≥ 0.50 (Filters clouds, snow, and solar glint)  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                  Physics-Guided Feature Engineering                    │
  │  - Ventilation Index = (BLH × Wind Speed) / 1000                       │
  │  - Topographic Elevation (SRTM DEM)                                    │
  │  - Urban Proximity Decay & Road Density Proxy                          │
  │  - Seasonal Harmonic Cyclical Embeddings (sin/cos day-of-year)         │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   Spatial ML & Downscaling Engine                      │
  │  - Spatial GroupKFold CV (Zero station autocorrelation leakage)        │
  │  - Tree-Ensemble Variance & Quantile Uncertainty (90% CI)              │
  │  - Benchmark Comparison vs Spatial IDW Interpolation Baseline          │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │                     Interactive Dashboard & REST API                   │
  │  - Leaflet Map with GeoJSON Polygon Grids and Station Overlays         │
  │  - Point Prediction Workspace with Coordinate Picker & Export          │
  │  - Model Evaluation Suite (Observed vs Predicted, Residuals, Folds)    │
  │  - Dataset Explorer & Automated CSV/GeoJSON Schema Validator           │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, Scikit-learn, Pandas, NumPy, SciPy, Shapely, SQLite, Pytest, Uvicorn.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Leaflet, Recharts, Lucide React.
- **Geospatial Processing:** WGS84 Datum (EPSG:4326), Haversine Distance, Dynamic Polygon Grid Generator, GeoJSON Specification.

---

## 4. Quick Start & Execution Instructions

The project is structured into `backend/` and `frontend/` directories.

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### Step 1: Start Backend API
```bash
# In project root
.\backend\venv\Scripts\activate

# Install dependencies if needed:
pip install -r backend/requirements.txt

# Start FastAPI server on port 8000:
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
*The backend automatically initializes the SQLite database (`data/satellite_aq.db`), generates demonstration datasets, and pre-trains baseline Random Forest models on startup.*

- Backend API: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Health Endpoint: `http://127.0.0.1:8000/api/health`

### Step 2: Start Frontend Application
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend Web App: `http://localhost:5173`

---

## 5. Automated Testing Verification

The backend includes a comprehensive automated test suite testing health, connectors, spatial feature extraction, GroupKFold validation, downscaling uncertainty bounds, and schema validation.

```bash
# Run backend tests
& .\backend\venv\Scripts\pytest.exe .\backend\tests -v
```

**Test Results Passed:**
- `test_data_api.py`: Data source registry, CPCB station queries, paired observations
- `test_downscaler.py`: Haversine distance, single-location downscaling with uncertainty bounds, GeoJSON polygon grid generator
- `test_health.py`: Root health, database connectivity, demo mode status
- `test_ml_pipeline.py`: GroupKFold cross-validation by station, baseline IDW comparison, feature importances
- `test_predict_api.py`: Point prediction, domain boundary validation, prediction history, CSV/GeoJSON export
- `test_upload_validation.py`: Upload validation engine, coordinate boundaries, missing value detection

---

## 6. Dashboard Pages & Capabilities

| Page | Capabilities |
| :--- | :--- |
| **A. Overview** | Regional study extent (Delhi-NCR), 5 criteria pollutants ($\text{NO}_2$, $\text{PM}_{2.5}$, $\text{SO}_2$, $\text{CO}$, $\text{O}_3$), CPCB vs WHO guideline comparisons, real vs demo status banner. |
| **B. Interactive Map** | Pan/zoom Leaflet map with CartoDB dark tiles, 1-5 km downscaled polygon grids, station pins with AQI popup badges, uncertainty layer toggle, and missing-data cloud mask. |
| **C. Prediction Workspace** | Coordinate input with regional monitored presets, target resolution selection, model algorithm chooser, 90% confidence uncertainty intervals, and input provenance logging. |
| **D. Model Evaluation** | Out-of-fold $R^2$, MAE, RMSE, Mean Bias Error (MBE), baseline IDW comparison (+% accuracy gain), observed vs predicted scatter plot, residual error histogram, and on-demand retraining. |
| **E. Data Explorer** | CPCB monitor directory, matched observation pairs, registered dataset catalog, and CSV/GeoJSON upload validator with coordinate bounds and column checks. |
| **F. Research & About** | Physics of planetary boundary layer trapping, mathematical column-to-surface relationship, spatial cross-validation rationale, and academic citations. |

---

## 7. Connecting Real Copernicus & CPCB Data

By default, the application runs in a calibrated **Demonstration Mode** using realistic Delhi-NCR station geography and synthetic atmospheric observations. To switch to live feeds:

1. Register at the **Copernicus Data Space Ecosystem (CDSE)**: [dataspace.copernicus.eu](https://dataspace.copernicus.eu)
2. Generate an OAuth2 Client ID and Client Secret in your user profile.
3. Copy `.env.example` to `.env` in the project root:
   ```env
   COPERNICUS_CLIENT_ID="your_client_id_here"
   COPERNICUS_CLIENT_SECRET="your_client_secret_here"
   OPENAQ_API_KEY="your_openaq_key_here"
   ```
4. Restart the backend. The system will automatically switch from simulated feeds to live OData queries.

---

## 8. Documentation Index

- [Full University Project Report](docs/PROJECT_REPORT.md)
- [Downscaling & ML Methodology](docs/METHODOLOGY.md)
- [REST API Reference](docs/API.md)
- [Dataset Schema & Data Dictionary](docs/DATA_DICTIONARY.md)
- [Testing & Quality Assurance Guide](docs/TESTING.md)

---

## 9. Academic Citations

1. **Veefkind, J. P., et al. (2012).** *The Sentinel-5 Precursor mission and the TROPOMI instrument*. Atmospheric Measurement Techniques, 5(12), 2917-2937.
2. **Van Donkelaar, A., et al. (2021).** *Monthly Global Estimates of Fine Particulate Matter and Their Uncertainty*. Environmental Science & Technology, 55(22), 15287-15300.
3. **Central Pollution Control Board (2014).** *National Air Quality Index (NAQI) Standards*. Ministry of Environment, Forest and Climate Change, Govt of India.
4. **World Health Organization (2021).** *WHO Global Air Quality Guidelines: Particulate Matter, Ozone, Nitrogen Dioxide, Sulfur Dioxide and Carbon Monoxide*. Geneva: WHO.
