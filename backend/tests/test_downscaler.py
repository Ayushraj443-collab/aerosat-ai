import pytest
from app.ml.downscaler import estimate_single_location, generate_downscaled_grid_geojson
from app.utils.geo import generate_spatial_grid, haversine_distance_km

def test_haversine_distance():
    # Delhi Connaught Place to Anand Vihar approx 11-13 km
    dist = haversine_distance_km(28.6304, 77.2177, 28.6476, 77.3158)
    assert 9.0 <= dist <= 14.0

def test_estimate_single_location():
    res = estimate_single_location(
        lat=28.64,
        lon=77.22,
        date_str="2024-02-15",
        pollutant="NO2",
        target_resolution_km=1.0
    )
    assert "prediction_id" in res
    assert res["pollutant"] == "NO2"
    assert res["estimated_value"] > 0
    assert "uncertainty" in res
    assert res["uncertainty"]["lower_bound_90ci"] <= res["estimated_value"]
    assert res["uncertainty"]["upper_bound_90ci"] >= res["estimated_value"]
    assert "provenance" in res
    assert res["provenance"]["is_demo"] is True

def test_generate_downscaled_grid_geojson():
    geojson = generate_downscaled_grid_geojson(
        min_lat=28.50,
        max_lat=28.70,
        min_lon=77.10,
        max_lon=77.30,
        date_str="2024-02-15",
        pollutant="NO2",
        resolution_km=5.0
    )
    assert geojson["type"] == "FeatureCollection"
    assert "features" in geojson
    assert len(geojson["features"]) > 0
    first_feat = geojson["features"][0]
    assert first_feat["type"] == "Feature"
    assert first_feat["geometry"]["type"] == "Polygon"
    assert "properties" in first_feat
    props = first_feat["properties"]
    assert "estimated_value" in props or props.get("is_data_gap") is True
