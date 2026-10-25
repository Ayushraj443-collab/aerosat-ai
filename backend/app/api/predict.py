import json
import io
import csv
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from datetime import datetime
from typing import List, Optional

from app.config import settings
from app.database import db_session
from app.models.schemas import PredictionRequest, PredictionResponse
from app.ml.downscaler import estimate_single_location

router = APIRouter(tags=["Prediction & Downscaling Workspace"])

@router.post("/predict", response_model=PredictionResponse)
def execute_prediction(req: PredictionRequest):
    """
    Execute spatial downscaling prediction for a user-specified coordinate, date, and pollutant.
    Estimates ground-level concentration, evaluates uncertainty bounds, and logs data provenance.
    """
    # Validate coordinate sanity
    if not (20.0 <= req.latitude <= 35.0 and 68.0 <= req.longitude <= 90.0):
        # We focus primarily on the subcontinent / Indo-Gangetic Plain for high accuracy demonstration
        # But we still provide clear feedback if coordinates are outside
        raise HTTPException(
            status_code=422,
            detail=f"Coordinate ({req.latitude}, {req.longitude}) is outside the regional domain of the trained model (India: lat 20-35°N, lon 68-90°E). Please select a coordinate within the supported regional extent."
        )
        
    result = estimate_single_location(
        lat=req.latitude,
        lon=req.longitude,
        date_str=req.date,
        pollutant=req.pollutant,
        target_resolution_km=req.target_resolution_km,
        model_algorithm=req.model_algorithm or "random_forest"
    )
    
    # Save into SQLite history
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO predictions_history (
            id, timestamp, latitude, longitude, date, pollutant, target_resolution,
            estimated_value, unit, uncertainty_lower, uncertainty_upper, model_version, is_demo, provenance_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result["prediction_id"],
            result["timestamp"],
            result["latitude"],
            result["longitude"],
            result["date"],
            result["pollutant"],
            result["target_resolution_km"],
            result["estimated_value"],
            result["unit"],
            result["uncertainty"]["lower_bound_90ci"],
            result["uncertainty"]["upper_bound_90ci"],
            result["model_info"]["model_id"],
            1,
            json.dumps(result["provenance"])
        ))
        
    return result

@router.get("/predictions/history")
def get_prediction_history(limit: int = Query(25, ge=1, le=100)):
    """Retrieve history of user-executed predictions from the database."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM predictions_history ORDER BY timestamp DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        
    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "date": r["date"],
            "pollutant": r["pollutant"],
            "target_resolution_km": r["target_resolution"],
            "estimated_value": r["estimated_value"],
            "unit": r["unit"],
            "uncertainty_lower": r["uncertainty_lower"],
            "uncertainty_upper": r["uncertainty_upper"],
            "model_version": r["model_version"],
            "is_demo": bool(r["is_demo"]),
            "provenance": json.loads(r["provenance_json"]) if r["provenance_json"] else {}
        })
    return history

@router.get("/predictions/{prediction_id}")
def get_prediction_detail(prediction_id: str):
    """Retrieve full details for a specific prediction."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM predictions_history WHERE id = ?", (prediction_id,))
        row = cursor.fetchone()
        
    if not row:
        raise HTTPException(status_code=404, detail=f"Prediction '{prediction_id}' not found.")
        
    return {
        "id": row["id"],
        "timestamp": row["timestamp"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "date": row["date"],
        "pollutant": row["pollutant"],
        "target_resolution_km": row["target_resolution"],
        "estimated_value": row["estimated_value"],
        "unit": row["unit"],
        "uncertainty_lower": row["uncertainty_lower"],
        "uncertainty_upper": row["uncertainty_upper"],
        "model_version": row["model_version"],
        "is_demo": bool(row["is_demo"]),
        "provenance": json.loads(row["provenance_json"]) if row["provenance_json"] else {}
    }

@router.get("/export/{prediction_id}")
def export_prediction(prediction_id: str, format: str = Query("json", description="csv or json or geojson")):
    """Export a prediction record as CSV, JSON, or GeoJSON."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM predictions_history WHERE id = ?", (prediction_id,))
        row = cursor.fetchone()
        
    if not row:
        raise HTTPException(status_code=404, detail=f"Prediction '{prediction_id}' not found.")
        
    fmt = format.lower()
    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "prediction_id", "timestamp", "latitude", "longitude", "date",
            "pollutant", "resolution_km", "estimated_value", "unit",
            "uncertainty_lower_90ci", "uncertainty_upper_90ci", "model_version"
        ])
        writer.writerow([
            row["id"], row["timestamp"], row["latitude"], row["longitude"], row["date"],
            row["pollutant"], row["target_resolution"], row["estimated_value"], row["unit"],
            row["uncertainty_lower"], row["uncertainty_upper"], row["model_version"]
        ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={prediction_id}.csv"}
        )
    elif fmt == "geojson":
        geojson_data = {
            "type": "Feature",
            "id": row["id"],
            "geometry": {
                "type": "Point",
                "coordinates": [row["longitude"], row["latitude"]]
            },
            "properties": {
                "date": row["date"],
                "pollutant": row["pollutant"],
                "estimated_value": row["estimated_value"],
                "unit": row["unit"],
                "uncertainty_lower": row["uncertainty_lower"],
                "uncertainty_upper": row["uncertainty_upper"],
                "resolution_km": row["target_resolution"],
                "model_version": row["model_version"],
                "is_demo": bool(row["is_demo"])
            }
        }
        return Response(
            content=json.dumps(geojson_data, indent=2),
            media_type="application/geo+json",
            headers={"Content-Disposition": f"attachment; filename={prediction_id}.geojson"}
        )
    else:
        record = dict(row)
        if record.get("provenance_json"):
            record["provenance"] = json.loads(record["provenance_json"])
            del record["provenance_json"]
        return record
