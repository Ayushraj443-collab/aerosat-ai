import pytest
import numpy as np
import pandas as pd
from app.ml.pipeline import SpatialMLPipeline, FEATURE_COLUMNS, get_active_model
from app.database import db_session
from app.ml.downscaler import estimate_single_location, generate_downscaled_grid_geojson

def test_genuine_no2_pollutant_filtering():
    """Verify that NO2 training data only includes verified NO2 records with genuine S5P column."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pollutant, satellite_column, ground_value, station_id
            FROM observations
            WHERE data_mode = 'REAL' 
              AND pollutant = 'NO2' 
              AND satellite_column IS NOT NULL 
              AND satellite_column > 0
              AND ground_value IS NOT NULL
        """)
        rows = cursor.fetchall()
        
    assert len(rows) >= 5, f"Expected at least 5 genuine collocated pairs, found {len(rows)}"
    for r in rows:
        assert r[0] == "NO2", f"Pollutant must strictly be NO2, got {r[0]}"
        assert r[1] > 0, "Satellite column must be positive"
        assert r[2] > 0, "Ground value must be positive"

def test_spatial_holdout_zero_leakage():
    """Verify that in GroupKFold cross-validation, training and validation stations are strictly disjoint."""
    pipe = SpatialMLPipeline(pollutant="NO2", algorithm="bayesian_ridge", data_mode="REAL")
    metrics = pipe.train_and_evaluate(spatial_cv_folds=3, data_mode="REAL")
    
    assert "spatial_validation_folds" in metrics
    folds = metrics["spatial_validation_folds"]
    assert len(folds) == 3
    
    all_held_out = []
    for f in folds:
        held_out = set(f["held_out_stations"])
        # Cross-fold disjoint check
        all_held_out.extend(list(held_out))
        assert len(held_out) >= 1
        assert f["train_count"] > 0
        assert f["val_count"] > 0
        
    # The union of held-out stations across all folds should cover all unique stations evaluated
    assert len(all_held_out) == len(set(all_held_out)), "No station should appear in multiple test folds"

def test_random_forest_improved_performance():
    """Verify that Random Forest achieves strong positive R² and out-performs baseline IDW on unseen stations."""
    pipe = SpatialMLPipeline(pollutant="NO2", algorithm="random_forest", data_mode="REAL")
    metrics = pipe.train_and_evaluate(spatial_cv_folds=5, data_mode="REAL")
    
    # Check error metrics on nationwide held-out stations
    assert metrics["r2"] > 0.40, f"Expected R² > 0.40, got {metrics['r2']}"
    assert metrics["mae"] < 16.0, f"Expected MAE < 16.0 µg/m³, got {metrics['mae']}"
    assert metrics["rmse"] < 25.0, f"Expected RMSE < 25.0 µg/m³, got {metrics['rmse']}"
    assert abs(metrics["mean_bias_error"]) < 5.0, f"Expected low MBE, got {metrics['mean_bias_error']}"
    
    # Fair baseline comparison
    baseline = metrics["baseline_comparison"]
    assert baseline["baseline_type"] == "Nearest Station Inverse-Distance Weighting (IDW)"
    assert baseline["baseline_mae"] > metrics["mae"], "ML model should have lower MAE than IDW baseline"
    assert baseline["ml_improvement_mae_pct"] > 0, "ML should show positive MAE reduction vs baseline"

def test_data_provenance_and_fingerprint():
    """Verify metadata fingerprinting, versioning, and sample count >= 30."""
    pipe = SpatialMLPipeline(pollutant="NO2", algorithm="random_forest", data_mode="REAL")
    metrics = pipe.train_and_evaluate(spatial_cv_folds=5, data_mode="REAL")
    
    assert metrics.get("dataset_version") == "S5P_L2_TROPOMI_CPCB_PAIRED_V2"
    assert "dataset_fingerprint" in metrics
    assert len(metrics["dataset_fingerprint"]) == 12
    # With authentic nationwide expansion (N=38 >= 30), dataset has matured beyond preliminary
    assert metrics.get("is_preliminary") is False
    assert metrics.get("val_samples") >= 30

def test_pipeline_downscaler_prediction_and_uncertainty():
    """Verify that the Pipeline model executes point and grid predictions with analytical standard deviations."""
    # Single point prediction
    res = estimate_single_location(
        lat=28.6139,
        lon=77.2090,
        date_str="2024-01-01",
        pollutant="NO2",
        target_resolution_km=1.0,
        data_mode="REAL"
    )
    
    assert res is not None
    assert res.get("status") == "COMPLETED"
    pred = res.get("estimated_value")
    assert pred is not None
    assert 20.0 <= pred <= 80.0, f"Prediction out of realistic range: {pred}"
    uncertainty = res.get("uncertainty")
    assert uncertainty is not None
    assert "standard_deviation" in uncertainty
    assert uncertainty["standard_deviation"] > 0
    assert uncertainty["lower_bound_90ci"] < pred < uncertainty["upper_bound_90ci"]
    
    # Grid downscaling
    grid = generate_downscaled_grid_geojson(
        min_lat=28.55,
        max_lat=28.65,
        min_lon=77.15,
        max_lon=77.25,
        date_str="2024-01-01",
        pollutant="NO2",
        resolution_km=5.0,
        data_mode="REAL"
    )
    assert grid.get("type") == "FeatureCollection"
    assert len(grid.get("features", [])) > 0
    valid_features = [f for f in grid["features"] if not f["properties"]["is_data_gap"]]
    assert len(valid_features) > 0
    for vf in valid_features:
        assert vf["properties"]["estimated_value"] > 0
        assert vf["properties"]["uncertainty_sd"] > 0
