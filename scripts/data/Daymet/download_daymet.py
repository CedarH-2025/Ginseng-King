import argparse
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument("--location", required=True)
parser.add_argument("--lat", type=float, required=True)
parser.add_argument("--lon", type=float, required=True)
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/Daymet/raw"
OUT.mkdir(parents=True, exist_ok=True)

years = list(range(2004, 2026))

params = {
    "lat": args.lat,
    "lon": args.lon,
    "vars": "tmax,tmin,prcp",
    "years": ",".join(map(str, years)),
}
url = "https://daymet.ornl.gov/single-pixel/api/data?" + urlencode(params)

print("Downloading:", args.location, flush=True)
request = Request(url, headers={"User-Agent": "GinsengKing-CS598/1.0"})

with urlopen(request, timeout=60) as response:
    payload = response.read()

lines = payload.decode("utf-8-sig").splitlines()
start = next(
    (i for i, line in enumerate(lines)
     if line.startswith("year,yday,")),
    None,
)

if start is None:
    raise ValueError("No CSV header found. The response may be a login or error page.")

rows = list(csv.DictReader(lines[start:]))
keys = [(int(row["year"]), int(row["yday"])) for row in rows]
expected = {(year, day) for year in years for day in range(1, 366)}

if len(keys) != len(expected) or set(keys) != expected:
    raise ValueError("Unexpected years, missing days, or duplicate records.")

name = f"{args.location}_2004_2025"
data_path = OUT / f"{name}.csv"
metadata_path = OUT / f"{name}_metadata.json"

metadata = {
    "source": "Daymet Single Pixel API",
    "location_id": args.location,
    "requested_latitude": args.lat,
    "requested_longitude": args.lon,
    "years": years,
    "variables": ["tmax", "tmin", "prcp"],
    "source_url": url,
    "downloaded_at_utc": datetime.now(timezone.utc).isoformat(),
    "sha256": hashlib.sha256(payload).hexdigest(),
    "daily_rows": len(rows),
    "source_header": lines[:start],
    "calendar_note": "365 days per year; leap years omit December 31.",
}

data_path.write_bytes(payload)
metadata_path.write_text(
    json.dumps(metadata, indent=2),
    encoding="utf-8",
)

print("Saved:", data_path)
print("Metadata:", metadata_path)
print("Daily rows:", len(rows))
print("Unique dates:", len(set(keys)))
print("Complete requested Daymet calendar: True")
