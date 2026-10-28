import requests

for pol in ['NO2', 'PM2.5', 'SO2', 'CO', 'O3']:
    r = requests.post('http://127.0.0.1:8000/api/predict', json={
        'latitude': 30.9010,
        'longitude': 75.8573,
        'pollutant': pol,
        'resolution_km': 1.0,
        'date': '2024-01-01',
        'data_mode': 'REAL'
    })
    res = r.json()
    rtype = res.get('result_type')
    val = res.get('estimated_value')
    aqi = res.get('aqi_category')
    print(f"{pol:5} -> code: {r.status_code}, val: {val}, aqi: {aqi}, type: {rtype}")

