import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager
from app.config import settings

def download_may_granule():
    pid = "db3e51a0-43a0-478e-91f9-d4fc9955a94f"
    name = "S5P_OFFL_L2__NO2____20240520T073226_20240520T091356_34205_03_020600_20240521T233529.nc"
    total_bytes = 612563072
    out_dir = settings.DATA_RAW_DIR / "sentinel5p"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / name
    
    print("=" * 66)
    print("   AeroSat-AI — Copernicus CDSE May 2024 Granule Downloader   ")
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
    
    existing_bytes = out_file.stat().st_size if out_file.exists() else 0
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "AeroSat-AI/1.0"
    }
    
    mode = "wb"
    if existing_bytes > 0 and existing_bytes < total_bytes:
        headers["Range"] = f"bytes={existing_bytes}-"
        mode = "ab"
        print(f"[RESUMING] Resuming download from byte {existing_bytes}...")
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
    except Exception as e:
        print(f"[EXCEPTION] {e}")
        return None

if __name__ == "__main__":
    res = download_may_granule()
    sys.exit(0 if res else 1)
