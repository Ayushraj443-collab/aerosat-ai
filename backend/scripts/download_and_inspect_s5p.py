import sys
import time
import json
import urllib.request
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager, CopernicusSentinel5PConnector
from app.config import settings

def main():
    print("=== SATELLITE DATA GAP COMPLETION: SENTINEL-5P DOWNLOAD & AUDIT ===")
    token = CopernicusOAuthManager.get_valid_token()
    if not token:
        print("FAILED: No valid Copernicus token.")
        return

    # 1. Query for Sentinel-5P NO2 products intersecting Delhi-NCR on Jan 5, 2024
    print("1. Querying CDSE for Delhi-NCR Sentinel-5P NO2 orbit on 2024-01-05...")
    q = CopernicusSentinel5PConnector.query_products(
        pollutant="NO2",
        min_lat=28.30,
        max_lat=28.88,
        min_lon=76.90,
        max_lon=77.45,
        start_date="2024-01-05",
        end_date="2024-01-05",
        top=1
    )
    if not q.get("products"):
        print("No product found.")
        return
        
    prod = q["products"][0]
    pid = prod["product_id"]
    name = prod["granule_name"]
    total_bytes = prod["content_length_bytes"]
    print(f"Product ID: {pid}")
    print(f"Granule Name: {name}")
    print(f"Total Granule Size: {total_bytes / (1024*1024):.2f} MB")
    
    # Target file
    out_dir = settings.DATA_RAW_DIR / "sentinel5p"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / name
    
    download_url = f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({pid})/$value"
    print(f"Download URL: {download_url}")
    
    # If file already exists and is complete
    if out_file.exists() and out_file.stat().st_size == total_bytes:
        print(f"File already downloaded: {out_file} ({out_file.stat().st_size} bytes)")
        return str(out_file)
        
    print(f"\n2. Initiating download to: {out_file}")
    req = urllib.request.Request(
        download_url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "AeroSat-AI/1.0"
        }
    )
    
    start_time = time.time()
    downloaded = 0
    chunk_size = 1024 * 1024 * 4  # 4 MB chunks
    
    # Start download with progress reporting
    try:
        with urllib.request.urlopen(req, timeout=60) as resp, open(out_file, "wb") as f:
            last_report = time.time()
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                
                # Report every 3 seconds or when complete
                now = time.time()
                if now - last_report >= 3.0:
                    pct = (downloaded / total_bytes) * 100.0 if total_bytes else 0.0
                    rate = (downloaded / (1024 * 1024)) / (now - start_time)
                    print(f"Downloaded: {downloaded / (1024*1024):.1f} MB / {total_bytes / (1024*1024):.1f} MB ({pct:.1f}%) - Speed: {rate:.2f} MB/s")
                    last_report = now
                    
        total_time = time.time() - start_time
        print(f"\nSUCCESS: Download complete in {total_time:.1f} s ({downloaded / (1024*1024):.2f} MB)")
        return str(out_file)
    except Exception as e:
        print(f"\nDOWNLOAD INCOMPLETE/ERROR: {e}")
        # Report exact size downloaded
        current_size = out_file.stat().st_size if out_file.exists() else 0
        print(f"Partial bytes saved: {current_size} bytes")
        return None

if __name__ == "__main__":
    main()
