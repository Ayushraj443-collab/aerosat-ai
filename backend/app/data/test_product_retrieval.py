import json
import urllib.request
import urllib.error
from app.data.connectors import CopernicusOAuthManager, CopernicusSentinel5PConnector

def test_metadata_and_nodes_retrieval():
    print("=" * 66)
    print("   AeroSat-AI — Sentinel-5P Granule Metadata & Pixel Diagnostic   ")
    print("=" * 66)

    # 1. First test token acquisition
    token = CopernicusOAuthManager.get_valid_token()
    token_status = "ACQUIRED" if token else "FAILED"
    print(f"OAuth Bearer Token Status : {token_status}")
    if not token:
        print("[FAIL] Unable to acquire OAuth token.")
        return False

    # 2. Query Catalogue for latest granule over Delhi-NCR
    cat_res = CopernicusSentinel5PConnector.query_products(pollutant="NO2", top=1)
    if cat_res.get("status") != "SUCCESS" or not cat_res.get("products"):
        print("[FAIL] Catalogue query returned no products.")
        return False

    first_prod = cat_res["products"][0]
    prod_id = first_prod["product_id"]
    print(f"Target Product ID         : {prod_id}")
    print(f"Granule Name              : {first_prod['granule_name']}")
    print(f"Acquisition Start         : {first_prod['acquisition_start']}")
    print(f"Content Length (Bytes)    : {first_prod['content_length_bytes']}")

    # 3. Retrieve Product Full Metadata (Small JSON response, no raw granule download)
    meta_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})?$expand=Attributes"
    headers = {
        "User-Agent": "AeroSat-AI/1.0",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    print("\nRetrieving product detailed metadata with expanded attributes from CDSE OData...")
    req = urllib.request.Request(meta_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            meta_json = json.loads(resp.read().decode("utf-8"))
            attrs = {a.get("Name"): a.get("Value") for a in meta_json.get("Attributes", [])}
            print("HTTP Status Code          : 200 OK")
            print(f"Product S3 / Origin Path  : {meta_json.get('S3Path') or 'Online Store'}")
            print(f"Orbit Number              : {attrs.get('orbitNumber', 'N/A')}")
            print(f"Processor Version         : {attrs.get('processorVersion', 'N/A')}")
            print(f"Platform Short Name       : {attrs.get('platformShortName', 'SENTINEL-5P')}")
            print(f"Instrument Short Name     : {attrs.get('instrumentShortName', 'TROPOMI')}")
            print(f"Processing Level          : {attrs.get('processingLevel', 'L2')}")
            print(f"Product Type              : {attrs.get('productType', 'L2__NO2___')}")
            print(f"Parsed Attributes Count   : {len(attrs)}")
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Metadata retrieval returned HTTP {e.code}: {e.read().decode('utf-8', errors='ignore')}")
        return False
    except Exception as e:
        print(f"[ERROR] Metadata retrieval failed: {e}")
        return False

    # 4. Check internal Nodes manifest (inspect structure without downloading the 600MB raw file)
    nodes_url = f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({prod_id})/Nodes"
    print("\nInspecting NetCDF Granule Internal Group Nodes manifest...")
    nodes_req = urllib.request.Request(nodes_url, headers=headers)
    try:
        with urllib.request.urlopen(nodes_req, timeout=20) as nresp:
            nodes_json = json.loads(nresp.read().decode("utf-8"))
            node_items = nodes_json.get("value", [])
            print(f"Top-level NetCDF Structure: {len(node_items)} internal components identified")
            for item in node_items[:5]:
                print(f"  - Node: {item.get('Name')} ({item.get('ContentLength', 'container')} bytes)")
    except Exception as e:
        print(f"[INFO] Node listing note: {e}")

    # 5. Test authenticated Sentinel Hub Statistical API pixel observation retrieval
    print("\nTesting Authenticated Pixel Sampling via Sentinel Hub API (NO2 at Delhi)...")
    pixel_res = CopernicusSentinel5PConnector.fetch_sentinel5p_observation(
        lat=28.6139,
        lon=77.2090,
        date="2024-01-10",
        pollutant="NO2"
    )
    print(f"Pixel Sampling Status     : {pixel_res.get('status')}")
    if pixel_res.get("status") == "SUCCESS":
        print(f"Tropospheric NO2 Column   : {pixel_res.get('satellite_column')} {pixel_res.get('unit')}")
        print(f"QA Value                  : {pixel_res.get('satellite_qa')}")
        print(f"Sample Count              : {pixel_res.get('sample_count')}")
    elif pixel_res.get("status") in ("UNAVAILABLE", "FAILED"):
        print(f"Sampling Message          : {pixel_res.get('message')}")
        if pixel_res.get("error"):
            print(f"Sampling Detail           : {pixel_res.get('error')}")

    print("=" * 66)
    print("[PASS] Satellite product discovery and metadata retrieval verified successfully.")
    return True

if __name__ == "__main__":
    test_metadata_and_nodes_retrieval()
