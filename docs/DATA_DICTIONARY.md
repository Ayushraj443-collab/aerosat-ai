# AeroSat-AI Data Dictionary & Feature Catalog

This document defines the data schema, physical units, acceptable ranges, and observational provenance for all environmental variables, features, and persistent database tables utilized within AeroSat-AI.

---

## 1. Primary Environmental Variables

| Variable Name | Description | Physical Unit | Valid Range | Source Provider | Physical Meaning |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `date` | Observation calendar date | ISO Date (`YYYY-MM-DD`) | 2018-present | All Providers | Timestamp for temporal synchronization |
| `station_id` | Unique station alphanumeric identifier | String | e.g. `DEL_ANAND_VIHAR` | CPCB / CAAQMS | Primary grouping key for spatial validation |
| `station_name` | Official public monitor name | String | Text | CPCB | Geographic shelter location descriptor |
| `latitude` | WGS84 geographic latitude | Decimal Degrees (°N) | $[20.0, 35.0]$ | GPS / Geocoding | North-South spatial coordinate |
| `longitude` | WGS84 geographic longitude | Decimal Degrees (°E) | $[68.0, 90.0]$ | GPS / Geocoding | East-West spatial coordinate |
| `pollutant` | Chemical or particulate criteria species | String | `NO2`, `PM2.5`, `SO2`, `CO`, `O3` | Registry | Target criteria pollutant |
| `ground_value` | Surface in-situ ambient concentration | $\mu\text{g/m}^3$ (mg/m³ for CO) | $[0.0, 1000.0]$ | CPCB In-Situ Monitor | Reference ground truth observation |
| `unit` | Measurement physical unit | String | $\mu\text{g/m}^3$, $\text{mg/m}^3$ | Standards | Regulatory metric |
| `satellite_column` | Vertically integrated column density | $10^{15}\ \text{molec/cm}^2$, DU, Index | $[0.0, 500.0]$ | Sentinel-5P / TROPOMI | Total or tropospheric atmospheric column |
| `satellite_qa` | Retrieval data quality value flag | Dimensionless $[0.0, 1.0]$ | $[0.0, 1.0]$ | Sentinel-5P L2 ATBD | Confidence metric ($<0.50$ = cloud/ice mask) |
| `temperature_c` | 2-meter ambient air temperature | Degrees Celsius (°C) | $[-10.0, 52.0]$ | Open-Meteo / ERA5 | Governs photochemical reaction kinetics |
| `relative_humidity_pct` | 2-meter relative air humidity | Percentage (%) | $[5.0, 100.0]$ | Open-Meteo / ERA5 | Governs secondary aerosol hygroscopic growth |
| `wind_speed_ms` | 10-meter horizontal wind speed | Meters per second (m/s) | $[0.0, 30.0]$ | Open-Meteo / ERA5 | Horizontal ventilation and dispersion rate |
| `wind_direction_deg` | 10-meter wind direction vector | Degrees Azimuth (° from North) | $[0.0, 360.0]$ | Open-Meteo / ERA5 | Advection transport trajectory |
| `boundary_layer_height_m` | Planetary boundary layer height | Meters Above Ground (m) | $[150.0, 3500.0]$ | ECMWF IFS / ERA5 | Vertical mixing volume depth |
| `ventilation_index` | Ventilation coefficient | $\text{m}^2/\text{s} \times 10^{-3}$ | $[0.1, 25.0]$ | Engineered | Product of BLH and wind speed |
| `elevation_m` | Surface topographic elevation | Meters MSL (m) | $[0.0, 4500.0]$ | NASA SRTM 30m DEM | Topographic drainage and pooling index |
| `road_density_proxy` | Urban vehicular activity index | Dimensionless $[0.0, 1.0]$ | $[0.0, 1.0]$ | OpenStreetMap Proxy | Proximity-weighted road network density |
| `day_sin`, `day_cos` | Cyclical day-of-year harmonics | Dimensionless $[-1.0, 1.0]$ | $[-1.0, 1.0]$ | Engineered | Continuous seasonal cyclicality encoding |
| `is_demo` | Flag indicating demonstration data | Boolean | `true` / `false` | System Engine | Distinguishes synthetic from live feeds |

---

## 2. Satellite Atmospheric Products Specification

### 2.1 Nitrogen Dioxide ($\text{NO}_2$)
- **Product:** Sentinel-5P L2 Tropospheric $\text{NO}_2$ (`S5P_L2_NO2____`)
- **Native Footprint:** $5.5\text{ km} \times 3.5\text{ km}$ at nadir
- **Physical Unit:** $10^{15}\ \text{molecules/cm}^2$ (or $\mu\text{mol/m}^2$)
- **Recommended QA Threshold:** $\text{QA} \ge 0.50$ (excludes cloud radiance fraction $> 0.5$ and snow/ice)
- **CPCB Regulatory Standard (24-hour):** $80\ \mu\text{g/m}^3$ | **WHO 2021 Guideline:** $25\ \mu\text{g/m}^3$

### 2.2 Fine Particulate Matter ($\text{PM}_{2.5}$)
- **Product:** Sentinel-5P Ultraviolet Aerosol Index (UVAI) & Tropospheric Aerosol Absorbing Layer
- **Physical Unit:** Aerosol Index (dimensionless)
- **CPCB Regulatory Standard (24-hour):** $60\ \mu\text{g/m}^3$ | **WHO 2021 Guideline:** $15\ \mu\text{g/m}^3$

### 2.3 Sulfur Dioxide ($\text{SO}_2$)
- **Product:** Sentinel-5P L2 Total Column $\text{SO}_2$ (`S5P_L2_SO2____`)
- **Physical Unit:** Dobson Units (DU, where $1\text{ DU} \approx 2.69 \times 10^{16}\ \text{molecules/cm}^2$)
- **CPCB Regulatory Standard (24-hour):** $80\ \mu\text{g/m}^3$ | **WHO 2021 Guideline:** $40\ \mu\text{g/m}^3$

### 2.4 Carbon Monoxide ($\text{CO}$)
- **Product:** Sentinel-5P L2 Total Column $\text{CO}$ (`S5P_L2_CO_____`)
- **Physical Unit:** $10^{18}\ \text{molecules/cm}^2$
- **CPCB Regulatory Standard (8-hour):** $2.0\ \text{mg/m}^3$ | **WHO 2021 Guideline:** $4.0\ \text{mg/m}^3$

### 2.5 Tropospheric Ozone ($\text{O}_3$)
- **Product:** Sentinel-5P L2 Tropospheric Column $\text{O}_3$ (`S5P_L2_O3_TCL`)
- **Physical Unit:** Dobson Units (DU)
- **CPCB Regulatory Standard (8-hour):** $100\ \mu\text{g/m}^3$ | **WHO 2021 Guideline:** $100\ \mu\text{g/m}^3$

---

## 3. Persistent SQLite Database Schema

### Table: `predictions_history`
Stores point inferences executed through the interactive dashboard or API.

```sql
CREATE TABLE predictions_history (
    id TEXT PRIMARY KEY,               -- e.g. pred_20261025211530_102
    timestamp TEXT NOT NULL,           -- ISO8601 execution time
    latitude REAL NOT NULL,            -- Decimal degrees
    longitude REAL NOT NULL,           -- Decimal degrees
    date TEXT NOT NULL,                -- YYYY-MM-DD
    pollutant TEXT NOT NULL,           -- NO2, PM2.5, SO2, CO, O3
    target_resolution REAL NOT NULL,   -- km (1.0, 2.0, 5.0)
    estimated_value REAL NOT NULL,     -- Inferred surface concentration
    unit TEXT NOT NULL,                -- µg/m³ or mg/m³
    uncertainty_lower REAL NOT NULL,   -- 90% CI lower bound
    uncertainty_upper REAL NOT NULL,   -- 90% CI upper bound
    model_version TEXT NOT NULL,       -- Registered model identifier
    is_demo INTEGER NOT NULL DEFAULT 1,-- 1 for demo mode, 0 for live
    provenance_json TEXT               -- Full input features and metadata
);
```

### Table: `uploaded_datasets`
Tracks user-uploaded CSV and GeoJSON files and their validation status.

```sql
CREATE TABLE uploaded_datasets (
    id TEXT PRIMARY KEY,               -- ds_xxxxxx
    filename TEXT NOT NULL,            -- Original file name
    uploaded_at TEXT NOT NULL,         -- Upload timestamp
    row_count INTEGER NOT NULL,        -- Total records
    columns_json TEXT NOT NULL,        -- Detected column list
    bounding_box_json TEXT,            -- Min/Max Lat & Lon
    pollutant TEXT,                    -- Detected pollutant
    is_valid INTEGER NOT NULL,         -- 1 if valid, 0 if schema warning
    summary_json TEXT                  -- Missing values and messages
);
```

### Table: `model_registry`
Maintains operational models, spatial cross-validation scores, and hyperparameter logs.

```sql
CREATE TABLE model_registry (
    model_id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    target_pollutant TEXT NOT NULL,
    trained_at TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    train_samples INTEGER NOT NULL,
    val_samples INTEGER NOT NULL,
    mae REAL NOT NULL,
    rmse REAL NOT NULL,
    r2 REAL NOT NULL,
    baseline_mae REAL,
    baseline_rmse REAL,
    baseline_r2 REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 1,
    hyperparams_json TEXT,
    feature_names_json TEXT
);
```
