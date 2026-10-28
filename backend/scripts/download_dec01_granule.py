import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager
from app.config import settings

def download_dec01_granule():
    pid = "1fbe4231-e56f-499f-9d42-f14b86472a30"
    name = "S5P_OFFL_L2__NO2____20231201T072645_20231201T090815_31779_03_020600_20231202T233004.nc"
    total_bytes = 565611136  # ~539.4 MB
    out_dir = settings.DATA_RAW_DIR / "sentinel5p"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / name

    if out_file.exists() and out_file.stat().st_size >= total_bytes * 0.95:
        print(f"Granule already downloaded and complete: {out_file.name} ({out_file.stat().st_size} bytes)")
        return True

    print(f"Starting download of Sentinel-5P granule {name} (ID: {pid})...")
    token = CopernicusOAuthManager.get_valid_token()
    if not token:
        print("ERROR: Could not obtain Copernicus CDSE access token.")
        return False

    download_url = f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({pid})/$value"
    
    # Check existing partial size for resume support
    existing_bytes = out_file.stat().st_size if out_file.exists() else 0
    headers = {"Authorization": f"Bearer {token}"}
    mode = "wb"
    if existing_bytes > 0:
        headers["Range"] = f"bytes={existing_bytes}-"
        mode = "ab"
        print(f"Resuming download from byte {existing_bytes}...")

    req = urllib.request.Request(download_url, headers=headers)
    t0 = time.time()
    downloaded = existing_bytes

    try:
        with urllib.request.urlopen(req, timeout=30) as resp, open(out_file, mode) as f:
            chunk_size = 1024 * 1024  # 1MB chunks
            last_report = time.time()
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                now = time.time()
                if now - last_report >= 5:
                    pct = (downloaded / total_bytes) * 100.0 if total_bytes > 0 else 0
                    speed_mb = (downloaded - existing_bytes) / (1024 * 1024 * max(0.1, now - t0))
                    print(f"Downloaded {downloaded / (1024*1024):.1f} MB / {total_bytes / (1024*1024):.1f} MB ({pct:.1f}%) at {speed_mb:.2f} MB/s")
                    last_report = now
    except Exception as e:
        print(f"Download interrupted: {e}")
        return False

    elapsed = time.time() - t0
    print(f"SUCCESS: Granule downloaded in {elapsed:.1f}s: {out_file.name} ({out_file.stat().st_size} bytes)")
    return True

if __name__ == "__main__":
    download_dec01_granule()

