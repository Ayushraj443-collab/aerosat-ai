import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_predict_valid_request():
    payload = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "date": "2024-03-01",
        "pollutant": "NO2",
        "target_resolution_km": 1.0,
        "model_algorithm": "random_forest"
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction_id" in data
    assert data["pollutant"] == "NO2"
    assert data["estimated_value"] > 0
    assert "uncertainty" in data
    assert "provenance" in data

    # Test retrieving it from history
    hist_resp = client.get("/api/predictions/history")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) > 0
    assert any(h["id"] == data["prediction_id"] for h in history)

    # Test export CSV
    pred_id = data["prediction_id"]
    csv_resp = client.get(f"/api/export/{pred_id}?format=csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers.get("content-type", "")

    # Test export GeoJSON
    geojson_resp = client.get(f"/api/export/{pred_id}?format=geojson")
    assert geojson_resp.status_code == 200
    assert "application/geo+json" in geojson_resp.headers.get("content-type", "")

def test_predict_out_of_bounds_coordinate():
    payload = {
        "latitude": 5.0,  # Far outside India domain (20-35)
        "longitude": 77.0,
        "date": "2024-03-01",
        "pollutant": "NO2"
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422
    assert "outside the regional domain" in response.json()["detail"]
