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

def test_get_observations_matched_only_real():
    """Verify matched_only=true returns strictly genuine satellite-ground pairs with real non-zero column values."""
    response = client.get("/api/data/observations?mode=real&matched_only=true&pollutant=NO2&limit=50")
    assert response.status_code == 200
    records = response.json()
    assert len(records) > 0, "Expected genuine matched observation records in REAL mode"
    for r in records:
        assert r["data_mode"] == "REAL"
        assert r["satellite_column"] is not None, "Matched observations must have non-null satellite column"
        assert r["satellite_column"] > 0, "Satellite column must not be zero"
        assert r["satellite_qa"] is not None
        assert r["satellite_qa"] >= 0.50
        # Check source provenance confirms genuine Sentinel-5P pairing
        assert "Sentinel-5P" in r["source_name"]

def test_missing_satellite_values_serialization():
    """Verify that records without satellite measurements serialize satellite_column and satellite_qa as null, NEVER 0.0 or 0.9."""
    response = client.get("/api/data/observations?mode=real&matched_only=false&limit=100")
    assert response.status_code == 200
    records = response.json()
    assert len(records) > 0
    # Find CAMS or CPCB ground-only records
    unmatched = [r for r in records if "Sentinel-5P" not in r.get("source_name", "")]
    if unmatched:
        for r in unmatched:
            assert r["satellite_column"] is None, f"Expected null satellite_column for unmatched record, got {r['satellite_column']}"
            assert r["satellite_qa"] is None, f"Expected null satellite_qa for unmatched record, got {r['satellite_qa']}"

def test_get_observations_date_filtering():
    """Verify that date filter is evaluated before limit and returns requested observation date."""
    # Query specific date where Sentinel-5P matched pairs exist
    response = client.get("/api/data/observations?mode=real&date=2024-01-01&pollutant=NO2&limit=25")
    assert response.status_code == 200
    records = response.json()
    assert len(records) > 0, "Expected records for date 2024-01-01"
    for r in records:
        assert r["date"] == "2024-01-01"
        assert r["observation_time"][:10] == "2024-01-01"
        assert r["satellite_column"] is not None
        assert r["satellite_column"] > 0

    # Query date with no records: must return empty list, not unrelated newer records
    res_empty = client.get("/api/data/observations?mode=real&date=1999-01-01&limit=25")
    assert res_empty.status_code == 200
    assert res_empty.json() == []

def test_provenance_summary_endpoint():
    """Verify GET /api/data/provenance-summary returns empirical breakdown and strict provenance classification."""
    res = client.get("/api/data/provenance-summary?mode=real")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert "summary" in data
    summary = data["summary"]
    assert summary["total_records"] >= 509
    assert summary["verified_collocations"] >= 9
    assert summary["ground_monitors"] >= 52
    assert summary["cams_reanalysis"] >= 448
    assert summary["direct_satellite"] == 0
    assert summary["synthetic_demo"] == 0
    assert summary["unique_stations"] >= 12
    assert "scientific_notice" in data

def test_observation_type_filtering():
    """Verify observations endpoint correctly filters by observation_type."""
    # 1. Verified collocations only
    res_colloc = client.get("/api/data/observations?mode=real&observation_type=VERIFIED_COLLOCATION&limit=100")
    assert res_colloc.status_code == 200
    colloc_rows = res_colloc.json()
    assert len(colloc_rows) >= 9
    for r in colloc_rows:
        assert r["observation_type"] == "VERIFIED_COLLOCATION"
        assert r["is_verified_collocation"] is True
        assert r["satellite_column"] is not None and r["satellite_column"] > 0
        assert r["ground_value"] > 0

    # 2. CAMS Reanalysis model estimates only
    res_cams = client.get("/api/data/observations?mode=real&observation_type=CAMS_REANALYSIS&limit=100")
    assert res_cams.status_code == 200
    cams_rows = res_cams.json()
    assert len(cams_rows) > 0
    for r in cams_rows:
        assert r["observation_type"] == "CAMS_REANALYSIS"
        assert r["is_verified_collocation"] is False
        assert r["satellite_column"] is None  # CAMS is a model, never labeled as satellite column

    # 3. Ground Monitors only
    res_grd = client.get("/api/data/observations?mode=real&observation_type=GROUND_MONITOR&limit=100")
    assert res_grd.status_code == 200
    grd_rows = res_grd.json()
    assert len(grd_rows) > 0
    for r in grd_rows:
        assert r["observation_type"] == "GROUND_MONITOR"
        assert r["is_verified_collocation"] is False

def test_satellite_ingestion_report_endpoint():
    """Verify GET /api/data/satellite/ingestion-report accurately audits local NetCDF archives."""
    res = client.get("/api/data/satellite/ingestion-report")
    assert res.status_code == 200
    report = res.json()
    assert report["total_granules_in_archive"] >= 5
    assert report["total_granules_in_archive"] == len(report["granules"])
    assert report["verified_collocated_pairs_in_db"] >= 9
    assert "collocation_criteria" in report

def test_predictions_history_data_mode():
    """Verify that predictions history returns explicit data_mode on each record."""
    res = client.get("/api/predictions/history?limit=10")
    assert res.status_code == 200
    history = res.json()
    for item in history:
        assert "data_mode" in item
        assert item["data_mode"] in ["REAL", "DEMO"]

