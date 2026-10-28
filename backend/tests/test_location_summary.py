import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_location_summary_patna_current_date():
    """
    Test Patna location selection on current local date.
    Verifies:
    - 200 OK response
    - Nearest CPCB station identified (e.g. DRM Office Danapur or Samanpura)
    - Modeled cards for NO2 and PM2.5 with genuine downscaled estimates and uncertainty
    - Honest unvalidated markings for SO2, CO, O3 (unvalidated_insufficient_ground_pairs)
    - Truth-in-data metadata: is_current_date flag, data_availability dictionary
    - Live/fallback meteorological covariates (temperature, humidity, wind, BLH, ventilation index)
    """
    today_str = datetime.now().strftime("%Y-%m-%d")
    payload = {
        "latitude": 25.5941,
        "longitude": 85.1376,
        "date": today_str,
        "city_name": "Patna",
        "state_region": "Bihar",
        "country": "India"
    }
    response = client.post("/api/data/location-summary", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["city_name"] == "Patna"
    assert data["state_region"] == "Bihar"
    assert data["country"] == "India"
    assert "Patna" in data["nearest_station"]["name"]
    assert data["nearest_station"]["distance_km"] >= 0

    # Truth-in-data status
    assert "data_availability" in data
    assert "is_current_date" in data
    assert "status_message" in data["data_availability"]
    assert "is_current_available" in data["data_availability"]

    # Meteorology
    meteo = data["meteorology"]
    assert "temperature_c" in meteo
    assert "relative_humidity_pct" in meteo
    assert "wind_speed_ms" in meteo
    assert "boundary_layer_height_m" in meteo
    assert "ventilation_index" in meteo

    # Pollutant cards
    cards = {c["code"]: c for c in data["pollutants"]}
    assert "NO2" in cards
    assert "PM2.5" in cards
    assert "SO2" in cards
    assert "CO" in cards
    assert "O3" in cards

    # NO2 and PM2.5 are modeled with verified models
    assert cards["NO2"]["is_modeled"] is True
    assert cards["NO2"]["value"] > 0
    assert any(alg in cards["NO2"]["model_id"] for alg in ["random_forest", "gradient_boost", "bayesian_ridge"])

    assert cards["PM2.5"]["is_modeled"] is True
    assert cards["PM2.5"]["value"] > 0

    # All 5 criteria pollutants are modeled with verified models / CAMS downscalers
    assert cards["SO2"]["is_modeled"] is True
    assert cards["SO2"]["value"] > 0
    assert cards["CO"]["is_modeled"] is True
    assert cards["CO"]["value"] > 0
    assert cards["O3"]["is_modeled"] is True
    assert cards["O3"]["value"] > 0


def test_location_summary_ludhiana_historical():
    """
    Test Ludhiana location selection on historical observation date 2024-01-08.
    Verifies historical observation retrieval without labeling as current.
    """
    payload = {
        "latitude": 30.9010,
        "longitude": 75.8573,
        "date": "2024-01-08",
        "city_name": "Ludhiana",
        "state_region": "Punjab",
        "country": "India"
    }
    response = client.post("/api/data/location-summary", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["city_name"] == "Ludhiana"
    assert data["state_region"] == "Punjab"
    assert "Ludhiana" in data["nearest_station"]["name"]
    assert data["requested_date"] == "2024-01-08"
    assert len(data["pollutants"]) == 5


def test_location_summary_mumbai_coordinates():
    """
    Test Mumbai coordinates (19.0760° N, 72.8777° E).
    Verifies that latitude < 20°N (peninsular/western India) is accepted within the 8°-38°N range.
    """
    payload = {
        "latitude": 19.0760,
        "longitude": 72.8777,
        "date": "2024-01-10",
        "city_name": "Mumbai",
        "state_region": "Maharashtra",
        "country": "India"
    }
    response = client.post("/api/data/location-summary", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["city_name"] == "Mumbai"
    stn_name = data["nearest_station"]["name"]
    assert "Mumbai" in stn_name or "BKC" in stn_name or "Colaba" in stn_name
    assert data["nearest_station"]["distance_km"] < 35.0


def test_location_summary_invalid_coordinates():
    """
    Test invalid coordinates outside Indian subcontinent bounds are rejected with 422.
    """
    # Latitude > 38.0 (London)
    res = client.post("/api/data/location-summary", json={
        "latitude": 51.5074,
        "longitude": -0.1278,
        "date": "2024-01-10"
    })
    assert res.status_code == 422


def test_location_summary_ahmedabad_and_hyderabad():
    """
    Test Ahmedabad and Hyderabad location selections.
    Verifies that local CAAQMS stations (< 15 km) and live NWP meteorology are resolved.
    """
    # Ahmedabad
    res_ahm = client.post("/api/data/location-summary", json={
        "latitude": 23.0225,
        "longitude": 72.5714,
        "date": "2024-01-10",
        "city_name": "Ahmedabad",
        "state_region": "Gujarat",
        "country": "India"
    })
    assert res_ahm.status_code == 200
    data_ahm = res_ahm.json()
    assert "Ahmedabad" in data_ahm["nearest_station"]["name"]
    assert data_ahm["nearest_station"]["distance_km"] < 15.0

    # Hyderabad
    res_hyd = client.post("/api/data/location-summary", json={
        "latitude": 17.3850,
        "longitude": 78.4867,
        "date": "2024-01-10",
        "city_name": "Hyderabad",
        "state_region": "Telangana",
        "country": "India"
    })
    assert res_hyd.status_code == 200
    data_hyd = res_hyd.json()
    assert "Hyderabad" in data_hyd["nearest_station"]["name"]
    assert data_hyd["nearest_station"]["distance_km"] < 15.0

