import io
import json
import hashlib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import (
    db_session,
    get_observations_from_db,
    count_observations,
    upsert_uploaded_dataset
)
from app.ml.pipeline import FEATURE_COLUMNS, SpatialMLPipeline
from app.ml.evaluator import compute_metrics

client = TestClient(app)

# 1. Idempotent registration of the same dataset
def test_idempotent_dataset_registration():
    import uuid
    uid = uuid.uuid4().hex[:8]
    csv_content = (
        f"date,station_name,no2,temperature_c\n"
        f"2024-03-01,Anand Vihar,42.5,25.0\n"
        f"2024-03-02,ITO,48.1,26.2\n"
        f"# run_id={uid}\n"
    )
    fname = f"idempotent_{uid}.csv"
    files = {"file": (fname, io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    
    # First upload
    res1 = client.post("/api/data/upload", files=files)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["is_valid"] is True
    assert data1["newly_registered"] is True
    assert data1["already_registered"] is False
    content_hash = data1["content_hash"]
    
    # Second upload of the EXACT same content
    files2 = {"file": (fname, io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res2 = client.post("/api/data/upload", files=files2)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["is_valid"] is True
    assert data2["content_hash"] == content_hash
    assert data2["already_registered"] is True
    assert data2["newly_registered"] is False
    assert data2["dataset_id"] == data1["dataset_id"]

    # Verify database has exactly 1 entry for this content hash
    with db_session() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM uploaded_datasets WHERE content_hash = ?", (content_hash,))
        assert cur.fetchone()[0] == 1


# 2. Same filename with different contents or provenance
def test_same_filename_different_contents():
    fname = "station_report.csv"
    content_v1 = (
        "date,station_name,no2,temperature_c\n"
        "2024-03-01,Anand Vihar,35.0,24.0\n"
    )
    content_v2 = (
        "date,station_name,no2,temperature_c\n"
        "2024-03-02,R K Puram,58.0,27.5\n"
    )
    
    # Upload v1
    files1 = {"file": (fname, io.BytesIO(content_v1.encode("utf-8")), "text/csv")}
    res1 = client.post("/api/data/upload", files=files1)
    assert res1.status_code == 200
    data1 = res1.json()
    
    # Upload v2 with the same filename
    files2 = {"file": (fname, io.BytesIO(content_v2.encode("utf-8")), "text/csv")}
    res2 = client.post("/api/data/upload", files=files2)
    assert res2.status_code == 200
    data2 = res2.json()
    
    # Both must be registered as distinct datasets with distinct IDs and distinct hashes
    assert data1["content_hash"] != data2["content_hash"]
    assert data1["dataset_id"] != data2["dataset_id"]
    
    with db_session() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM uploaded_datasets WHERE filename = ?", (fname,))
        assert cur.fetchone()[0] >= 2


# 3. Repeated or concurrent imports
def test_repeated_refresh_does_not_duplicate_registry():
    # Calling GET /api/data/datasets should never create additional entries
    res1 = client.get("/api/data/datasets")
    assert res1.status_code == 200
    initial_count = len(res1.json())
    
    # Refresh multiple times
    for _ in range(3):
        res2 = client.get("/api/data/datasets")
        assert res2.status_code == 200
        assert len(res2.json()) == initial_count


# 4. Preservation of valid observations during deduplication
def test_preservation_of_valid_observations():
    # Verify that real observations are present and unaffected
    with db_session() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM observations WHERE data_mode = 'REAL'")
        count_before = cur.fetchone()[0]
        
    assert count_before > 0
    # Query via API
    res = client.get("/api/data/observations?data_mode=REAL&limit=100")
    assert res.status_code == 200
    assert len(res.json()) > 0


# 5. Schema-valid but unverified CSV files
def test_schema_valid_but_unverified_csv():
    # CSV has valid coordinates and date, but is an ad-hoc local upload
    csv_content = (
        "date,latitude,longitude,no2,temperature_c\n"
        "2024-03-01,28.61,77.20,40.5,25.0\n"
    )
    files = {"file": ("unverified_custom_user.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = client.post("/api/data/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    # Must NOT be marked as genuine official CPCB CAAQMS report
    assert data["source_classification"] != "GENUINE_CPCB_CAAQMS_REPORT"
    assert data["source_classification"] in ["UNVERIFIED_CUSTOM_UPLOAD", "UNVERIFIED_UPLOAD", "GEOJSON_FEATURE_COLLECTION"]


# 6. Genuine-source provenance and source-category separation
def test_source_provenance_separation():
    res = client.get("/api/data/connectors")
    assert res.status_code == 200
    data = res.json()
    connectors = data["connectors"]
    
    categories = {c["category"] for c in connectors}
    assert "satellite" in categories
    assert "ground" in categories
    assert "meteorology" in categories or "weather" in categories or "atmospheric" in categories

    # Verify that CAMS connector is categorized as atmospheric/reanalysis, not ground
    cams_con = next((c for c in connectors if "cams" in c["connector_id"].lower()), None)
    if cams_con:
        assert cams_con["category"] != "ground"


# 7. Exclusion of CAMS-only, CPCB-only, and unmatched rows from REAL matched observations
def test_exclusion_of_unmatched_rows_from_real_matched():
    # Matched observation records must only contain genuine paired observations
    res = client.get("/api/data/observations?data_mode=REAL&matched_only=true")
    assert res.status_code == 200
    matched = res.json()
    
    for r in matched:
        # 1. Must have valid ground value
        assert r["ground_value"] is not None
        assert float(r["ground_value"]) > 0
        # 2. Must have valid satellite column
        assert r["satellite_column"] is not None
        assert float(r["satellite_column"]) > 0
        # 3. Must have valid satellite QA flag >= 0.50
        assert r["satellite_qa"] is not None
        assert float(r["satellite_qa"]) >= 0.50
        # 4. Source name must show paired satellite and ground provenance
        assert "Sentinel-5P" in r["source_name"]
        assert "CPCB" in r["source_name"]


# 8. Correct pollutant, temporal, and spatial matching
def test_pollutant_temporal_spatial_matching_logic():
    # Observations table should have genuine pairs for orbit 32219 on 2024-01-01 and multi-city granules
    matched = get_observations_from_db(data_mode="REAL", pollutant="NO2", matched_only=True)
    assert len(matched) > 0
    for r in matched:
        assert r["pollutant"] == "NO2"
        assert r["observation_time"][:10] in ["2023-12-01", "2024-01-01", "2024-01-10"]
        # Station coordinates must be within India geographic bounds
        assert 8.0 <= r["latitude"] <= 37.0
        assert 68.0 <= r["longitude"] <= 98.0


# 9. Missing satellite values and QA values remain null and render as N/A
def test_missing_satellite_values_remain_null_never_zero():
    # Ground-only CPCB observations
    cpcb_only = get_observations_from_db(data_mode="REAL", matched_only=False)
    unmatched_ground = [r for r in cpcb_only if r.get("source_name") == "CPCB CAAQMS Official Network"]
    
    assert len(unmatched_ground) > 0
    for r in unmatched_ground:
        # Must be None, never 0.0 or 0
        assert r["satellite_column"] is None
        assert r["satellite_qa"] is None


# 10. Accurate raw-row, accepted-row, and pollutant record breakdown
def test_accurate_counts_sample_delhi_csv():
    import os
    sample_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw", "cpcb_caaqms_sample_delhi.csv")
    if os.path.exists(sample_path):
        with open(sample_path, "rb") as f:
            files = {"file": ("cpcb_caaqms_sample_delhi.csv", f, "text/csv")}
            res = client.post("/api/data/upload", files=files)
            assert res.status_code == 200
            data = res.json()
            assert data["row_count"] == 23
            assert data["raw_rows_count"] == 23
            # 23 rows * 2 pollutants (NO2, PM2.5) = 46 accepted records
            assert data["accepted_records_count"] == 46
            assert data["pollutant_records_breakdown"] == {"NO2": 23, "PM2.5": 23}
            # Must NEVER label mixed dataset as solely PM2.5
            assert data["pollutant_detected"] == "NO2, PM2.5"
            assert data["pollutant_detected"] != "PM2.5"
            assert data["pollutants_detected"] == ["NO2", "PM2.5"]
            assert data["pollutants_summary"]["NO2"]["count"] == 23
            assert data["pollutants_summary"]["PM2.5"]["count"] == 23
            assert data["source_classification"] == "CPCB_CAAQMS_SAMPLE_ARCHIVE"


# 11. No target leakage in training and validation
def test_no_target_leakage_in_training():
    # Target ground value must not be present in feature columns
    assert "ground_value" not in FEATURE_COLUMNS
    assert "no2" not in FEATURE_COLUMNS
    assert "target" not in FEATURE_COLUMNS
    assert "y" not in FEATURE_COLUMNS

    # Test spatial GroupKFold separation
    pipeline = SpatialMLPipeline(pollutant="NO2", algorithm="random_forest", data_mode="REAL")
    # Verify groups are based on station_id, ensuring entire stations are held out
    dummy_df = pd.DataFrame([
        {"station_id": "STN_A", "observation_time": "2024-01-01T13:30:00Z", "ground_value": 45.0, "satellite_column": 12.0},
        {"station_id": "STN_A", "observation_time": "2024-01-01T14:30:00Z", "ground_value": 47.0, "satellite_column": 11.5},
        {"station_id": "STN_B", "observation_time": "2024-01-01T13:30:00Z", "ground_value": 52.0, "satellite_column": 14.0},
    ])
    X, y, groups = pipeline.extract_features(dummy_df)
    assert len(np.unique(groups)) == 2
    assert "STN_A" in groups and "STN_B" in groups


# 12. Model metrics calculated from actual predictions
def test_model_metrics_calculated_from_actual_predictions():
    y_true = np.array([40.0, 50.0, 60.0])
    y_pred = np.array([42.0, 48.0, 63.0])
    
    metrics = compute_metrics(y_true, y_pred)
    expected_mae = float(np.mean(np.abs(y_true - y_pred)))
    expected_rmse = float(np.sqrt(np.mean((y_true - y_pred)**2)))
    
    assert metrics["mae"] == round(expected_mae, 2)
    assert metrics["rmse"] == round(expected_rmse, 2)
    # R2 calculation must follow standard formula: 1 - SS_res / SS_tot
    ss_res = np.sum((y_true - y_pred)**2)
    ss_tot = np.sum((y_true - np.mean(y_true))**2)
    expected_r2 = float(1.0 - (ss_res / ss_tot))
    assert metrics["r2"] == round(expected_r2, 4)


# 13. REAL mode never silently uses demo data
def test_real_mode_never_uses_demo_data():
    res = client.get("/api/data/observations?data_mode=REAL&limit=50")
    assert res.status_code == 200
    records = res.json()
    for r in records:
        assert r["data_mode"] == "REAL"
        assert "Synthetic" not in r["source_name"]
        assert "Simulation" not in r["source_name"]


# 14. Existing API and frontend compatibility
def test_existing_api_compatibility():
    endpoints = [
        "/api/health",
        "/api/data/connectors",
        "/api/data/datasets",
        "/api/data/observations?data_mode=REAL&limit=10",
        "/api/model/metrics?pollutant=NO2&mode=real",
        "/api/map/downscaled-grid?mode=real&pollutant=NO2&date=2024-01-01"
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 200, f"Endpoint {ep} failed with status {resp.status_code}: {resp.text}"
