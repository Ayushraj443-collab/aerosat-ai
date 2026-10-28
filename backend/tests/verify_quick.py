import requests

for mode, dt in [("REAL", "2024-01-01"), ("REAL", "2026-10-27"), ("DEMO", "2024-01-01")]:
    print(f"\n=== Ludhiana Mode: {mode}, Date: {dt} ===")
    res = requests.post("http://127.0.0.1:8000/api/data/location-summary", json={
        "latitude": 30.9010,
        "longitude": 75.8573,
        "city": "Ludhiana",
        "date": dt,
        "data_mode": mode
    })
    data = res.json()
    print("Resolved City:", data.get("city_name"), "| Domain:", data.get("regional_domain_str"))
    print("Avail msg:", data.get("data_availability", {}).get("status_message"))
    for p in data.get("pollutants", []):
        print(f"  {p['code']:5}: val={p['value']} {p['unit']}, cat={p['category']}, sat={p['satValue']}, status={p['validation_status']}")

