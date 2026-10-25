import pytest
import numpy as np
from app.ml.pipeline import SpatialMLPipeline, FEATURE_COLUMNS
from app.data.synthetic_generator import generate_synthetic_dataset

def test_spatial_ml_pipeline_training():
    df = generate_synthetic_dataset(start_date="2024-01-01", days=30)
    pipeline = SpatialMLPipeline(pollutant="NO2", algorithm="random_forest")
    
    X, y, groups = pipeline.extract_features(df[df["pollutant"] == "NO2"])
    assert X.shape[1] == len(FEATURE_COLUMNS)
    assert len(y) == len(X)
    assert len(groups) == len(X)
    
    # Train fast test model with small parameters
    metrics = pipeline.train_and_evaluate(
        n_estimators=20,
        max_depth=5,
        spatial_cv_folds=3,
        random_state=42
    )
    
    assert "mae" in metrics
    assert "rmse" in metrics
    assert "r2" in metrics
    assert metrics["mae"] > 0
    assert metrics["rmse"] > 0
    assert "baseline_comparison" in metrics
    assert len(metrics["feature_importances"]) == len(FEATURE_COLUMNS)
    assert len(metrics["spatial_validation_folds"]) == 3
