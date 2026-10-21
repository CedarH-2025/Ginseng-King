import csv
import math
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INPUT = ROOT / "data/Daymet/raw/wausau_asos_2025.csv"
OUTPUT = ROOT / "data/Daymet/cleaned/wausau_asos_2025_daily.csv"

def number(text):
    if text.strip() in {"", "NA", "NaN", "-9999"}:
        return None
    value = float(text)
    return value if math.isfinite(value) else None

def label(value, threshold):
    if value is None:
        return ""
    return str(value >= threshold).lower()

lines = INPUT.read_text(encoding="utf-8-sig").splitlines()
start = next(i for i, line in enumerate(lines)
             if line.startswith("year,yday,"))

result = []

for row in csv.DictReader(lines[start:]):
    year = int(row["year"])
    yday = int(row["yday"])
    day = date(year, 1, 1) + timedelta(days=yday - 1)

    tmax = number(row["tmax (deg c)"])
    tmin = number(row["tmin (deg c)"])
    prcp = number(row["prcp (mm/day)"])

    if tmax is not None and tmin is not None and tmax < tmin:
        raise ValueError(f"{day}: TMAX is below TMIN")
    if prcp is not None and prcp < 0:
        raise ValueError(f"{day}: negative precipitation")

    result.append({
        "source": "Daymet",
        "location_id": "wausau_asos_reference",
        "latitude": 44.9275,
        "longitude": -89.6253,
        "date": day.isoformat(),
        "tmax_c": tmax,
        "tmin_c": tmin,
        "prcp_mm": prcp,
        "is_growing_season": str(4 <= day.month <= 10).lower(),
        "is_freezing_day": "" if tmin is None else str(tmin < 0).lower(),
        "is_hot_day": label(tmax, 30),
        "is_wet_day": label(prcp, 1),
        "is_heavy_precip_day": label(prcp, 20),
    })

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT.open("w", newline="", encoding="utf-8") as file:
    writer = csv.DictWriter(file, fieldnames=list(result[0]))
    writer.writeheader()
    writer.writerows(result)

season = [r for r in result if r["is_growing_season"] == "true"]

print("Saved:", OUTPUT)
print("Daily rows:", len(result))
print("April-October rows:", len(season))

for field in ["is_freezing_day", "is_hot_day",
              "is_wet_day", "is_heavy_precip_day"]:
    observed_true = sum(r[field] == "true" for r in season)
    unknown = sum(r[field] == "" for r in season)
    print(f"{field}: {observed_true} observed true, {unknown} unknown")
