import math
from typing import List, Dict, Any, Tuple

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def validate_coordinates(lat: float, lon: float) -> Tuple[bool, str]:
    """Validate latitude and longitude values."""
    if not (-90.0 <= lat <= 90.0):
        return False, f"Latitude {lat} out of range [-90, 90]"
    if not (-180.0 <= lon <= 180.0):
        return False, f"Longitude {lon} out of range [-180, 180]"
    return True, "Valid"

def generate_spatial_grid(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    resolution_km: float = 1.0
) -> List[Dict[str, Any]]:
    """
    Generate an explicit spatial grid within the bounding box at the given target resolution.
    1 degree latitude is approx 111.0 km.
    1 degree longitude at latitude phi is approx 111.0 * cos(phi) km.
    Returns grid cells with center point and cell bounding box for GeoJSON rendering.
    """
    mean_lat = (min_lat + max_lat) / 2.0
    lat_step = resolution_km / 111.0
    lon_step = resolution_km / (111.0 * math.cos(math.radians(mean_lat)))
    
    cells = []
    curr_lat = min_lat + lat_step / 2.0
    cell_idx = 0
    
    while curr_lat <= max_lat:
        curr_lon = min_lon + lon_step / 2.0
        while curr_lon <= max_lon:
            half_lat = lat_step / 2.0
            half_lon = lon_step / 2.0
            
            # 4 corners in GeoJSON [lon, lat] format
            polygon_coords = [
                [round(curr_lon - half_lon, 5), round(curr_lat - half_lat, 5)],
                [round(curr_lon + half_lon, 5), round(curr_lat - half_lat, 5)],
                [round(curr_lon + half_lon, 5), round(curr_lat + half_lat, 5)],
                [round(curr_lon - half_lon, 5), round(curr_lat + half_lat, 5)],
                [round(curr_lon - half_lon, 5), round(curr_lat - half_lat, 5)]
            ]
            
            cells.append({
                "cell_id": f"cell_{cell_idx}",
                "center_lat": round(curr_lat, 5),
                "center_lon": round(curr_lon, 5),
                "step_lat": round(lat_step, 6),
                "step_lon": round(lon_step, 6),
                "polygon": polygon_coords,
                "bbox": [
                    round(curr_lon - half_lon, 5),
                    round(curr_lat - half_lat, 5),
                    round(curr_lon + half_lon, 5),
                    round(curr_lat + half_lat, 5)
                ]
            })
            cell_idx += 1
            curr_lon += lon_step
        curr_lat += lat_step
        
    return cells

def distance_to_nearest_station(lat: float, lon: float, stations: List[Dict[str, Any]]) -> Tuple[float, str]:
    """Calculate distance to nearest ground monitoring station in km."""
    if not stations:
        return 0.0, "Unknown"
    
    min_dist = float('inf')
    nearest_station = ""
    for stn in stations:
        dist = haversine_distance_km(lat, lon, stn["latitude"], stn["longitude"])
        if dist < min_dist:
            min_dist = dist
            nearest_station = stn["station_id"]
    return round(min_dist, 3), nearest_station

def approximate_elevation_m(lat: float, lon: float) -> float:
    """
    Approximates physical elevation for Delhi-NCR terrain (m MSL).
    Delhi Ridge: ~260m - 280m southwest.
    Yamuna river plain: ~205m - 215m east.
    """
    # Simple defensible topographic proxy based on distance to Delhi Ridge vs Yamuna floodplains
    ridge_lat, ridge_lon = 28.55, 77.15
    dist_to_ridge = haversine_distance_km(lat, lon, ridge_lat, ridge_lon)
    base_elev = 215.0
    ridge_bump = max(0.0, 55.0 - (dist_to_ridge * 2.5))
    return round(base_elev + ridge_bump, 1)

def approximate_road_density_proxy(lat: float, lon: float) -> float:
    """
    Approximates urban road density / human activity index [0.0 - 1.0]
    based on proximity to Connaught Place / Central Delhi (28.63, 77.22).
    """
    center_lat, center_lon = 28.6304, 77.2177
    dist_center = haversine_distance_km(lat, lon, center_lat, center_lon)
    # Decays with distance from urban core
    density = max(0.15, 1.0 - (dist_center / 35.0))
    return round(min(1.0, density), 3)
