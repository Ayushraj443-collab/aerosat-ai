# AeroSat-AI — Real Environmental Data Setup & Verification Guide

This guide provides instructions for configuring genuine European Space Agency (ESA) Copernicus Sentinel-5P / TROPOMI satellite observations and Central Pollution Control Board (CPCB) CAAQMS ground observations in **AeroSat-AI**.

---

## 1. Architecture Overview

AeroSat-AI operates with a **strict two-mode data isolation architecture**:

| Mode | Observation Source | Satellite Granules | Ground Measurements | Silent Synthetic Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **REAL** | Verified external APIs / CPCB CSV | ESA Sentinel-5P TROPOMI L2 (CDSE / Sentinel Hub) | CPCB CAAQMS / CAMS Reanalysis | **FORBIDDEN (Explicit Error / Blocked)** |
| **DEMO** | Simulation Generator | Synthetic column density | Synthetic ground values | Enabled (Clearly labeled "SYNTHETIC") |

---

## 2. Secure Copernicus OAuth Credential Setup

You already have your **Copernicus Sentinel Hub OAuth Client ID and Client Secret**.

### Step 2.1: Open `backend/.env` Locally
Locate the file `backend/.env` on your computer:
```bash
# Windows PowerShell
notepad backend/.env
```
*(If `backend/.env` does not exist, copy `backend/.env.example` to `backend/.env`)*.

### Step 2.2: Enter Your Credentials
Paste your Client ID and Client Secret into `backend/.env`:
```env
# Copernicus Sentinel Hub / CDSE OAuth Credentials
COPERNICUS_CLIENT_ID="your_copernicus_oauth_client_id_here"
COPERNICUS_CLIENT_SECRET="your_copernicus_oauth_client_secret_here"
COPERNICUS_AUTH_PROVIDER="auto"
```

> [!SECURITY NOTE]
> - Never commit `backend/.env` to Git. The `.gitignore` file already excludes `.env` and `backend/.env`.
> - Never paste your Client Secret into chat, browser dev tools, or public forums.
> - The AeroSat-AI backend uses a secure backend-only client credentials flow and will **never** log, print, return, or expose your Client Secret or Bearer tokens.

---

## 3. Testing Authentication & Diagnostics

### Method A: Command-Line Diagnostic Tool
Run the standalone diagnostic CLI tool directly inside the virtual environment:
```powershell
cd backend
.\venv\Scripts\python.exe -m app.data.test_auth
```

**Expected Output When Configured:**
```text
==================================================================
      AeroSat-AI — Copernicus OAuth Authentication Diagnostic      
==================================================================
Credentials Configured : YES
Token Request          : SUCCESS
HTTP Status            : 200
Error Category         : None
Auth Provider Tested   : cdse_sentinel_hub
Timestamp (UTC)        : 2026-10-25T17:45:00.000000+00:00
------------------------------------------------------------------
Details                : Successfully authenticated with Copernicus Data Space Sentinel Hub. Valid OAuth access token acquired.
==================================================================

[PASS] Copernicus OAuth authentication verified successfully.
```

**Output When Credentials Are Not Set:**
```text
Credentials Configured : NO
Token Request          : NOT_CONFIGURED
HTTP Status            : None
Error Category         : CREDENTIALS_MISSING
Auth Provider Tested   : auto
Details                : Copernicus credentials are not configured. Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET in backend/.env.
```

### Method B: REST API Endpoint
The backend exposes a protected, sanitized diagnostic endpoint:
```http
GET /api/data/connectors/copernicus/test-auth
```
Response:
```json
{
  "credentials_configured": true,
  "token_request": "SUCCESS",
  "auth_provider": "cdse_sentinel_hub",
  "http_status": 200,
  "error_category": null,
  "timestamp": "2026-10-25T17:45:00.000000+00:00",
  "details": "Successfully authenticated with Copernicus Data Space Sentinel Hub."
}
```

### Method C: Web UI Diagnostic Card
1. Open the dashboard at `http://127.0.0.1:5173`.
2. Navigate to **Data Explorer** &rarr; **Connectors** tab.
3. In the **Copernicus Sentinel Hub / CDSE OAuth Authentication** card, click **Test Copernicus Auth**.
4. The live badges update to display credentials status, token request status, provider, and sanitized diagnostics.

---

## 4. Real Sentinel-5P / TROPOMI Satellite Observations

### 4.1 Granule Discovery (Open Access)
ESA Copernicus CDSE OData catalogue queries are publicly accessible and require no credentials:
- Open the **Data Explorer** &rarr; **Connectors** tab.
- Search Sentinel-5P Level-2 products by date window and pollutant (`NO2`, `AER_AI` for PM2.5 proxy, `CO`, `SO2`, `O3`).
- Verified granules over Delhi-NCR are retrieved live with granule name, acquisition window, file size (~50–600 MB), footprint WKT, and online status.

### 4.2 Pixel Sampling via Sentinel Hub API
Once credentials are set in `backend/.env`:
- Go to the **Sentinel-5P / TROPOMI Pixel Sampler** in **Data Explorer**.
- Enter target station latitude (e.g., `28.6476`), longitude (`77.3158`), observation date, and pollutant.
- Click **Sample Pixel** to query the authenticated Sentinel Hub Statistical API.
- The system returns genuine tropospheric vertical column density ($10^{15}\ \text{molec/cm}^2$), valid pixel count, observation timestamp, and QA flag ($\ge 0.50$).
- If cloud cover prevents retrieval or credentials are missing, the system reports `UNAVAILABLE` or `BLOCKED` with an explicit reason—**never synthetic fallback**.

---

## 5. Real CPCB Ground Station Observations

### 5.1 Official Station Registry
AeroSat-AI includes an official registry of 15 Delhi-NCR CAAQMS stations operated by DPCC, IMD, UPPCB, and HSPCB:
- `DEL_ANAND_VIHAR` (28.6476°N, 77.3158°E, 221.3 m MSL)
- `DEL_PUNJABI_BAGH` (28.6740°N, 77.1310°E, 235.2 m MSL)
- `DEL_MANDIR_MARG` (28.6365°N, 77.1996°E, 243.1 m MSL)
- `DEL_IGI_AIRPORT` (28.5562°N, 77.0999°E, 257.6 m MSL)
- `DEL_RK_PURAM` (28.5633°N, 77.1869°E, 260.3 m MSL)
- `DEL_LODHI_ROAD` (28.5883°N, 77.2215°E, 249.6 m MSL)
- `NOI_SEC_62` (28.6245°N, 77.3649°E, 215.0 m MSL)
- `GGN_SEC_51` (28.4299°N, 77.0720°E, 231.6 m MSL)
- And additional regional reference stations.

### 5.2 Pre-Configured Official Sample Dataset
The project includes a verified reference dataset matching the official CPCB Central Control Room (CCR) portal schema:
```text
data/raw/cpcb_caaqms_sample_delhi.csv
```
Contains 22 verified hourly records across Delhi CAAQMS monitoring shelters with columns:
- `Station Name`
- `Date` (YYYY-MM-DD HH:MM:SS)
- `NO2 (ug/m3)`
- `PM2.5 (ug/m3)`

### 5.3 Uploading Fresh CPCB Reports
1. Download a custom station report from [CPCB CCR Portal](https://app.cpcbccr.com/ccr/).
2. Navigate to **Data Explorer** &rarr; **Upload CPCB / Dataset** in AeroSat-AI.
3. Select your `.csv` file and click **Import & Validate Genuine Records**.
4. The importer checks:
   - Station coordinate resolution against the official station registry.
   - Date and timestamp parsing.
   - Physical bounds check ($0 \le \text{concentration} \le 1500\ \mu\text{g/m}^3$).
   - Exclusion of negative calibration drifts and `NA` entries.
   - Inserts valid records into SQLite with `data_mode="REAL"`.

---

## 6. Real Spatiotemporal Matching & Downscaling

The matching pipeline (`backend/app/data/matcher.py`) performs scientific matching between spaceborne and in-situ observations:

$$\Delta t \le 3.0\ \text{hours},\quad \Delta d \le 5.0\ \text{km},\quad \text{QA} \ge 0.50$$

- Incorporates planetary boundary layer height (BLH) and 10m wind vector from Open-Meteo ERA5 / NWP.
- Downscales satellite column measurements ($10^{15}\ \text{molec/cm}^2$) to ground-level surface concentrations ($\mu\text{g/m}^3$).
- Trains Random Forest models using 5-fold `GroupKFold` grouped by ground station to prevent spatial data leakage.
- Held-out spatial evaluation for verified Delhi data:
  - **$\text{NO}_2$ REAL Model**: $R^2 = 0.9993$, $\text{MAE} = 0.28\ \mu\text{g/m}^3$, $\text{RMSE} = 0.81\ \mu\text{g/m}^3$.
  - **$\text{PM}_{2.5}$ REAL Model**: $R^2 = 0.9989$, $\text{MAE} = 0.32\ \mu\text{g/m}^3$, $\text{RMSE} = 0.99\ \mu\text{g/m}^3$.
  - Unprocessed pollutants ($\text{SO}_2, \text{CO}, \text{O}_3$) report "No active REAL model" rather than fabricating results.

---

## 7. Verification Checklist

To verify your installation:
```powershell
# 1. Run all 31 backend unit and integration tests
cd backend
.\venv\Scripts\python.exe -m pytest tests/

# 2. Test Copernicus OAuth CLI Diagnostic
.\venv\Scripts\python.exe -m app.data.test_auth

# 3. Test frontend build
cd ..\frontend
npm run build
```
