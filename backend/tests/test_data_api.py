import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_data_sources():
    response = client.get("/api/data/sources")
    assert response.status_code == 200
    sources = response.json()
    assert len(sources) >= 4
    source_ids = [s["id"] for s in sources]
    assert "sentinel-5p-tropomi" in source_ids
    assert "cpcb-ground-stations" in source_ids
    assert "open-meteo-weather" in source_ids
    assert "shuttle-radar-topography" in source_ids

def test_get_stations():
    response = client.get("/api/data/stations")
    assert response.status_code == 200
    stations = response.json()
    assert len(stations) >= 10
    first = stations[0]
    assert "station_id" in first
    assert "name" in first
    assert "latitude" in first
    assert "longitude" in first
    assert -90 <= first["latitude"] <= 90
    assert -180 <= first["longitude"] <= 180

def test_get_observations():
    response = client.get("/api/data/observations?pollutant=NO2&limit=10")
    assert response.status_code == 200
    obs = response.json()
    assert len(obs) <= 10
    if len(obs) > 0:
        record = obs[0]
        assert record["pollutant"] == "NO2"
        assert "ground_value" in record
        assert "satellite_column" in record
        assert "temperature_c" in record
        assert "boundary_layer_height_m" in record
