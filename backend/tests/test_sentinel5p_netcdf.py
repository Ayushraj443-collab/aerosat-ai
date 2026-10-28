import pytest
from pathlib import Path
import numpy as np

from app.config import settings
from app.data.sentinel5p_parser import Sentinel5PNetCDFParser
from app.data.paired_observation_builder import GenuinePairedObservationBuilder
from app.data.connectors import OFFICIAL_CPCB_STATIONS

def test_sentinel5p_granules_exist():
    """Verify that genuine Sentinel-5P Level-2 OFFL NetCDF granules are downloaded."""
    s5p_dir = settings.DATA_RAW_DIR / "sentinel5p"
    assert s5p_dir.exists(), f"Directory {s5p_dir} does not exist"
    granules = list(s5p_dir.glob("S5P_OFFL_L2__NO2____*.nc"))
    assert len(granules) >= 1, "At least one Sentinel-5P Level-2 NO2 granule must be present"
    # Verify file sizes are substantive (> 100 MB)
    for g in granules:
        assert g.stat().st_size > 100_000_000, f"Granule {g.name} is truncated ({g.stat().st_size} bytes)"

def test_sentinel5p_netcdf_parser_extraction():
    """Verify that Sentinel5PNetCDFParser parses Level-2 variables with quality filtering."""
    s5p_dir = settings.DATA_RAW_DIR / "sentinel5p"
    granules = list(s5p_dir.glob("S5P_OFFL_L2__NO2____*.nc"))
    if not granules:
        pytest.skip("No S5P granules downloaded")

    granule = granules[0]
    parsed = Sentinel5PNetCDFParser.parse_granule(
        granule_path=granule,
        bbox={"min_lat": 28.30, "max_lat": 28.88, "min_lon": 76.90, "max_lon": 77.45},
        qa_threshold=0.50,
        pollutant="NO2"
    )

    assert parsed["total_valid_pixels"] > 0
    assert len(parsed["pixels"]) > 0
    sample_pixel = parsed["pixels"][0]
    assert "column_1e15" in sample_pixel
    assert sample_pixel["qa_value"] >= 0.50
    # Column densities for Delhi-NCR typically range from 2.0 to 35.0 x 10^15 molec/cm2
    mean_col = np.mean([p["column_1e15"] for p in parsed["pixels"]])
    assert 2.0 <= mean_col <= 35.0

def test_sentinel5p_station_spatial_matching():
    """Verify spatial matching within defensible TROPOMI footprint tolerance (<= 5.5 km)."""
    s5p_dir = settings.DATA_RAW_DIR / "sentinel5p"
    granules = list(s5p_dir.glob("S5P_OFFL_L2__NO2____*.nc"))
    if not granules:
        pytest.skip("No S5P granules downloaded")

    granule = granules[0]
    matches = Sentinel5PNetCDFParser.match_stations(
        granule_path=granule,
        stations=OFFICIAL_CPCB_STATIONS,
        max_dist_km=5.5,
        qa_threshold=0.50,
        pollutant="NO2"
    )

    assert len(matches) > 0, "Should match at least one official CPCB station"
    for m in matches:
        assert m["distance_km"] <= 5.5, f"Station {m['station_id']} exceeded 5.5 km tolerance"
        assert m["satellite_qa"] >= 0.50, f"QA flag {m['satellite_qa']} below 0.50 threshold"
        assert m["satellite_column_1e15"] > 0, "Satellite column must be positive"

def test_genuine_paired_observation_builder_no_target_leakage():
    """Verify that paired observations maintain distinct units and have no artificial target leakage."""
    pairs = GenuinePairedObservationBuilder.process_all_downloaded_granules()
    assert len(pairs) >= 5, f"Expected genuine paired records from downloaded granules, got {len(pairs)}"

    sat_cols = [p["satellite_column"] for p in pairs]
    ground_vals = [p["ground_value"] for p in pairs]

    # Verify units are distinct:
    # Satellite columns are in 10^15 molec/cm2 (mean ~8-20)
    # Ground values are in µg/m³ (mean ~35-75)
    assert np.mean(sat_cols) < 25.0
    assert np.mean(ground_vals) > 30.0

    # Verify absence of target leakage:
    # A hardcoded linear formula yields r = 1.000. Real atmospheric observations must have |r| < 0.90
    corr = float(np.corrcoef(sat_cols, ground_vals)[0, 1])
    assert abs(corr) < 0.90, f"Suspiciously high correlation {corr} indicates target leakage!"
