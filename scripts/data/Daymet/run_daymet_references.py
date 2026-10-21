import csv
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "scripts/data/Daymet"
DATA = ROOT / "data/Daymet"

# These are NOAA reference coordinates, not the county sampling points.
locations = [
    {
        "location_id": "wausau_asos_reference",
        "noaa_station_id": "USW00014897",
        "latitude": 44.9275,
        "longitude": -89.6253,
    },
    {
        "location_id": "merrill_reference",
        "noaa_station_id": "USC00475364",
        "latitude": 45.1786,
        "longitude": -89.6617,
    },
    {
        "location_id": "marshfield_exp_farm_reference",
        "noaa_station_id": "USC00475120",
        "latitude": 44.6411,
        "longitude": -90.1333,
    },
    {
        "location_id": "stevens_pt_reference",
        "noaa_station_id": "USC00478171",
        "latitude": 44.5114,
        "longitude": -89.5853,
    },
    {
        "location_id": "marshfield_muni_ap_reference",
        "noaa_station_id": "USW00094985",
        "latitude": 44.6378,
        "longitude": -90.1875,
    },
]

combined_daily = []
combined_summary = []

for location in locations:
    name = location["location_id"]
    print(f"\nProcessing reference: {name}", flush=True)

    raw = DATA / "raw" / f"{name}_2004_2025.csv"
    metadata = DATA / "raw" / f"{name}_2004_2025_metadata.json"

    if raw.exists() and metadata.exists():
        print("Using existing raw file; processing will verify its checksum.",
              flush=True)
    else:
        subprocess.run([
            sys.executable,
            str(SCRIPTS / "download_daymet.py"),
            "--location", name,
            "--lat", str(location["latitude"]),
            "--lon", str(location["longitude"]),
        ], check=True, cwd=ROOT)

    subprocess.run([
        sys.executable,
        str(SCRIPTS / "process_daymet.py"),
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

        for row in records:
            destination.append({
                "reference_noaa_station_id": location["noaa_station_id"],
                **row,
            })

def write_csv(path, records):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

write_csv(DATA / "reference_locations.csv", locations)
write_csv(DATA / "cleaned/daymet_reference_daily.csv", combined_daily)
write_csv(DATA / "cleaned/daymet_reference_summary.csv", combined_summary)

print("\nALL REFERENCES COMPLETED")
print("Reference locations:", len(locations))
print("Combined daily rows:", len(combined_daily))
print("Combined summary rows:", len(combined_summary))
print("Results folder:", DATA / "cleaned")
