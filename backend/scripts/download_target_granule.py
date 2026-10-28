import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager
from app.config import settings

def download_jan10_granule():
    pid = "af2489a2-dfff-4af9-b7c3-58228160d931"
    name = "S5P_OFFL_L2__NO2____20240110T063532_20240110T081702_32346_03_020600_20240111T224348.nc"
    total_bytes = 606445371
    out_dir = settings.DATA_RAW_DIR / "sentinel5p"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / name
    
    print("=" * 66)
    print("   AeroSat-AI — Copernicus CDSE Authenticated Granule Downloader   ")
    print("=" * 66)
    print(f"Product ID   : {pid}")
    print(f"Granule Name : {name}")
    print(f"Expected Size: {total_bytes / (1024*1024):.2f} MB ({total_bytes} bytes)")
    print(f"Destination  : {out_file}")
    print("-" * 66)
    
    if out_file.exists() and out_file.stat().st_size == total_bytes:
        print(f"[ALREADY EXISTS] File already fully downloaded ({out_file.stat().st_size} bytes).")
        return str(out_file)

    token = CopernicusOAuthManager.get_valid_token()
    if not token:
        print("[ERROR] Failed to acquire valid Copernicus OAuth token.")
        return None

    download_url = f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({pid})/$value"
    
    # Check if partial file exists for resume support
    existing_bytes = out_file.stat().st_size if out_file.exists() else 0
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "AeroSat-AI/1.0"
    }
    
    mode = "wb"
    if existing_bytes > 0 and existing_bytes < total_bytes:
        headers["Range"] = f"bytes={existing_bytes}-"
        mode = "ab"
        print(f"[RESUMING] Resuming download from byte {existing_bytes} ({existing_bytes/(1024*1024):.1f} MB)...")
    else:
        print("[STARTING] Starting fresh download from byte 0...")
        existing_bytes = 0

    req = urllib.request.Request(download_url, headers=headers)
    chunk_size = 1024 * 1024 * 4  # 4 MB chunks
    downloaded = existing_bytes
    start_time = time.time()
    last_report = time.time()

    try:
        with urllib.request.urlopen(req, timeout=60) as resp, open(out_file, mode) as f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                now = time.time()
                if now - last_report >= 3.0:
                    pct = (downloaded / total_bytes) * 100.0 if total_bytes else 0.0
                    elapsed = now - start_time
                    rate = ((downloaded - existing_bytes) / (1024 * 1024)) / max(0.1, elapsed)
                    print(f"Progress: {downloaded / (1024*1024):.1f} / {total_bytes / (1024*1024):.1f} MB ({pct:.1f}%) — Speed: {rate:.2f} MB/s")
                    last_report = now

        total_elapsed = time.time() - start_time
        final_size = out_file.stat().st_size
        print("=" * 66)
        print(f"[SUCCESS] Download completed in {total_elapsed:.1f}s. Saved {final_size} bytes.")
        print("=" * 66)
        return str(out_file)
    except urllib.error.HTTPError as he:
        print(f"[HTTP ERROR] Code {he.code}: {he.reason}")
        return None
    except Exception as e:
        print(f"[EXCEPTION] {e}")
        return None

if __name__ == "__main__":
    res = download_jan10_granule()
    sys.exit(0 if res else 1)
