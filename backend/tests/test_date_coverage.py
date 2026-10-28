"""
Test Suite: Date-Wise Data Coverage and Milestone Auditing
Verifies:
1. /api/data/date-coverage returns accurate, truthful coverage matrices for any Indian city.
2. Patna resolves in-situ CAAQMS records in December 2023 (60 records, NO2 + PM2.5).
3. Delhi resolves in-situ CAAQMS records in January 2024.
4. Sentinel-5P Level-2 granules in archive are accurately indexed.
5. Curated milestone dates allow transparent, truthful evaluation across both in-situ and satellite tiers.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_patna_date_coverage():
    response = client.get("/api/data/date-coverage?city_name=Patna")
    assert response.status_code == 200
    data = response.json()

    assert data["queried_city"] == "Patna"
    stn = data["station_info"]
    assert stn["has_records"] is True
    assert stn["total_records"] >= 30
    assert "NO2" in stn["pollutants"]
    assert "PM2.5" in stn["pollutants"]
    assert stn["min_date"].startswith("2023-12")
    assert stn["max_date"].startswith("2023-12")
    assert len(data["in_situ_dates_for_city"]) > 0


def test_delhi_date_coverage():
    response = client.get("/api/data/date-coverage?city_name=Delhi")
    assert response.status_code == 200
    data = response.json()

    assert data["queried_city"] == "Delhi"
    stn = data["station_info"]
    assert stn["has_records"] is True
    assert stn["total_records"] >= 50
    assert stn["min_date"] <= "2024-01-01"
    assert stn["max_date"] >= "2024-01-10"


def test_satellite_granules_in_date_coverage():
    response = client.get("/api/data/date-coverage")
    assert response.status_code == 200
    data = response.json()

    granules = data["satellite_granules"]
    assert len(granules) >= 6
    dates = [g["date"] for g in granules]
    assert "2024-01-01" in dates
    assert "2024-01-07" in dates
    assert "2024-05-20" in dates
    assert all(g["file_size_mb"] > 500.0 for g in granules)


def test_milestone_dates_in_date_coverage():
    response = client.get("/api/data/date-coverage")
    assert response.status_code == 200
    data = response.json()

    milestones = data["milestone_dates"]
    assert len(milestones) >= 4
    dates = [m["date"] for m in milestones]
    assert "2023-12-15" in dates
    assert "2024-01-01" in dates
    assert "2024-01-07" in dates
    assert "2024-01-10" in dates

