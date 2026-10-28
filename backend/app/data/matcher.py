import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points in kilometers using Haversine formula."""
    r = 6371.0 # Earth's mean radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c

class SpatiotemporalMatcher:
    """
    Scientifically defensible spatiotemporal matcher for satellite column density
    and ground-level surface air quality observations.
    """

    def __init__(
        self,
        max_spatial_distance_km: float = 5.0,
        max_temporal_diff_hours: float = 3.0,
        min_satellite_qa: float = 0.50
    ):
        self.max_spatial_distance_km = max_spatial_distance_km
        self.max_temporal_diff_hours = max_temporal_diff_hours
        self.min_satellite_qa = min_satellite_qa

    def parse_iso_time(self, t_str: str) -> Optional[datetime]:
        """Safely parse various ISO timestamp formats into UTC datetime."""
        if not t_str:
            return None
        t_clean = t_str.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(t_clean)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            try:
                dt = datetime.strptime(t_str[:19], "%Y-%m-%dT%H:%M:%S")
                return dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None

    def match_observations(
        self,
        satellite_records: List[Dict[str, Any]],
        ground_records: List[Dict[str, Any]],
        meteorological_records: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Execute rigorous matching between satellite pixels and ground station observations.
        
        Scientific Rules:
        1. Never match across incompatible pollutants (e.g. S5P NO2 cannot match PM2.5).
        2. Never equate satellite column density (mol/m2 or 10^15 molec/cm2) with surface mass concentration (ug/m3).
        3. Exclude satellite pixels with QA flag < min_satellite_qa (Copernicus recommended threshold: 0.50; cloud-free: 0.75).
        4. Spatial tolerance: Haversine distance <= max_spatial_distance_km.
        5. Temporal tolerance: |delta t| <= max_temporal_diff_hours.
        6. Missing observations are preserved as None/rejected. Never manufacture synthetic pairs.
        """
        matched_pairs = []
        rejected_counts = {
            "qa_filtered": 0,
            "spatial_out_of_bounds": 0,
            "temporal_out_of_bounds": 0,
            "pollutant_mismatch": 0,
            "invalid_ground_value": 0
        }

        if not satellite_records or not ground_records:
            return {
                "status": "NO_PAIRS_MATCHED",
                "matched_count": 0,
                "matched_pairs": [],
                "rejection_summary": rejected_counts,
                "message": "Insufficient satellite or ground records provided for matching."
            }

        # Index ground records by pollutant
        for sat in satellite_records:
            sat_qa = float(sat.get("satellite_qa", 0.0))
            if sat_qa < self.min_satellite_qa:
                rejected_counts["qa_filtered"] += 1
                continue

            sat_lat = float(sat.get("latitude", 0.0))
            sat_lon = float(sat.get("longitude", 0.0))
            sat_time = self.parse_iso_time(sat.get("observation_time") or sat.get("date", ""))
            sat_pollutant = str(sat.get("pollutant", "")).upper()

            if not sat_time:
                continue

            best_match = None
            min_dist = float("inf")

            for gnd in ground_records:
                gnd_pollutant = str(gnd.get("pollutant", "")).upper()
                if gnd_pollutant != sat_pollutant:
                    rejected_counts["pollutant_mismatch"] += 1
                    continue

                gnd_val = gnd.get("ground_value")
                if gnd_val is None or float(gnd_val) <= 0.0:
                    rejected_counts["invalid_ground_value"] += 1
                    continue

                gnd_lat = float(gnd.get("latitude", 0.0))
                gnd_lon = float(gnd.get("longitude", 0.0))
                dist_km = haversine_distance_km(sat_lat, sat_lon, gnd_lat, gnd_lon)

                if dist_km > self.max_spatial_distance_km:
                    rejected_counts["spatial_out_of_bounds"] += 1
                    continue

                gnd_time = self.parse_iso_time(gnd.get("observation_time") or gnd.get("date", ""))
                if not gnd_time:
                    continue

                time_diff_hours = abs((sat_time - gnd_time).total_seconds()) / 3600.0
                if time_diff_hours > self.max_temporal_diff_hours:
                    rejected_counts["temporal_out_of_bounds"] += 1
                    continue

                # Valid match candidate found; prioritize closest spatial distance
                if dist_km < min_dist:
                    min_dist = dist_km
                    best_match = (gnd, dist_km, time_diff_hours)

            if best_match:
                matched_gnd, dist_km, time_diff_hours = best_match
                pair_id = f"MATCH_{sat.get('id', 'SAT')}_{matched_gnd.get('id', 'GND')}"
                
                matched_pairs.append({
                    "id": pair_id,
                    "data_mode": matched_gnd.get("data_mode", "REAL"),
                    "pollutant": sat_pollutant,
                    "date": sat.get("date", str(sat_time)[:10]),
                    "observation_time": sat.get("observation_time", str(sat_time)),
                    "station_id": matched_gnd.get("station_id"),
                    "station_name": matched_gnd.get("station_name"),
                    "latitude": matched_gnd.get("latitude"),
                    "longitude": matched_gnd.get("longitude"),
                    "ground_value": float(matched_gnd.get("ground_value")),
                    "ground_unit": matched_gnd.get("unit", "µg/m³"),
                    "satellite_column": float(sat["satellite_column"]) if sat.get("satellite_column") not in (None, "") else None,
                    "satellite_unit": sat.get("unit", "10¹⁵ molec/cm²"),
                    "satellite_qa": sat_qa,
                    "spatial_distance_km": round(dist_km, 3),
                    "temporal_diff_hours": round(time_diff_hours, 3),
                    "temperature_c": matched_gnd.get("temperature_c"),
                    "relative_humidity_pct": matched_gnd.get("relative_humidity_pct"),
                    "wind_speed_ms": matched_gnd.get("wind_speed_ms"),
                    "wind_direction_deg": matched_gnd.get("wind_direction_deg"),
                    "boundary_layer_height_m": matched_gnd.get("boundary_layer_height_m"),
                    "elevation_m": matched_gnd.get("elevation_m"),
                    "road_density_proxy": matched_gnd.get("road_density_proxy", 1.0),
                    "scientific_assumptions": (
                        "Satellite column density integrated through atmospheric depth; "
                        "Ground station measures surface boundary-layer concentration. "
                        "Boundary layer height and meteorological features bridge column-to-surface relationship."
                    )
                })

        return {
            "status": "SUCCESS" if matched_pairs else "NO_PAIRS_MET_CRITERIA",
            "matched_count": len(matched_pairs),
            "matched_pairs": matched_pairs,
            "rejection_summary": rejected_counts,
            "tolerances": {
                "max_spatial_distance_km": self.max_spatial_distance_km,
                "max_temporal_diff_hours": self.max_temporal_diff_hours,
                "min_satellite_qa": self.min_satellite_qa
            }
        }
