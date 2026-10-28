import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.connectors import CopernicusSentinel5PConnector

def main():
    q = CopernicusSentinel5PConnector.query_products(
        pollutant="NO2",
        start_date="2024-01-01",
        end_date="2024-01-07",
        top=20
    )
    print("Total found:", q.get("total_found"))
    for p in q.get("products", []):
        dt = p["acquisition_start"][:10]
        pid = p["product_id"]
        name = p["granule_name"]
        mb = p["content_length_bytes"] / (1024 * 1024)
        print(f"{dt} | ID: {pid} | {name[:50]}... | {mb:.1f} MB")

if __name__ == "__main__":
    main()
