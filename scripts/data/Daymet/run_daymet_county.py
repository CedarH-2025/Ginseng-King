import csv
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "scripts/data/Daymet"
DATA = ROOT / "data/Daymet"
GEO = DATA / "geography"
GEO.mkdir(parents=True, exist_ok=True)

locations = [
    {"location_id": "marathon_center", "latitude": 44.90, "longitude": -89.65},
    {"location_id": "marathon_north", "latitude": 45.05, "longitude": -89.65},
    {"location_id": "marathon_south", "latitude": 44.75, "longitude": -89.65},
    {"location_id": "marathon_west", "latitude": 44.90, "longitude": -90.10},
    {"location_id": "marathon_east", "latitude": 44.90, "longitude": -89.35},
]

params = {
    "where": "STATE='55' AND COUNTY='073'",
    "outFields": "NAME,GEOID",
    "returnGeometry": "true",
    "outSR": "4326",
    "f": "geojson",
}
boundary_url = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/"
    "TIGERweb/State_County/MapServer/1/query?"
    + urlencode(params)
)

print("Downloading official county boundary...", flush=True)
with urlopen(boundary_url, timeout=60) as response:
    boundary_bytes = response.read()

boundary = json.loads(boundary_bytes)
features = boundary.get("features", [])
if len(features) != 1 or features[0]["properties"]["GEOID"] != "55073":
    raise ValueError("Unexpected county boundary response.")

geometry = features[0]["geometry"]
if geometry["type"] == "Polygon":
    polygons = [geometry["coordinates"]]
elif geometry["type"] == "MultiPolygon":
    polygons = geometry["coordinates"]
else:
    raise ValueError("Unsupported boundary geometry.")

def inside_ring(x, y, ring):
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        x1, y1 = a[:2]
        x2, y2 = b[:2]
        if (y1 > y) != (y2 > y):
            crossing_x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < crossing_x:
                inside = not inside
    return inside

def inside_county(lon, lat):
    return any(
        inside_ring(lon, lat, polygon[0])
        and not any(inside_ring(lon, lat, hole) for hole in polygon[1:])
        for polygon in polygons
    )

for location in locations:
    if not inside_county(location["longitude"], location["latitude"]):
        raise ValueError(f"Outside county: {location['location_id']}")
    location["county_geoid"] = "55073"
    location["point_type"] = "geographic_sample_not_verified_farm"

(GEO / "marathon_county.geojson").write_bytes(boundary_bytes)
(GEO / "boundary_metadata.json").write_text(
    json.dumps({
        "source_url": boundary_url,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(boundary_bytes).hexdigest(),
        "county_name": "Marathon County",
        "county_geoid": "55073",
        "verified_points": locations,
    }, indent=2),
    encoding="utf-8",
)
print("All 5 sampling points are inside Marathon County.", flush=True)

combined_daily = []
combined_summary = []

for location in locations:
    name = location["location_id"]
    print(f"\nProcessing county sample: {name}", flush=True)

    raw = DATA / "raw" / f"{name}_2004_2025.csv"
    metadata = DATA / "raw" / f"{name}_2004_2025_metadata.json"

    if not (raw.exists() and metadata.exists()):
        subprocess.run([
            sys.executable, str(SCRIPTS / "download_daymet.py"),
            "--location", name,
            "--lat", str(location["latitude"]),
            "--lon", str(location["longitude"]),
        ], check=True, cwd=ROOT)

    subprocess.run([
        sys.executable, str(SCRIPTS / "process_daymet.py"),
        "--location", name,
    ], check=True, cwd=ROOT)

    for suffix, destination, expected_count in [
        ("daily", combined_daily, 8036),
        ("summary", combined_summary, 44),
    ]:
        path = DATA / "cleaned" / f"{name}_{suffix}.csv"
        with path.open(encoding="utf-8-sig", newline="") as file:
            records = list(csv.DictReader(file))
        if len(records) != expected_count:
            raise ValueError(f"{name}: unexpected {suffix} row count")
        destination.extend(records)

def write_csv(path, records):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

write_csv(DATA / "county_locations.csv", locations)
write_csv(DATA / "cleaned/daymet_county_daily.csv", combined_daily)
write_csv(DATA / "cleaned/daymet_county_summary.csv", combined_summary)

print("\nALL COUNTY SAMPLES COMPLETED")
print("County sampling points:", len(locations))
print("Combined daily rows:", len(combined_daily))
print("Combined summary rows:", len(combined_summary))
