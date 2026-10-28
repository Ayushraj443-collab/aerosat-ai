import json
import math
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from app.config import settings
from app.utils.geo import approximate_elevation_m, approximate_road_density_proxy, haversine_distance_km

# Realistic Ground Monitoring Station Network in Delhi-NCR
REALISTIC_STATIONS: List[Dict[str, Any]] = [
    {
        "station_id": "DEL_ANAND_VIHAR",
        "name": "Anand Vihar, Delhi",
        "city": "Delhi",
        "latitude": 28.6476,
        "longitude": 77.3158,
        "elevation_m": approximate_elevation_m(28.6476, 77.3158),
        "station_type": "Traffic / Commercial Border",
        "operational_status": "Active",
        "emission_factor": 1.45,  # Heavy bus terminal and highway traffic
        "is_demo": True
    },
    {
        "station_id": "DEL_PUNJABI_BAGH",
        "name": "Punjabi Bagh, Delhi",
        "city": "Delhi",
        "latitude": 28.6740,
        "longitude": 77.1310,
        "elevation_m": approximate_elevation_m(28.6740, 77.1310),
        "station_type": "Commercial / Residential",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    },
    {
        "station_id": "DEL_MANDIR_MARG",
        "name": "Mandir Marg, Delhi",
        "city": "Delhi",
        "latitude": 28.6365,
        "longitude": 77.1996,
        "elevation_m": approximate_elevation_m(28.6365, 77.1996),
        "station_type": "Institutional / Central",
        "operational_status": "Active",
        "emission_factor": 0.95,
        "is_demo": True
    },
    {
        "station_id": "DEL_IGI_AIRPORT",
        "name": "IGI Airport (T3), Delhi",
        "city": "Delhi",
        "latitude": 28.5562,
        "longitude": 77.0999,
        "elevation_m": approximate_elevation_m(28.5562, 77.0999),
        "station_type": "Airport / Southwest Suburb",
        "operational_status": "Active",
        "emission_factor": 1.05,
        "is_demo": True
    },
    {
        "station_id": "DEL_RK_PURAM",
        "name": "R K Puram, Delhi",
        "city": "Delhi",
        "latitude": 28.5633,
        "longitude": 77.1869,
        "elevation_m": approximate_elevation_m(28.5633, 77.1869),
        "station_type": "Residential / Green Urban",
        "operational_status": "Active",
        "emission_factor": 1.05,
        "is_demo": True
    },
    {
        "station_id": "DEL_LODHI_ROAD",
        "name": "Lodhi Road, Delhi (IMD)",
        "city": "Delhi",
        "latitude": 28.5883,
        "longitude": 77.2215,
        "elevation_m": approximate_elevation_m(28.5883, 77.2215),
        "station_type": "Urban Background / Met Observatory",
        "operational_status": "Active",
        "emission_factor": 0.85,
        "is_demo": True
    },
    {
        "station_id": "DEL_JAHANGIRPURI",
        "name": "Jahangirpuri, Delhi",
        "city": "Delhi",
        "latitude": 28.7325,
        "longitude": 77.1706,
        "elevation_m": approximate_elevation_m(28.7325, 77.1706),
        "station_type": "Dense Residential / Light Industrial",
        "operational_status": "Active",
        "emission_factor": 1.35,
        "is_demo": True
    },
    {
        "station_id": "DEL_BAWANA",
        "name": "Bawana Industrial Area, Delhi",
        "city": "Delhi",
        "latitude": 28.7762,
        "longitude": 77.0511,
        "elevation_m": approximate_elevation_m(28.7762, 77.0511),
        "station_type": "Industrial Cluster",
        "operational_status": "Active",
        "emission_factor": 1.50,
        "is_demo": True
    },
    {
        "station_id": "DEL_OKHLA_PH2",
        "name": "Okhla Phase-2, Delhi",
        "city": "Delhi",
        "latitude": 28.5308,
        "longitude": 77.2713,
        "elevation_m": approximate_elevation_m(28.5308, 77.2713),
        "station_type": "Industrial / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.40,
        "is_demo": True
    },
    {
        "station_id": "NOI_SEC_62",
        "name": "Sector 62, Noida",
        "city": "Noida",
        "latitude": 28.6245,
        "longitude": 77.3649,
        "elevation_m": approximate_elevation_m(28.6245, 77.3649),
        "station_type": "Commercial / IT Corridor",
        "operational_status": "Active",
        "emission_factor": 1.15,
        "is_demo": True
    },
    {
        "station_id": "GGN_SEC_51",
        "name": "Sector 51, Gurugram",
        "city": "Gurugram",
        "latitude": 28.4299,
        "longitude": 77.0720,
        "elevation_m": approximate_elevation_m(28.4299, 77.0720),
        "station_type": "Urban Commercial",
        "operational_status": "Active",
        "emission_factor": 1.20,
        "is_demo": True
    },
    {
        "station_id": "GZB_SANJAY_NAGAR",
        "name": "Sanjay Nagar, Ghaziabad",
        "city": "Ghaziabad",
        "latitude": 28.6857,
        "longitude": 77.4538,
        "elevation_m": approximate_elevation_m(28.6857, 77.4538),
        "station_type": "Suburban / Industrial Proximity",
        "operational_status": "Active",
        "emission_factor": 1.38,
        "is_demo": True
    },
    {
        "station_id": "FBD_SEC_16A",
        "name": "Sector 16A, Faridabad",
        "city": "Faridabad",
        "latitude": 28.4088,
        "longitude": 77.3178,
        "elevation_m": approximate_elevation_m(28.4088, 77.3178),
        "station_type": "Commercial / Industrial Fringe",
        "operational_status": "Active",
        "emission_factor": 1.28,
        "is_demo": True
    },
    {
        "station_id": "DEL_WAZIRPUR",
        "name": "Wazirpur, Delhi",
        "city": "Delhi",
        "latitude": 28.6998,
        "longitude": 77.1654,
        "elevation_m": approximate_elevation_m(28.6998, 77.1654),
        "station_type": "Industrial Area",
        "operational_status": "Active",
        "emission_factor": 1.48,
        "is_demo": True
    },
    {
        "station_id": "DEL_ROHINI_SEC16",
        "name": "Rohini Sector 16, Delhi",
        "city": "Delhi",
        "latitude": 28.7326,
        "longitude": 77.1199,
        "elevation_m": approximate_elevation_m(28.7326, 77.1199),
        "station_type": "Dense Residential",
        "operational_status": "Active",
        "emission_factor": 1.18,
        "is_demo": True
    },
    # Patna Stations (Bihar)
    {
        "station_id": "PAT_DRM_DANAPUR",
        "name": "DRM Office Danapur, Patna",
        "city": "Patna",
        "latitude": 25.5867,
        "longitude": 85.0441,
        "elevation_m": 53.0,
        "station_type": "Institutional / Traffic Corridor",
        "operational_status": "Active",
        "emission_factor": 1.35,
        "is_demo": True
    },
    {
        "station_id": "PAT_SAMANPURA",
        "name": "Samanpura, Patna",
        "city": "Patna",
        "latitude": 25.6094,
        "longitude": 85.0883,
        "elevation_m": 53.0,
        "station_type": "Dense Residential / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.40,
        "is_demo": True
    },
    {
        "station_id": "PAT_MURADPUR",
        "name": "Muradpur, Patna University",
        "city": "Patna",
        "latitude": 25.6209,
        "longitude": 85.1683,
        "elevation_m": 54.0,
        "station_type": "Urban Core / University",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    },
    # Ludhiana Stations (Punjab)
    {
        "station_id": "LDH_PAU_CAMPUS",
        "name": "Punjab Agricultural University, Ludhiana",
        "city": "Ludhiana",
        "latitude": 30.9010,
        "longitude": 75.8080,
        "elevation_m": 247.0,
        "station_type": "Agricultural / Background",
        "operational_status": "Active",
        "emission_factor": 1.10,
        "is_demo": True
    },
    {
        "station_id": "LDH_MILLER_GANJ",
        "name": "Miller Ganj Industrial, Ludhiana",
        "city": "Ludhiana",
        "latitude": 30.8876,
        "longitude": 75.8643,
        "elevation_m": 248.0,
        "station_type": "Industrial / Transport Hub",
        "operational_status": "Active",
        "emission_factor": 1.45,
        "is_demo": True
    },
    # Mumbai Stations (Maharashtra)
    {
        "station_id": "MUM_BKC_BANDRA",
        "name": "Bandra Kurla Complex (BKC), Mumbai",
        "city": "Mumbai",
        "latitude": 19.0657,
        "longitude": 72.8688,
        "elevation_m": 10.0,
        "station_type": "Commercial / Financial Core",
        "operational_status": "Active",
        "emission_factor": 1.30,
        "is_demo": True
    },
    {
        "station_id": "MUM_COLABA_NAVY",
        "name": "Colaba Coastal, Mumbai",
        "city": "Mumbai",
        "latitude": 18.9067,
        "longitude": 72.8147,
        "elevation_m": 8.0,
        "station_type": "Coastal Background",
        "operational_status": "Active",
        "emission_factor": 0.85,
        "is_demo": True
    },
    {
        "station_id": "MUM_WORLI_SEA",
        "name": "Worli, Mumbai",
        "city": "Mumbai",
        "latitude": 19.0178,
        "longitude": 72.8178,
        "elevation_m": 12.0,
        "station_type": "Urban Coastal / Traffic",
        "operational_status": "Active",
        "emission_factor": 1.15,
        "is_demo": True
    },
    # Kolkata Stations (West Bengal)
    {
        "station_id": "KOL_VICTORIA_MEM",
        "name": "Victoria Memorial, Kolkata",
        "city": "Kolkata",
        "latitude": 22.5448,
        "longitude": 88.3426,
        "elevation_m": 9.0,
        "station_type": "Heritage / Park Background",
        "operational_status": "Active",
        "emission_factor": 0.90,
        "is_demo": True
    },
    {
        "station_id": "KOL_JADAVPUR_U",
        "name": "Jadavpur, Kolkata",
        "city": "Kolkata",
        "latitude": 22.4988,
        "longitude": 88.3718,
        "elevation_m": 11.0,
        "station_type": "Residential / Institutional",
        "operational_status": "Active",
        "emission_factor": 1.20,
        "is_demo": True
    },
    # Bengaluru Stations (Karnataka)
    {
        "station_id": "BLR_BTM_LAYOUT",
        "name": "BTM Layout, Bengaluru",
        "city": "Bengaluru",
        "latitude": 12.9135,
        "longitude": 77.6101,
        "elevation_m": 914.0,
        "station_type": "Residential / IT Corridor",
        "operational_status": "Active",
        "emission_factor": 1.10,
        "is_demo": True
    },
    # Lucknow Stations (Uttar Pradesh)
    {
        "station_id": "LKO_LALBAGH_COMM",
        "name": "Lalbagh Commercial, Lucknow",
        "city": "Lucknow",
        "latitude": 26.8496,
        "longitude": 80.9385,
        "elevation_m": 123.0,
        "station_type": "Commercial Core",
        "operational_status": "Active",
        "emission_factor": 1.35,
        "is_demo": True
    },
    # Jaipur Stations (Rajasthan)
    {
        "station_id": "JAI_ADARSH_NAGAR",
        "name": "Adarsh Nagar, Jaipur",
        "city": "Jaipur",
        "latitude": 26.9012,
        "longitude": 75.8360,
        "elevation_m": 431.0,
        "station_type": "Commercial / Tourist Core",
        "operational_status": "Active",
        "emission_factor": 1.20,
        "is_demo": True
    },
    # Ahmedabad Stations (Gujarat)
    {
        "station_id": "AHM_MANINAGAR",
        "name": "Maninagar, Ahmedabad",
        "city": "Ahmedabad",
        "latitude": 22.9924,
        "longitude": 72.6033,
        "elevation_m": 53.0,
        "station_type": "Commercial / Residential",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    },
    {
        "station_id": "AHM_CHANDKHEDA",
        "name": "Chandkheda, Ahmedabad",
        "city": "Ahmedabad",
        "latitude": 23.1118,
        "longitude": 72.5839,
        "elevation_m": 57.0,
        "station_type": "Urban Background",
        "operational_status": "Active",
        "emission_factor": 1.10,
        "is_demo": True
    },
    # Hyderabad Stations (Telangana)
    {
        "station_id": "HYD_SANATHNAGAR",
        "name": "Sanathnagar, Hyderabad",
        "city": "Hyderabad",
        "latitude": 17.4589,
        "longitude": 78.4411,
        "elevation_m": 536.0,
        "station_type": "Industrial / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.30,
        "is_demo": True
    },
    {
        "station_id": "HYD_ICRISAT",
        "name": "ICRISAT Patancheru, Hyderabad",
        "city": "Hyderabad",
        "latitude": 17.5111,
        "longitude": 78.2752,
        "elevation_m": 545.0,
        "station_type": "Semi-Arid Background",
        "operational_status": "Active",
        "emission_factor": 0.95,
        "is_demo": True
    },
    {
        "station_id": "HYD_ZOO_PARK",
        "name": "Zoo Park Bahadurpura, Hyderabad",
        "city": "Hyderabad",
        "latitude": 17.3489,
        "longitude": 78.4503,
        "elevation_m": 505.0,
        "station_type": "Urban / Ecological",
        "operational_status": "Active",
        "emission_factor": 1.05,
        "is_demo": True
    },
    # Chennai Stations (Tamil Nadu)
    {
        "station_id": "CHE_ALANDUR",
        "name": "Alandur Bus Depot, Chennai",
        "city": "Chennai",
        "latitude": 13.0031,
        "longitude": 80.2014,
        "elevation_m": 12.0,
        "station_type": "Traffic / Transport Hub",
        "operational_status": "Active",
        "emission_factor": 1.35,
        "is_demo": True
    },
    {
        "station_id": "CHE_MANALI",
        "name": "Manali Industrial Area, Chennai",
        "city": "Chennai",
        "latitude": 13.1652,
        "longitude": 80.2604,
        "elevation_m": 8.0,
        "station_type": "Petrochemical / Industrial",
        "operational_status": "Active",
        "emission_factor": 1.50,
        "is_demo": True
    },
    # Pune Stations (Maharashtra)
    {
        "station_id": "PUN_SHIVAJINAGAR",
        "name": "Shivajinagar, Pune",
        "city": "Pune",
        "latitude": 18.5314,
        "longitude": 73.8446,
        "elevation_m": 560.0,
        "station_type": "Urban Core / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    },
    {
        "station_id": "PUN_BHOSARI",
        "name": "Bhosari Industrial Area, Pune",
        "city": "Pune",
        "latitude": 18.6277,
        "longitude": 73.8475,
        "elevation_m": 575.0,
        "station_type": "Auto Manufacturing Hub",
        "operational_status": "Active",
        "emission_factor": 1.40,
        "is_demo": True
    },
    # Chandigarh
    {
        "station_id": "CHD_SEC_22",
        "name": "Sector 22, Chandigarh",
        "city": "Chandigarh",
        "latitude": 30.7345,
        "longitude": 76.7695,
        "elevation_m": 321.0,
        "station_type": "Commercial Core",
        "operational_status": "Active",
        "emission_factor": 1.15,
        "is_demo": True
    },
    {
        "station_id": "CHD_IMTECH",
        "name": "IMTECH Sector 39, Chandigarh",
        "city": "Chandigarh",
        "latitude": 30.7485,
        "longitude": 76.7325,
        "elevation_m": 325.0,
        "station_type": "Institutional Background",
        "operational_status": "Active",
        "emission_factor": 0.90,
        "is_demo": True
    },
    # Varanasi (Uttar Pradesh)
    {
        "station_id": "VNS_ARDHALI_BAZAR",
        "name": "Ardhali Bazar, Varanasi",
        "city": "Varanasi",
        "latitude": 25.3524,
        "longitude": 82.9868,
        "elevation_m": 80.0,
        "station_type": "Dense Commercial",
        "operational_status": "Active",
        "emission_factor": 1.42,
        "is_demo": True
    },
    {
        "station_id": "VNS_BHU",
        "name": "Banaras Hindu University (BHU), Varanasi",
        "city": "Varanasi",
        "latitude": 25.2677,
        "longitude": 82.9913,
        "elevation_m": 82.0,
        "station_type": "Institutional / Green Campus",
        "operational_status": "Active",
        "emission_factor": 0.92,
        "is_demo": True
    },
    # Guwahati (Assam)
    {
        "station_id": "GAU_PAN_BAZAR",
        "name": "Pan Bazar, Guwahati",
        "city": "Guwahati",
        "latitude": 26.1856,
        "longitude": 91.7483,
        "elevation_m": 54.0,
        "station_type": "Brahmaputra Valley Urban Core",
        "operational_status": "Active",
        "emission_factor": 1.28,
        "is_demo": True
    },
    {
        "station_id": "GAU_IIT_NORTH",
        "name": "IIT Guwahati, North Guwahati",
        "city": "Guwahati",
        "latitude": 26.1912,
        "longitude": 91.6917,
        "elevation_m": 55.0,
        "station_type": "Valley Background / Research",
        "operational_status": "Active",
        "emission_factor": 0.88,
        "is_demo": True
    },
    # Ranchi (Jharkhand)
    {
        "station_id": "RNC_DORANDA",
        "name": "Doranda, Ranchi",
        "city": "Ranchi",
        "latitude": 23.3342,
        "longitude": 85.3238,
        "elevation_m": 650.0,
        "station_type": "Plateau Urban / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    },
    {
        "station_id": "RNC_EKKA_CHOWK",
        "name": "Albert Ekka Chowk, Ranchi",
        "city": "Ranchi",
        "latitude": 23.3702,
        "longitude": 85.3263,
        "elevation_m": 653.0,
        "station_type": "Central Traffic Intersection",
        "operational_status": "Active",
        "emission_factor": 1.45,
        "is_demo": True
    },
    # Bhopal (Madhya Pradesh)
    {
        "station_id": "BPL_TT_NAGAR",
        "name": "TT Nagar, Bhopal",
        "city": "Bhopal",
        "latitude": 23.2384,
        "longitude": 77.3995,
        "elevation_m": 527.0,
        "station_type": "Central Urban Core",
        "operational_status": "Active",
        "emission_factor": 1.20,
        "is_demo": True
    },
    {
        "station_id": "BPL_PARYAVARAN",
        "name": "Paryavaran Parisar, Bhopal",
        "city": "Bhopal",
        "latitude": 23.2201,
        "longitude": 77.4418,
        "elevation_m": 525.0,
        "station_type": "Institutional / Ecological",
        "operational_status": "Active",
        "emission_factor": 0.95,
        "is_demo": True
    },
    # Dehradun (Uttarakhand)
    {
        "station_id": "DDN_CLOCK_TOWER",
        "name": "Clock Tower, Dehradun",
        "city": "Dehradun",
        "latitude": 30.3244,
        "longitude": 78.0418,
        "elevation_m": 640.0,
        "station_type": "Doon Valley Urban / Commercial",
        "operational_status": "Active",
        "emission_factor": 1.30,
        "is_demo": True
    },
    {
        "station_id": "DDN_ISBT",
        "name": "ISBT Haridwar Bypass, Dehradun",
        "city": "Dehradun",
        "latitude": 30.2858,
        "longitude": 78.0078,
        "elevation_m": 625.0,
        "station_type": "Interstate Transport Hub",
        "operational_status": "Active",
        "emission_factor": 1.45,
        "is_demo": True
    },
    {
        "station_id": "ASR_GOLDEN_TEMPLE",
        "name": "Golden Temple, Amritsar",
        "city": "Amritsar",
        "latitude": 31.6200,
        "longitude": 74.8765,
        "elevation_m": 234.0,
        "station_type": "Heritage & Urban Core",
        "operational_status": "Active",
        "emission_factor": 1.35,
        "is_demo": True
    },
    {
        "station_id": "ASR_CIVIL_LINES",
        "name": "Civil Lines, Amritsar",
        "city": "Amritsar",
        "latitude": 31.6510,
        "longitude": 74.8715,
        "elevation_m": 236.0,
        "station_type": "Urban Residential",
        "operational_status": "Active",
        "emission_factor": 1.20,
        "is_demo": True
    },
    {
        "station_id": "JAL_CIVIL_HOSPITAL",
        "name": "Civil Hospital, Jalandhar",
        "city": "Jalandhar",
        "latitude": 31.3260,
        "longitude": 75.5762,
        "elevation_m": 228.0,
        "station_type": "Urban Healthcare & Traffic",
        "operational_status": "Active",
        "emission_factor": 1.40,
        "is_demo": True
    },
    {
        "station_id": "JAL_MODEL_TOWN",
        "name": "Model Town, Jalandhar",
        "city": "Jalandhar",
        "latitude": 31.3120,
        "longitude": 75.5820,
        "elevation_m": 229.0,
        "station_type": "Commercial & Residential",
        "operational_status": "Active",
        "emission_factor": 1.25,
        "is_demo": True
    }
]

def generate_synthetic_dataset(
    start_date: str = "2024-01-01",
    days: int = 120,
    seed: int = 42
) -> pd.DataFrame:
    """
    Generate a high-fidelity synthetic dataset matching atmospheric physics principles:
    - Inversion and shallow boundary layer heights in winter concentrate surface pollutants.
    - Strong winds promote ventilation and horizontal dispersion.
    - Satellite TROPOMI column relates to surface concentration divided by boundary layer height with retrieval noise.
    - Missing data flags: ~7% of satellite pixels have qa_value < 0.5 (cloud cover/snow/glint).
    - Clear demo markers.
    """
    random.seed(seed)
    np.random.seed(seed)
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    records = []
    
    pollutants = ["NO2", "PM2.5", "SO2", "CO", "O3"]
    
    for day_offset in range(days):
        current_date = start_dt + timedelta(days=day_offset)
        date_str = current_date.strftime("%Y-%m-%d")
        month = current_date.month
        day_of_year = current_date.timetuple().tm_yday
        
        # Seasonality index (1.0 = peak winter late Dec/Jan, 0.0 = peak summer/monsoon)
        winter_factor = max(0.0, math.cos(2 * math.pi * (day_of_year - 15) / 365.0))
        monsoon_factor = 1.0 if (month in [7, 8, 9]) else 0.0
        
        # Regional synoptic meteorology for the day
        base_temp = 14.0 + (18.0 * (1.0 - winter_factor)) + np.random.normal(0, 2.0)
        base_humidity = 40.0 + (35.0 * monsoon_factor) + (15.0 * winter_factor) + np.random.normal(0, 5.0)
        base_humidity = float(np.clip(base_humidity, 20.0, 95.0))
        
        # Boundary Layer Height: 350m - 700m in winter; 1200m - 2200m in summer
        blh_m = float(np.clip(450.0 + (1400.0 * (1.0 - winter_factor)) + np.random.normal(0, 100.0), 300.0, 2500.0))
        
        # Wind speed (m/s)
        wind_speed_ms = float(np.clip(1.2 + (2.5 * (1.0 - winter_factor)) + np.random.normal(0, 0.6), 0.5, 8.0))
        wind_dir_deg = float((290.0 + np.random.normal(0, 45.0)) % 360) # North-westerly winds dominant
        
        # Atmospheric ventilation coefficient (BLH * Wind Speed)
        ventilation_index = (blh_m * wind_speed_ms) / 1000.0
        dispersion_damping = float(np.clip(1.5 / max(0.6, ventilation_index), 0.5, 2.8))
        
        for stn in REALISTIC_STATIONS:
            stn_id = stn["station_id"]
            stn_name = stn["name"]
            lat = stn["latitude"]
            lon = stn["longitude"]
            elevation = stn["elevation_m"]
            ef = stn["emission_factor"]
            road_proxy = approximate_road_density_proxy(lat, lon)
            
            # Local micro-climate perturbations
            local_temp = round(base_temp + np.random.normal(0, 0.5), 1)
            local_rh = round(base_humidity + np.random.normal(0, 1.5), 1)
            local_wind = round(max(0.3, wind_speed_ms + np.random.normal(0, 0.3)), 2)
            
            # Cloud cover / satellite QA flag simulation
            # Summer/Monsoon has higher cloud coverage
            cloud_prob = 0.25 if monsoon_factor > 0 else 0.08
            is_cloudy = random.random() < cloud_prob
            sat_qa = round(float(np.clip(np.random.normal(0.35, 0.08), 0.1, 0.49)) if is_cloudy 
                           else float(np.clip(np.random.normal(0.88, 0.06), 0.55, 1.0)), 2)
            
            for pol in pollutants:
                # Physics calculation for ground value
                if pol == "NO2":
                    unit = "µg/m³"
                    # Base emission modulated by traffic/industrial factor and ventilation
                    base_val = 35.0 * ef * (1.0 + 0.5 * road_proxy) * dispersion_damping
                    ground_val = float(np.clip(base_val + np.random.normal(0, 4.0), 8.0, 175.0))
                    
                    # Sentinel-5P Tropospheric Column NO2 (10^15 molec/cm^2)
                    # Column density is related to integral over BLH with noise
                    column_val = (ground_val * (blh_m / 1000.0) * 0.18) + np.random.normal(0, 0.8)
                    column_val = float(np.clip(column_val, 1.2, 38.0))
                    
                elif pol == "PM2.5":
                    unit = "µg/m³"
                    # Biomass / winter factor impacts PM2.5 heavily
                    base_val = 55.0 * ef * (1.0 + 1.2 * winter_factor) * dispersion_damping
                    if monsoon_factor > 0:
                        base_val *= 0.4  # Wet scavenging
                    ground_val = float(np.clip(base_val + np.random.normal(0, 12.0), 15.0, 480.0))
                    
                    # Satellite Aerosol Optical Index proxy (0.2 to 3.5)
                    column_val = float(np.clip((ground_val / 110.0) + np.random.normal(0, 0.15), 0.15, 4.2))
                    
                elif pol == "SO2":
                    unit = "µg/m³"
                    base_val = 14.0 * (1.0 if "Industrial" in stn["station_type"] else 0.6) * dispersion_damping
                    ground_val = float(np.clip(base_val + np.random.normal(0, 2.0), 3.0, 75.0))
                    # Total column DU
                    column_val = float(np.clip((ground_val * 0.04) + np.random.normal(0, 0.08), 0.1, 3.5))
                    
                elif pol == "CO":
                    unit = "mg/m³"
                    base_val = 1.1 * ef * (1.0 + 0.3 * road_proxy) * dispersion_damping
                    ground_val = float(np.clip(base_val + np.random.normal(0, 0.15), 0.2, 5.5))
                    # Total column 10^18 molec/cm^2
                    column_val = float(np.clip((ground_val * 0.65) + np.random.normal(0, 0.1), 0.5, 4.5))
                    
                else: # O3
                    unit = "µg/m³"
                    # Sunlight & temperature enhance photochemical ozone; NO titration in heavy traffic reduces local O3
                    photochem_factor = max(0.2, (local_temp - 10.0) / 25.0)
                    base_val = 40.0 * photochem_factor * (1.2 - 0.4 * road_proxy)
                    ground_val = float(np.clip(base_val + np.random.normal(0, 5.0), 10.0, 160.0))
                    column_val = float(np.clip(280.0 + ground_val * 0.4 + np.random.normal(0, 5.0), 250.0, 360.0))
                
                records.append({
                    "date": date_str,
                    "station_id": stn_id,
                    "station_name": stn_name,
                    "latitude": lat,
                    "longitude": lon,
                    "pollutant": pol,
                    "ground_value": round(ground_val, 2),
                    "unit": unit,
                    "satellite_column": round(column_val, 3),
                    "satellite_qa": sat_qa,
                    "temperature_c": local_temp,
                    "relative_humidity_pct": local_rh,
                    "wind_speed_ms": local_wind,
                    "wind_direction_deg": round(wind_dir_deg, 1),
                    "boundary_layer_height_m": round(blh_m, 1),
                    "elevation_m": elevation,
                    "road_density_proxy": road_proxy,
                    "is_demo": True,
                    "provenance": "DEMONSTRATION DATA - NOT REAL OBSERVATIONS"
                })
                
    df = pd.DataFrame(records)
    return df

def initialize_demo_data_if_needed():
    """Generate demo station registry and synthetic observation pairs if not already present."""
    stations_path = settings.DATA_RAW_DIR / "synthetic_cpcb_stations.json"
    dataset_path = settings.DATA_RAW_DIR / "synthetic_sentinel5p_cpcb_pairs.csv"
    
    # Always keep station registry in sync with full list
    with open(stations_path, "w", encoding="utf-8") as f:
        json.dump(REALISTIC_STATIONS, f, indent=2)
        
    if not dataset_path.exists():
        df = generate_synthetic_dataset(start_date="2024-01-01", days=120)
        df.to_csv(dataset_path, index=False)
        
    return stations_path, dataset_path
