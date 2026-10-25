import os
import json
import uuid
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query

from app.config import settings
from app.database import db_session
from app.data.connectors import DataSourceRegistry
from app.data.synthetic_generator import REALISTIC_STATIONS, initialize_demo_data_if_needed
from app.models.schemas import (
    DataSourceInfo,
    GroundStation,
    ObservationRecord,
    UploadValidationResponse
)

router = APIRouter(prefix="/data", tags=["Data Sources & Observations"])

@router.get("/sources", response_model=List[DataSourceInfo])
def list_data_sources():
    """Retrieve metadata and connection status for all registered satellite, ground, and weather sources."""
    return DataSourceRegistry.get_registered_sources()

@router.get("/stations", response_model=List[GroundStation])
def list_ground_stations():
    """Retrieve operational CPCB ground air-quality monitoring stations with coordinates and types."""
    stations_file, _ = initialize_demo_data_if_needed()
    with open(stations_file, "r", encoding="utf-8") as f:
        stations = json.load(f)
        
    # Read latest observations to attach to stations
    dataset_path = settings.DATA_RAW_DIR / "synthetic_sentinel5p_cpcb_pairs.csv"
    latest_readings = {}
    if dataset_path.exists():
        try:
            df = pd.read_csv(dataset_path)
            latest_date = df["date"].max()
            df_latest = df[df["date"] == latest_date]
            for stn_id, group in df_latest.groupby("station_id"):
                reading_dict = {"date": latest_date}
                for _, row in group.iterrows():
                    reading_dict[row["pollutant"]] = {
                        "value": row["ground_value"],
                        "unit": row["unit"]
                    }
                latest_readings[stn_id] = reading_dict
        except Exception:
            pass
            
    result = []
    for s in stations:
        stn_copy = dict(s)
        stn_copy["latest_reading"] = latest_readings.get(s["station_id"])
        result.append(stn_copy)
        
    return result

@router.get("/observations", response_model=List[ObservationRecord])
def get_observations(
    date: Optional[str] = Query(None, description="Observation date (YYYY-MM-DD)"),
    pollutant: Optional[str] = Query(None, description="Pollutant: NO2, PM2.5, SO2, CO, O3"),
    station_id: Optional[str] = Query(None, description="Filter by station ID"),
    limit: int = Query(200, ge=1, le=1000)
):
    """Retrieve paired satellite and ground observation records."""
    _, dataset_path = initialize_demo_data_if_needed()
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail="Observation dataset not found.")
        
    df = pd.read_csv(dataset_path)
    
    if date:
        df = df[df["date"] == date]
    if pollutant:
        df = df[df["pollutant"] == pollutant.upper()]
    if station_id:
        df = df[df["station_id"] == station_id]
        
    df = df.head(limit)
    return df.to_dict(orient="records")

@router.post("/upload", response_model=UploadValidationResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """
    Upload and strictly validate an external air-quality dataset (CSV or GeoJSON).
    Verifies required geographic coordinates, detects pollutants, checks coordinate bounds,
    and identifies missing values before accepting the dataset.
    """
    MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB limit
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File size exceeds maximum permitted limit of 15 MB.")
        
    filename = file.filename or "uploaded_data.csv"
    ext = Path(filename).suffix.lower()
    
    if ext not in [".csv", ".json", ".geojson"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a .csv, .json, or .geojson file.")
        
    dataset_id = f"ds_{uuid.uuid4().hex[:10]}"
    validation_messages = []
    is_valid = True
    
    try:
        if ext == ".csv":
            import io
            df = pd.read_csv(io.BytesIO(contents))
        else:
            geojson_data = json.loads(contents.decode("utf-8"))
            if "features" in geojson_data:
                rows = []
                for feat in geojson_data["features"]:
                    props = feat.get("properties", {})
                    geom = feat.get("geometry", {})
                    if geom.get("type") == "Point":
                        coords = geom.get("coordinates", [0, 0])
                        props["longitude"] = coords[0]
                        props["latitude"] = coords[1]
                    rows.append(props)
                df = pd.DataFrame(rows)
            else:
                df = pd.DataFrame(geojson_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
        
    row_count = len(df)
    if row_count == 0:
        raise HTTPException(status_code=400, detail="Uploaded dataset is empty.")
        
    # Standardize column names (lowercase and strip)
    col_mapping = {col: col.strip().lower() for col in df.columns}
    normalized_cols = list(col_mapping.values())
    
    # Coordinate validation
    lat_col = next((c for c in df.columns if col_mapping[c] in ["latitude", "lat", "y"]), None)
    lon_col = next((c for c in df.columns if col_mapping[c] in ["longitude", "lon", "lng", "x"]), None)
    
    if not lat_col or not lon_col:
        is_valid = False
        validation_messages.append("Missing required coordinate columns: 'latitude' and 'longitude'.")
        coord_bounds = {"min_lat": 0.0, "max_lat": 0.0, "min_lon": 0.0, "max_lon": 0.0}
    else:
        # Check coordinate ranges
        min_lat, max_lat = float(df[lat_col].min()), float(df[lat_col].max())
        min_lon, max_lon = float(df[lon_col].min()), float(df[lon_col].max())
        coord_bounds = {
            "min_lat": round(min_lat, 4),
            "max_lat": round(max_lat, 4),
            "min_lon": round(min_lon, 4),
            "max_lon": round(max_lon, 4)
        }
        if min_lat < -90.0 or max_lat > 90.0:
            is_valid = False
            validation_messages.append(f"Latitude out of bounds [-90, 90]: found range [{min_lat}, {max_lat}].")
        if min_lon < -180.0 or max_lon > 180.0:
            is_valid = False
            validation_messages.append(f"Longitude out of bounds [-180, 180]: found range [{min_lon}, {max_lon}].")

    # Pollutant detection
    pollutant_detected = None
    for p in ["no2", "pm2.5", "pm25", "so2", "co", "o3"]:
        if any(p in c for c in normalized_cols):
            pollutant_detected = p.upper().replace("PM25", "PM2.5")
            break
            
    if not pollutant_detected:
        validation_messages.append("Warning: Could not automatically detect a standard pollutant column (NO2, PM2.5, SO2, CO, O3).")
        
    # Date range detection
    date_col = next((c for c in df.columns if col_mapping[c] in ["date", "datetime", "timestamp", "time"]), None)
    if date_col:
        date_range = {"start": str(df[date_col].min()), "end": str(df[date_col].max())}
    else:
        date_range = {"start": "Unknown", "end": "Unknown"}
        validation_messages.append("Warning: No timestamp column ('date' or 'timestamp') identified.")
        
    missing_summary = {str(col): int(df[col].isna().sum()) for col in df.columns if df[col].isna().sum() > 0}
    
    # Save valid file safely
    safe_filename = f"{dataset_id}_{Path(filename).name}"
    save_path = settings.DATA_RAW_DIR / safe_filename
    with open(save_path, "wb") as f:
        f.write(contents)
        
    preview_rows = df.head(5).fillna("").to_dict(orient="records")
    
    # Store in database
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO uploaded_datasets (
            id, filename, uploaded_at, row_count, columns_json, bounding_box_json, pollutant, is_valid, summary_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            dataset_id,
            filename,
            datetime.now().isoformat(),
            row_count,
            json.dumps(list(df.columns)),
            json.dumps(coord_bounds),
            pollutant_detected,
            1 if is_valid else 0,
            json.dumps({
                "date_range": date_range,
                "missing_values": missing_summary,
                "validation_messages": validation_messages
            })
        ))
        
    return {
        "dataset_id": dataset_id,
        "filename": filename,
        "uploaded_at": datetime.now().isoformat(),
        "row_count": row_count,
        "columns": list(df.columns),
        "pollutant_detected": pollutant_detected,
        "coordinate_bounds": coord_bounds,
        "date_range": date_range,
        "missing_value_summary": missing_summary,
        "is_valid": is_valid,
        "validation_messages": validation_messages,
        "preview_rows": preview_rows
    }

@router.get("/datasets")
def list_uploaded_datasets():
    """List all registered or uploaded datasets in the system."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM uploaded_datasets ORDER BY uploaded_at DESC")
        rows = cursor.fetchall()
        
    datasets = []
    for r in rows:
        datasets.append({
            "id": r["id"],
            "filename": r["filename"],
            "uploaded_at": r["uploaded_at"],
            "row_count": r["row_count"],
            "columns": json.loads(r["columns_json"]) if r["columns_json"] else [],
            "bounding_box": json.loads(r["bounding_box_json"]) if r["bounding_box_json"] else {},
            "pollutant": r["pollutant"],
            "is_valid": bool(r["is_valid"]),
            "summary": json.loads(r["summary_json"]) if r["summary_json"] else {}
        })
    return datasets
