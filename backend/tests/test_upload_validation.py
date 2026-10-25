import pytest
import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_upload_valid_csv():
    csv_content = (
        "date,latitude,longitude,station_name,no2,temperature_c\n"
        "2024-03-01,28.61,77.20,Delhi Central,45.2,26.5\n"
        "2024-03-02,28.62,77.21,Delhi North,52.1,27.1\n"
    )
    files = {"file": ("test_air_quality.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert data["row_count"] == 2
    assert "latitude" in data["columns"]
    assert "no2" in data["columns"]

def test_upload_missing_coordinates_csv():
    csv_content = (
        "date,station_name,no2,temperature_c\n"
        "2024-03-01,Delhi Central,45.2,26.5\n"
    )
    files = {"file": ("invalid_no_coords.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert any("Missing required coordinate columns" in msg for msg in data["validation_messages"])
