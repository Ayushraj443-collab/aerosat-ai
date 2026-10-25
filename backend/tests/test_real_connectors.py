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
    res = CopernicusSentinel5PConnector.download_product(
        product_id="dummy-product-id"
    )
    assert res["status"] == "BLOCKED"
    assert "COPERNICUS_CLIENT_ID" in res["message"] or "Credentials missing" in res["message"]

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
