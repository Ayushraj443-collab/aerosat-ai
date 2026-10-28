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

def test_upload_cpcb_station_name_resolution():
    """Test that a CPCB CSV without lat/lon columns successfully resolves known station names."""
    csv_content = (
        "date,station_name,no2,temperature_c\n"
        "2024-03-01,Anand Vihar,45.2,26.5\n"
        "2024-03-02,ITO,52.1,27.1\n"
    )
    files = {"file": ("cpcb_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is True
    assert data["accepted_records_count"] == 2
    assert "latitude" in data["columns"]
    assert "longitude" in data["columns"]
    assert len(data["stations_resolved"]) == 2

def test_upload_missing_coordinates_and_unknown_station():
    """Test that records with unknown stations and no coordinates are rejected without inventing coords."""
    csv_content = (
        "date,station_name,no2,temperature_c\n"
        "2024-03-01,Unknown Station XYZ Nowhere,45.2,26.5\n"
    )
    files = {"file": ("invalid_unknown_station.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/data/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["is_valid"] is False
    assert data["rejected_records_count"] == 1
    assert "Unknown Station XYZ Nowhere" in data["unresolved_stations"]
    assert any("Cannot resolve coordinates" in msg for msg in data["validation_messages"])

def test_upload_actual_sample_delhi_csv():
    """Test validation and resolution against the real project sample file data/raw/cpcb_caaqms_sample_delhi.csv."""
    import os
    sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "cpcb_caaqms_sample_delhi.csv")
    if os.path.exists(sample_path):
        with open(sample_path, "rb") as f:
            files = {"file": ("cpcb_caaqms_sample_delhi.csv", f, "text/csv")}
            response = client.post("/api/data/upload", files=files)
            assert response.status_code == 200
            data = response.json()
            assert data["is_valid"] is True
            assert data["row_count"] == 23
            assert data["raw_rows_count"] == 23
            assert data["accepted_records_count"] == 46
            assert len(data["stations_resolved"]) == 8
            assert len(data["unresolved_stations"]) == 0
            # Must NEVER label mixed dataset as solely PM2.5
            assert data["pollutant_detected"] == "NO2, PM2.5"
            assert data["pollutant_detected"] != "PM2.5"
            assert data["pollutants_detected"] == ["NO2", "PM2.5"]
            assert data["pollutant_records_breakdown"] == {"NO2": 23, "PM2.5": 23}
            assert data["pollutants_summary"]["NO2"]["count"] == 23
            assert data["pollutants_summary"]["PM2.5"]["count"] == 23
            assert data["source_classification"] == "CPCB_CAAQMS_SAMPLE_ARCHIVE"

def test_mixed_pollutant_csv_distinct_determination():
    """Verify pollutant is determined separately for every observation from its actual CSV column."""
    from app.data.connectors import validate_and_parse_cpcb_csv
    import pandas as pd
    
    df = pd.DataFrame([
        {"Station Name": "Punjabi Bagh", "Date": "2024-01-01 00:00:00", "NO2 (ug/m3)": 45.2, "PM2.5 (ug/m3)": 110.5},
        {"Station Name": "Punjabi Bagh", "Date": "2024-01-01 01:00:00", "NO2 (ug/m3)": 48.0, "PM2.5 (ug/m3)": 115.2},
    ])
    res = validate_and_parse_cpcb_csv(df, filename="custom_delhi_cpcb.csv")
    assert res["is_valid"] is True
    assert res["row_count"] == 2
    assert res["accepted_records_count"] == 4
    
    # Check that individual observation records carry their distinct pollutant
    no2_records = [r for r in res["accepted_records"] if r["pollutant"] == "NO2"]
    pm25_records = [r for r in res["accepted_records"] if r["pollutant"] == "PM2.5"]
    assert len(no2_records) == 2
    assert len(pm25_records) == 2
    assert no2_records[0]["ground_value"] == 45.2
    assert pm25_records[0]["ground_value"] == 110.5
    
    # Must NEVER label the entire dataset as solely PM2.5
    assert res["pollutant_detected"] == "NO2, PM2.5"
    assert res["pollutants_detected"] == ["NO2", "PM2.5"]
    assert res["pollutants_summary"]["NO2"]["count"] == 2
    assert res["pollutants_summary"]["PM2.5"]["count"] == 2
    assert res["pollutants_summary"]["NO2"]["date_range"]["start"] == "2024-01-01"
    assert res["pollutants_summary"]["PM2.5"]["date_range"]["start"] == "2024-01-01"

def test_duplicate_handling_for_identical_and_distinct_pollutants():
    """Test that identical observations at same timestamp are rejected as duplicates, but different pollutants are preserved."""
    from app.data.connectors import validate_and_parse_cpcb_csv
    import pandas as pd
    
    df = pd.DataFrame([
        {"Station Name": "Punjabi Bagh", "Date": "2024-01-01 00:00:00", "NO2 (ug/m3)": 45.2},
        {"Station Name": "Punjabi Bagh", "Date": "2024-01-01 00:00:00", "NO2 (ug/m3)": 45.2}, # Exact dupe
        {"Station Name": "Mandir Marg", "Date": "2024-01-01 00:00:00", "NO2 (ug/m3)": 40.0, "PM2.5 (ug/m3)": 95.0}, # 2 separate pollutants
    ])
    res = validate_and_parse_cpcb_csv(df, filename="dupe_test.csv")
    assert res["row_count"] == 3
    assert res["duplicate_count"] == 1
    assert res["accepted_records_count"] == 3
    assert res["pollutant_records_breakdown"] == {"NO2": 2, "PM2.5": 1}

def test_no2_matching_strictly_excludes_pm25():
    """Verify that NO2 spatial matching never pairs PM2.5 values as NO2 ground truth."""
    from app.data.matcher import SpatiotemporalMatcher
    
    matcher = SpatiotemporalMatcher(max_spatial_distance_km=10.0, max_temporal_diff_hours=3.0, min_satellite_qa=0.5)
    
    satellite_no2_obs = [{
        "id": "SAT_NO2_001",
        "pollutant": "NO2",
        "latitude": 28.64,
        "longitude": 77.21,
        "observation_time": "2024-01-01T08:00:00Z",
        "satellite_column": 12.5,
        "satellite_qa": 0.90,
        "unit": "10¹⁵ molec/cm²"
    }]
    
    ground_obs = [
        {
            "id": "GND_PM25_001",
            "station_id": "DEL_PUNJABI_BAGH",
            "pollutant": "PM2.5",
            "ground_value": 150.0,
            "latitude": 28.645,
            "longitude": 77.215,
            "observation_time": "2024-01-01T08:00:00Z",
            "unit": "µg/m³"
        },
        {
            "id": "GND_NO2_001",
            "station_id": "DEL_PUNJABI_BAGH",
            "pollutant": "NO2",
            "ground_value": 52.3,
            "latitude": 28.645,
            "longitude": 77.215,
            "observation_time": "2024-01-01T08:00:00Z",
            "unit": "µg/m³"
        }
    ]
    
    match_result = matcher.match_observations(satellite_no2_obs, ground_obs)
    assert match_result["matched_count"] == 1
    pair = match_result["matched_pairs"][0]
    assert pair["pollutant"] == "NO2"
    assert pair["ground_value"] == 52.3
    assert pair["ground_value"] != 150.0
    assert match_result["rejection_summary"]["pollutant_mismatch"] >= 1
