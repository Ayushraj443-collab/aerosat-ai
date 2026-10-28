import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import numpy as np
import pandas as pd

try:
    import netCDF4 as nc
except ImportError:
    nc = None

logger = logging.getLogger(__name__)

# Standard conversion: 1 mol/m^2 = 6.02214e19 molec/cm^2 = 60221.415 x 10^15 molec/cm^2
MOL_M2_TO_1E15_MOLEC_CM2 = 60221.415

class Sentinel5PNetCDFParser:
    """
    Scientific parser for Sentinel-5P / TROPOMI Level-2 NetCDF granules.
    Extracts tropospheric pollutant column densities (NO2, AER_AI), geolocations,
    observation timestamps, and applies strict ESA quality filtering (qa_value >= 0.50).
    """

    @classmethod
    def is_available(cls) -> bool:
        """Verify if netCDF4 is installed and ready."""
        return nc is not None

    @classmethod
    def parse_granule(
        cls,
        granule_path: Path,
        bbox: Optional[Dict[str, float]] = None,
        qa_threshold: float = 0.50,
        pollutant: str = "NO2"
    ) -> Dict[str, Any]:
        """
        Open, inspect, and parse genuine Level-2 NetCDF granule.
        Returns extracted valid pixels filtered by QA and optional bounding box.
        """
        if not cls.is_available():
            raise ImportError("netCDF4 package is required to parse Sentinel-5P granules.")

        granule_path = Path(granule_path)
        if not granule_path.exists():
            raise FileNotFoundError(f"Sentinel-5P granule not found: {granule_path}")

        p_upper = pollutant.upper()
        ds = nc.Dataset(granule_path, "r")
        try:
            prod = ds.groups.get("PRODUCT")
            if not prod:
                raise ValueError("Corrupt Sentinel-5P granule: 'PRODUCT' group not found.")

            # Extract spatial arrays (time=1, scanline, ground_pixel)
            lats = prod.variables["latitude"][0, :, :]
            lons = prod.variables["longitude"][0, :, :]
            qa = prod.variables["qa_value"][0, :, :]

            # Granule metadata
            time_start = getattr(ds, "time_coverage_start", None)
            time_end = getattr(ds, "time_coverage_end", None)
            granule_title = getattr(ds, "title", "Sentinel-5P Level-2 Product")

            if p_upper == "NO2":
                col_var = prod.variables["nitrogendioxide_tropospheric_column"]
                col_raw = col_var[0, :, :]
                unit_raw = getattr(col_var, "units", "mol m-2")
            else:
                col_var = prod.variables.get("aerosol_index_340_380", prod.variables.get("aerosol_index_354_388"))
                col_raw = col_var[0, :, :] if col_var else qa * 0.0
                unit_raw = "Aerosol Index"

            # Create quality mask
            valid_mask = (qa >= qa_threshold) & (~np.isnan(col_raw)) & (~np.isnan(lats)) & (~np.isnan(lons))

            # Apply spatial bounding box if provided
            if bbox:
                min_lat = bbox.get("min_lat", -90.0)
                max_lat = bbox.get("max_lat", 90.0)
                min_lon = bbox.get("min_lon", -180.0)
                max_lon = bbox.get("max_lon", 180.0)
                spatial_mask = (lats >= min_lat) & (lats <= max_lat) & (lons >= min_lon) & (lons <= max_lon)
                valid_mask = valid_mask & spatial_mask

            indices = np.where(valid_mask)
            n_pixels = len(indices[0])

            pixels = []
            for idx in range(n_pixels):
                s_idx = indices[0][idx]
                g_idx = indices[1][idx]
                lat_val = float(lats[s_idx, g_idx])
                lon_val = float(lons[s_idx, g_idx])
                qa_val = float(qa[s_idx, g_idx])
                raw_col = float(col_raw[s_idx, g_idx])
                
                # Conversion to standard scientific unit: 10^15 molec/cm^2
                col_1e15 = round(raw_col * MOL_M2_TO_1E15_MOLEC_CM2, 4) if p_upper == "NO2" else round(raw_col, 3)

                pixels.append({
                    "scanline": int(s_idx),
                    "ground_pixel": int(g_idx),
                    "latitude": round(lat_val, 5),
                    "longitude": round(lon_val, 5),
                    "qa_value": round(qa_val, 3),
                    "column_raw": raw_col,
                    "column_raw_unit": unit_raw,
                    "column_1e15": col_1e15,
                    "unit": "10¹⁵ molec/cm²" if p_upper == "NO2" else "Aerosol Index"
                })

            return {
                "granule_name": granule_path.name,
                "title": granule_title,
                "time_coverage_start": time_start,
                "time_coverage_end": time_end,
                "total_valid_pixels": n_pixels,
                "pollutant": p_upper,
                "qa_threshold": qa_threshold,
                "pixels": pixels
            }
        finally:
            ds.close()

    @classmethod
    def match_stations(
        cls,
        granule_path: Path,
        stations: Dict[str, Dict[str, Any]],
        max_dist_km: float = 5.5,
        qa_threshold: float = 0.50,
        pollutant: str = "NO2"
    ) -> List[Dict[str, Any]]:
        """
        Spatially match official ground stations to the nearest valid satellite pixel
        from the Sentinel-5P Level-2 NetCDF granule.
        """
        if not cls.is_available():
            raise ImportError("netCDF4 package is required to parse Sentinel-5P granules.")

        granule_path = Path(granule_path)
        ds = nc.Dataset(granule_path, "r")
        try:
            prod = ds.groups["PRODUCT"]
            lats = prod.variables["latitude"][0, :, :]
            lons = prod.variables["longitude"][0, :, :]
            qa = prod.variables["qa_value"][0, :, :]

            p_upper = pollutant.upper()
            if p_upper == "NO2":
                col_var = prod.variables["nitrogendioxide_tropospheric_column"]
                col_raw = col_var[0, :, :]
            else:
                col_var = prod.variables.get("aerosol_index_340_380")
                col_raw = col_var[0, :, :] if col_var else qa * 0.0

            time_start = getattr(ds, "time_coverage_start", "2024-01-05T07:00:00Z")

            # Bounding box encompassing all stations plus search buffer (~0.2 degrees)
            if not stations:
                return []

            min_slat = min(s["lat"] for s in stations.values()) - (max_dist_km / 111.0 + 0.15)
            max_slat = max(s["lat"] for s in stations.values()) + (max_dist_km / 111.0 + 0.15)
            min_slon = min(s["lon"] for s in stations.values()) - (max_dist_km / 80.0 + 0.15)
            max_slon = max(s["lon"] for s in stations.values()) + (max_dist_km / 80.0 + 0.15)

            regional_mask = (
                (qa >= qa_threshold) &
                (~np.isnan(col_raw)) &
                (~np.isnan(lats)) &
                (~np.isnan(lons)) &
                (lats >= min_slat) & (lats <= max_slat) &
                (lons >= min_slon) & (lons <= max_slon)
            )
            reg_indices = np.where(regional_mask)
            has_regional = len(reg_indices[0]) > 0

            matches = []
            if not has_regional:
                logger.warning(f"No valid pixels with QA >= {qa_threshold} found within regional bounding box for {granule_path.name}")
                return matches

            reg_lats = lats[reg_indices]
            reg_lons = lons[reg_indices]
            reg_qa = qa[reg_indices]
            reg_col_raw = col_raw[reg_indices]

            for sid, sdata in stations.items():
                stn_lat = sdata["lat"]
                stn_lon = sdata["lon"]
                stn_name = sdata["name"]

                lat_diff_km = (reg_lats - stn_lat) * 111.0
                lon_diff_km = (reg_lons - stn_lon) * (111.0 * np.cos(np.radians(stn_lat)))
                dist_cand = np.sqrt(lat_diff_km**2 + lon_diff_km**2)
                min_cand_idx = np.argmin(dist_cand)
                min_dist = float(dist_cand[min_cand_idx])

                if min_dist <= max_dist_km:
                    sat_lat = float(reg_lats[min_cand_idx])
                    sat_lon = float(reg_lons[min_cand_idx])
                    sat_qa = float(reg_qa[min_cand_idx])
                    raw_col = float(reg_col_raw[min_cand_idx])
                    col_1e15 = round(raw_col * MOL_M2_TO_1E15_MOLEC_CM2, 4) if p_upper == "NO2" else round(raw_col, 3)

                    matches.append({
                        "station_id": sid,
                        "station_name": stn_name,
                        "station_lat": stn_lat,
                        "station_lon": stn_lon,
                        "distance_km": round(min_dist, 2),
                        "satellite_lat": round(sat_lat, 5),
                        "satellite_lon": round(sat_lon, 5),
                        "satellite_qa": round(sat_qa, 3),
                        "satellite_column_raw": raw_col,
                        "satellite_column_1e15": col_1e15,
                        "unit": "10¹⁵ molec/cm²" if p_upper == "NO2" else "Aerosol Index",
                        "granule_name": granule_path.name,
                        "observation_time": time_start
                    })
                else:
                    logger.warning(f"Station {sid} exceeded maximum distance tolerance: {min_dist:.2f} km > {max_dist_km} km")

            return matches
        finally:
            ds.close()
