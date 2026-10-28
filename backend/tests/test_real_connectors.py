import pytest
from app.data.connectors import (
    CopernicusSentinel5PConnector,
    OpenMeteoWeatherConnector,
    CopernicusCAMSAirQualityConnector,
    CPCBCSVImporter,
    OpenAQConnector,
)

def test_sentinel5p_catalogue_discovery():
    """Verify live ESA Copernicus Data Space Ecosystem OData API product discovery."""
    res = CopernicusSentinel5PConnector.query_products(
        pollutant="NO2",
        start_date="2024-01-01",
        end_date="2024-01-15",
        min_lat=28.3,
        max_lat=28.9,
        min_lon=76.9,
        max_lon=77.5,
        top=3
    )
    assert res["status"] == "SUCCESS", f"OData query failed: {res.get('error')}"
    assert res["total_found"] >= 1
    assert len(res["products"]) >= 1
    granule = res["products"][0]
    assert "S5P_" in granule["granule_name"]
    assert "product_id" in granule
    assert granule["pollutant"] == "NO2"
    assert res["auth_required_for_download"] is True

def test_sentinel5p_download_blocked_without_credentials():
    """Verify that downloading a granule binary without credentials is reported as BLOCKED with instructions."""
    from app.config import settings
    old_id = settings.COPERNICUS_CLIENT_ID
    old_secret = settings.COPERNICUS_CLIENT_SECRET
    try:
        settings.COPERNICUS_CLIENT_ID = ""
        settings.COPERNICUS_CLIENT_SECRET = ""
        res = CopernicusSentinel5PConnector.download_product(
            product_id="dummy-product-id"
        )
        assert res["status"] == "BLOCKED"
        assert "COPERNICUS_CLIENT_ID" in res["message"] or "Credentials missing" in res["message"]
    finally:
        settings.COPERNICUS_CLIENT_ID = old_id
        settings.COPERNICUS_CLIENT_SECRET = old_secret

def test_open_meteo_weather_connector():
    """Verify live Open-Meteo ERA5 / NWP weather query."""
    res = OpenMeteoWeatherConnector.fetch_historical(
        lat=28.6139,
        lon=77.2090,
        start_date="2024-01-01",
        end_date="2024-01-02"
    )
    assert "temperature_2m" in res
    assert "relative_humidity_2m" in res
    assert "wind_speed_10m" in res
    assert len(res["temperature_2m"]) >= 24

    # Current / NWP forecast with Boundary Layer Height
    curr = OpenMeteoWeatherConnector.fetch_current(lat=28.6139, lon=77.2090)
    assert "boundary_layer_height" in curr
    assert len(curr["boundary_layer_height"]) > 0

def test_copernicus_cams_air_quality_connector():
    """Verify live Copernicus CAMS surface air quality reanalysis query."""
    res = CopernicusCAMSAirQualityConnector.fetch_surface_observations(
        lat=28.6139,
        lon=77.2090,
        start_date="2024-01-01",
        end_date="2024-01-02"
    )
    assert "pm2_5" in res
    assert "nitrogen_dioxide" in res
    assert len(res["pm2_5"]) >= 24

def test_openaq_connector_status():
    """Verify OpenAQ v3 connector reports BLOCKED if credentials not configured."""
    res = OpenAQConnector.check_status()
    assert res["status"] in ["BLOCKED", "VERIFIED"]
    if res["status"] == "BLOCKED":
        assert "OPENAQ_API_KEY" in res["message"]

def test_cpcb_csv_importer_valid():
    """Verify standardized CPCB CAAQMS CSV parser with valid content."""
    csv_content = """Station Name,Date,NO2 (ug/m3)
Anand Vihar,2024-01-10 10:00:00,55.4
Anand Vihar,2024-01-10 11:00:00,62.1
Connaught Place,2024-01-10 10:00:00,41.8
"""
    import io
    buf = io.StringIO(csv_content)
    res = CPCBCSVImporter.import_cpcb_csv(buf, pollutant="NO2")
    assert res["status"] == "SUCCESS"
    assert res["imported_records"] == 3
    assert res["pollutant"] == "NO2"

def test_cpcb_csv_importer_missing_columns():
    """Verify standardized CPCB CSV importer rejects malformed files missing required columns."""
    csv_content = """ColA,ColB,ColC
1,2,3
"""
    import io
    buf = io.StringIO(csv_content)
    res = CPCBCSVImporter.import_cpcb_csv(buf, pollutant="NO2")
    assert res["status"] == "VALIDATION_FAILED"
    assert "Missing required columns" in res["error"]

def test_copernicus_oauth_manager_unconfigured():
    """Verify CopernicusOAuthManager diagnostic returns NOT_CONFIGURED when credentials are empty."""
    from app.data.connectors import CopernicusOAuthManager
    from app.config import settings

    # Ensure empty for test
    old_id = settings.COPERNICUS_CLIENT_ID
    old_secret = settings.COPERNICUS_CLIENT_SECRET
    try:
        settings.COPERNICUS_CLIENT_ID = ""
        settings.COPERNICUS_CLIENT_SECRET = ""
        diag = CopernicusOAuthManager.test_connection()
        assert diag["credentials_configured"] is False
        assert diag["token_request"] == "NOT_CONFIGURED"
        assert diag["error_category"] == "CREDENTIALS_MISSING"
        assert "COPERNICUS_CLIENT_ID" in diag["details"]
    finally:
        settings.COPERNICUS_CLIENT_ID = old_id
        settings.COPERNICUS_CLIENT_SECRET = old_secret

def test_copernicus_oauth_manager_mock_success(monkeypatch):
    """Verify CopernicusOAuthManager handles successful token responses without leaking credentials."""
    from app.data.connectors import CopernicusOAuthManager
    from app.config import settings
    import urllib.request
    import json
    import io

    class MockResponse:
        status = 200
        def read(self):
            return json.dumps({
                "access_token": "mocked-test-bearer-token",
                "expires_in": 3600,
                "token_type": "Bearer"
            }).encode("utf-8")
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout=15: MockResponse())
    old_id = settings.COPERNICUS_CLIENT_ID
    old_secret = settings.COPERNICUS_CLIENT_SECRET
    try:
        settings.COPERNICUS_CLIENT_ID = "test-client-id"
        settings.COPERNICUS_CLIENT_SECRET = "test-client-secret"
        diag = CopernicusOAuthManager.test_connection()
        assert diag["credentials_configured"] is True
        assert diag["token_request"] == "SUCCESS"
        assert diag["http_status"] == 200
        assert diag["error_category"] is None
        # Verify secrets are NOT leaked in output
        assert "test-client-secret" not in json.dumps(diag)
        assert "mocked-test-bearer-token" not in json.dumps(diag)
    finally:
        settings.COPERNICUS_CLIENT_ID = old_id
        settings.COPERNICUS_CLIENT_SECRET = old_secret

def test_copernicus_fetch_observation_blocked_without_auth():
    """Verify that fetch_sentinel5p_observation returns BLOCKED without credentials."""
    from app.data.connectors import CopernicusSentinel5PConnector
    from app.config import settings

    old_id = settings.COPERNICUS_CLIENT_ID
    old_secret = settings.COPERNICUS_CLIENT_SECRET
    try:
        settings.COPERNICUS_CLIENT_ID = ""
        settings.COPERNICUS_CLIENT_SECRET = ""
        res = CopernicusSentinel5PConnector.fetch_sentinel5p_observation(28.6476, 77.3158, "2024-01-05", "NO2")
        assert res["status"] == "BLOCKED"
        assert res["data"] is None
        assert "OAuth credentials required" in res["message"]
    finally:
        settings.COPERNICUS_CLIENT_ID = old_id
        settings.COPERNICUS_CLIENT_SECRET = old_secret

def test_copernicus_test_auth_api():
    """Verify GET /api/data/connectors/copernicus/test-auth returns valid sanitized schema."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.get("/api/data/connectors/copernicus/test-auth")
    assert res.status_code == 200
    data = res.json()
    assert "credentials_configured" in data
    assert "token_request" in data
    assert "auth_provider" in data
    assert "timestamp" in data
    assert "details" in data

def test_sample_cpcb_file_import():
    """Verify that the official sample file data/raw/cpcb_caaqms_sample_delhi.csv imports successfully."""
    from app.config import settings
    sample_file = settings.DATA_RAW_DIR / "cpcb_caaqms_sample_delhi.csv"
    assert sample_file.exists(), f"Expected sample file at {sample_file}"
    
    with open(sample_file, "r") as f:
        res = CPCBCSVImporter.import_cpcb_csv(f, pollutant="NO2")
    assert res["status"] == "SUCCESS"
    assert res["imported_records"] >= 20
    assert res["pollutant"] == "NO2"

