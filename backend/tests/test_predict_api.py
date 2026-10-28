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
        "latitude": 5.0,  # Far outside India domain (8-38)
        "longitude": 77.0,
        "date": "2024-03-01",
        "pollutant": "NO2"
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 422
    assert "outside the regional domain" in response.json()["detail"]

def test_prediction_history_provenance_verification():
    """Verify that predictions history returns rigorous provenance_status (REAL, DEMO, or UNVERIFIED)."""
    resp = client.get("/api/predictions/history?limit=25")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) > 0
    
    for item in history:
        assert "provenance_status" in item
        assert item["provenance_status"] in ["REAL", "DEMO", "UNVERIFIED"]
        assert "data_mode" in item
        assert "is_demo" in item
        
        # Rigorous check: if REAL, must have verified date and valid satellite pixel
        if item["provenance_status"] == "REAL":
            assert item["pollutant"] == "NO2"
            assert item["data_mode"] == "REAL"
            assert item["is_demo"] is False
            prov = item.get("provenance", {})
            assert prov.get("satellite_column_value") is not None
            assert prov.get("satellite_column_value") > 0
            assert "Simulated" not in prov.get("satellite_product", "")
            
        if item["provenance_status"] == "DEMO":
            assert item["is_demo"] is True or item["data_mode"] == "DEMO" or "Simulated" in item.get("provenance", {}).get("satellite_product", "")

def test_prediction_detail_endpoint():
    """Verify that GET /api/predictions/{id} returns full prediction details."""
    hist_resp = client.get("/api/predictions/history?limit=1")
    assert hist_resp.status_code == 200
    first_item = hist_resp.json()[0]
    
    detail_resp = client.get(f"/api/predictions/{first_item['id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["prediction_id"] == first_item["id"]
    assert detail["estimated_value"] == first_item["estimated_value"]
    assert detail["provenance_status"] in ["REAL", "DEMO", "UNVERIFIED"]
    assert "provenance" in detail
    assert "model_info" in detail

def test_predict_real_verified_granule_and_pending_date():
    """Verify REAL mode prediction behavior for verified vs unverified/pending dates."""
    # 1. Verified date: 2024-01-01 (Anand Vihar)
    real_payload = {
        "latitude": 28.6476,
        "longitude": 77.3158,
        "date": "2024-01-01",
        "pollutant": "NO2",
        "target_resolution_km": 1.0,
        "data_mode": "REAL"
    }
    real_resp = client.post("/api/predict", json=real_payload)
    assert real_resp.status_code == 200
    real_data = real_resp.json()
    assert real_data["status"] == "COMPLETED"
    assert real_data["result_type"] == "MODEL_ESTIMATE"
    assert real_data["estimated_value"] is not None
    assert real_data["estimated_value"] > 0
    assert real_data["provenance"]["satellite_column_value"] is not None
    assert real_data["provenance"]["satellite_column_value"] > 0
    assert real_data["provenance"]["satellite_unit"] == "10¹⁵ molec/cm²"
    assert real_data["provenance"]["satellite_qa_value"] is not None
    assert real_data["provenance"]["satellite_qa_value"] >= 0.50
    assert "S5P_OFFL" in real_data["provenance"]["satellite_granule"]

    # 2. Date outside local S5P L2 archive: 2024-03-01 -> Copernicus CAMS downscaling
    pending_payload = {
        "latitude": 28.6476,
        "longitude": 77.3158,
        "date": "2024-03-01",
        "pollutant": "NO2",
        "target_resolution_km": 1.0,
        "data_mode": "REAL"
    }
    pend_resp = client.post("/api/predict", json=pending_payload)
    assert pend_resp.status_code == 200
    pend_data = pend_resp.json()
    assert pend_data["status"] == "COMPLETED"
    assert pend_data["estimated_value"] is not None
    assert pend_data["estimated_value"] > 0
    assert "COPERNICUS" in pend_data["provenance"]["provenance_status"] or "CAMS" in pend_data["provenance"]["provenance_status"]

