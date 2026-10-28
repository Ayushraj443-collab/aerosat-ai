import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusOAuthManager, CopernicusSentinel5PConnector

def test_download():
    print("=== COPERNICUS CDSE SENTINEL-5P DOWNLOAD DIAGNOSTIC ===")
    token = CopernicusOAuthManager.get_valid_token()
    print("Token valid:", bool(token))
    
    # 1. Query for Sentinel-5P product
    q = CopernicusSentinel5PConnector.query_products(
        pollutant="NO2",
        start_date="2024-01-05",
        end_date="2024-01-05",
        top=1
    )
    if not q.get("products"):
        print("No products found.")
        return
        
    p = q["products"][0]
    pid = p["product_id"]
    name = p["granule_name"]
    length = p["content_length_bytes"]
    print(f"Product ID: {pid}")
    print(f"Name: {name}")
    print(f"Size: {length} bytes ({length / (1024*1024):.2f} MB)")
    
    # In CDSE, the download endpoints can be:
    # 1. https://zipper.dataspace.copernicus.eu/odata/v1/Products({pid})/$value
    # 2. https://catalogue.dataspace.copernicus.eu/odata/v1/Products({pid})/$value
    urls_to_test = [
        f"https://zipper.dataspace.copernicus.eu/odata/v1/Products({pid})/$value",
        f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({pid})/$value"
    ]
    
    for url in urls_to_test:
        print(f"\nTesting URL: {url}")
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "AeroSat-AI/1.0",
                "Range": "bytes=0-1048576"  # Request first 1 MB to test access and header
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"Status Code: {resp.status}")
                print(f"Headers: {dict(resp.headers)}")
                chunk = resp.read(1024 * 64)
                print(f"Successfully read {len(chunk)} bytes!")
                print(f"First 16 bytes: {chunk[:16]}")
                # NetCDF4 / HDF5 header check
                if chunk[:4] == b'\x89HDF':
                    print("VERIFIED: File signature matches HDF5 / NetCDF-4 (\\x89HDF)!")
                elif chunk[:3] == b'CDF':
                    print("VERIFIED: File signature matches classic NetCDF (CDF)!")
                elif chunk[:2] == b'PK':
                    print("VERIFIED: File signature matches ZIP container (PK)!")
                else:
                    print(f"File magic: {chunk[:8]}")
                return pid, name, url
        except urllib.error.HTTPError as he:
            print(f"HTTPError: {he.code} {he.reason}")
            try:
                err_body = he.read().decode('utf-8', errors='ignore')
                print(f"Error body: {err_body[:300]}")
            except Exception:
                pass
        except Exception as ex:
            print(f"Error: {type(ex)} {ex}")

if __name__ == "__main__":
    test_download()
