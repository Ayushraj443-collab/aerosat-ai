import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_observations_from_db, count_observations

client = TestClient(app)

def test_database_isolation():
    """Verify that REAL and DEMO observations are cleanly partitioned in the database."""
    real_count = count_observations(data_mode="REAL")
    demo_count = count_observations(data_mode="DEMO")
    
    # We populated 896 real verified observations
    assert real_count > 0, "Expected verified real observations in the database"
    
    # Check that querying data_mode='REAL' returns records with data_mode == 'REAL'
    real_records = get_observations_from_db(data_mode="REAL", limit=20)
    for r in real_records:
        assert r["data_mode"] == "REAL"

def test_api_observations_mode_filtering():
    """Verify that /api/data/observations strictly respects the mode parameter."""
    res_real = client.get("/api/data/observations?mode=real&limit=10")
    assert res_real.status_code == 200
    real_data = res_real.json()
    assert len(real_data) > 0
    for item in real_data:
        assert item["data_mode"] == "REAL"
        assert item["is_demo"] is False

    res_demo = client.get("/api/data/observations?mode=demo&limit=10")
    assert res_demo.status_code == 200
    demo_data = res_demo.json()
    for item in demo_data:
        assert item["data_mode"] == "DEMO"
        assert item["is_demo"] is True

def test_prediction_api_mode_isolation():
    """Verify prediction endpoint runs with data_mode='REAL' and returns real provenance."""
    payload_real = {
        "latitude": 28.6476,
        "longitude": 77.3158,
        "date": "2024-01-01",
        "pollutant": "NO2",
        "target_resolution_km": 1.0,
        "data_mode": "REAL"
    }
    res_real = client.post("/api/predict", json=payload_real)
    assert res_real.status_code == 200
    data_real = res_real.json()
    assert data_real["provenance"]["data_mode"] == "REAL"
    assert data_real["provenance"]["is_demo"] is False
    assert "real" in data_real["model_info"]["model_id"].lower()

    # Now verify DEMO prediction mode
    payload_demo = {
        "latitude": 28.6476,
        "longitude": 77.3158,
        "date": "2024-03-01",
        "pollutant": "NO2",
        "target_resolution_km": 1.0,
        "data_mode": "DEMO"
    }
    res_demo = client.post("/api/predict", json=payload_demo)
    assert res_demo.status_code == 200
    data_demo = res_demo.json()
    assert data_demo["provenance"]["data_mode"] == "DEMO"
    assert data_demo["provenance"]["is_demo"] is True

def test_unsupported_pollutant_real_mode_error():
    """Verify that when real data is requested for an untrained/unavailable pollutant, it fails explicitly rather than falling back to demo data."""
    payload = {
        "latitude": 28.6476,
        "longitude": 77.3158,
        "date": "2024-03-01",
        "pollutant": "LEAD", # Unsupported pollutant
        "target_resolution_km": 1.0,
        "data_mode": "REAL"
    }
    res = client.post("/api/predict", json=payload)
    # Must reject unsupported pollutant with 400 Bad Request or 422 Validation Error
    assert res.status_code in [400, 422]
    assert "LEAD" in str(res.json()) or "pollutant" in str(res.json()).lower()

def test_downscaled_grid_mode_parameter():
    """Verify that /api/map/downscaled-grid accepts mode=real and mode=demo and includes provenance metadata."""
    res_real = client.get("/api/map/downscaled-grid?mode=real&pollutant=NO2&resolution_km=5.0")
    assert res_real.status_code == 200
    grid_real = res_real.json()
    assert grid_real["metadata"]["data_mode"] == "REAL"
    assert grid_real["metadata"]["is_demo"] is False

    res_demo = client.get("/api/map/downscaled-grid?mode=demo&pollutant=NO2&resolution_km=5.0")
    assert res_demo.status_code == 200
    grid_demo = res_demo.json()
    assert grid_demo["metadata"]["data_mode"] == "DEMO"
    assert grid_demo["metadata"]["is_demo"] is True

def test_prediction_export_formats():
    """Verify that prediction exports work for both CSV and GeoJSON."""
    # First create a prediction
    res = client.post("/api/predict", json={
        "latitude": 28.6139,
        "longitude": 77.2090,
        "date": "2024-01-01",
        "pollutant": "NO2",
        "target_resolution_km": 2.0,
        "data_mode": "REAL"
    })
    assert res.status_code == 200
    pred_id = res.json()["prediction_id"]

    # Export CSV
    res_csv = client.get(f"/api/export/{pred_id}?format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "estimated_value" in res_csv.text

    # Export GeoJSON
    res_geo = client.get(f"/api/export/{pred_id}?format=geojson")
    assert res_geo.status_code == 200
    assert "application/geo+json" in res_geo.headers["content-type"]
    assert res_geo.json()["type"] == "Feature"
