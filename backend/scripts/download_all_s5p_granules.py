import sys
import time
import urllib.request
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager
from app.config import settings

GRANULES = [
    {
        "date": "2024-01-01",
        "pid": "1bba9fe0-1623-45e6-acac-79723e339809",
        "name": "S5P_OFFL_L2__NO2____20240101T074458_20240101T092628_32219_03_020600_20240102T234931.nc",
        "size": 604085449
    },
    {
        "date": "2024-01-03",
        "pid": "d1866488-e393-46ef-af37-1153360fba43",
        "name": "S5P_OFFL_L2__NO2____20240103T070658_20240103T084828_32247_03_020600_20240104T230737.nc",
        "size": 605553655
    },
    {
        "date": "2024-01-07",
        "pid": "f48f3898-1ad2-487d-bc5f-cceb03d39b2e",
        "name": "S5P_OFFL_L2__NO2____20240107T073230_20240107T091400_32304_03_020600_20240108T234415.nc",
        "size": 607994883
    }
]

def download_granule(g, token):
    out_dir = settings.DATA_RAW_DIR / "sentinel5p"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / g["name"]
    
    if out_file.exists() and out_file.stat().st_size == g["size"]:
        print(f"[{g['date']}] Already exists: {g['name']} ({out_file.stat().st_size / (1024*1024):.1f} MB)")
        return out_file
        
    print(f"\n[{g['date']}] Downloading {g['name']} ({g['size'] / (1024*1024):.1f} MB)...")
    url = f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({g['pid']})/$value"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "User-Agent": "AeroSat-AI/1.0"}
    )
    
    start = time.time()
    downloaded = 0
    chunk_size = 1024 * 1024 * 4
    
    with urllib.request.urlopen(req, timeout=60) as resp, open(out_file, "wb") as f:
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            pct = (downloaded / g["size"]) * 100.0
            print(f"\r  [{g['date']}] Progress: {downloaded / (1024*1024):.1f} MB / {g['size'] / (1024*1024):.1f} MB ({pct:.1f}%)", end="", flush=True)
            
    elapsed = time.time() - start
    print(f"\n  Done in {elapsed:.1f} s ({downloaded / (1024*1024):.1f} MB)")
    return out_file

def main():
    token = CopernicusOAuthManager.get_valid_token()
    if not token:
        print("Failed to get token.")
        return
        
    for g in GRANULES:
        try:
            download_granule(g, token)
        except Exception as e:
            print(f"Error downloading {g['date']}: {e}")

if __name__ == "__main__":
    main()
