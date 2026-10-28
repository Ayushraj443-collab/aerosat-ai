import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.sentinel5p_parser import Sentinel5PNetCDFParser
from app.data.connectors import OFFICIAL_CPCB_STATIONS
from app.config import settings

def main():
    fpath = settings.DATA_RAW_DIR / "sentinel5p" / "S5P_OFFL_L2__NO2____20240105T062859_20240105T081029_32275_03_020600_20240106T223933.nc"
    print(f"Testing Sentinel5PNetCDFParser on: {fpath}")
    
    res = Sentinel5PNetCDFParser.parse_granule(
        fpath,
        bbox={"min_lat": 28.2, "max_lat": 28.95, "min_lon": 76.8, "max_lon": 77.6},
        qa_threshold=0.50
    )
    print("Parser title:", res["title"])
    print("Total valid pixels in Delhi-NCR:", res["total_valid_pixels"])
    print("First pixel:", res["pixels"][0])

    matches = Sentinel5PNetCDFParser.match_stations(fpath, OFFICIAL_CPCB_STATIONS, max_dist_km=5.5)
    print(f"\nTotal stations matched within 5.5 km: {len(matches)} / {len(OFFICIAL_CPCB_STATIONS)}")
    for m in matches[:5]:
        print(f"  {m['station_id']}: dist={m['distance_km']} km, col={m['satellite_column_1e15']} 10^15 molec/cm^2, qa={m['satellite_qa']}")

if __name__ == "__main__":
    main()
