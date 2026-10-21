import argparse
import csv
import hashlib
import json
import math
from datetime import date, timedelta
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--location", required=True)
args = parser.parse_args()

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "data/Daymet/raw"
OUT = ROOT / "data/Daymet/cleaned"
OUT.mkdir(parents=True, exist_ok=True)

name = args.location
input_path = RAW / f"{name}_2004_2025.csv"
download_meta = json.loads(
    (RAW / f"{name}_2004_2025_metadata.json").read_text(encoding="utf-8")
)
thresholds = {"hot_c": 30, "wet_mm": 1, "heavy_mm": 20, "wet_run_days": 3}

payload = input_path.read_bytes()
checksum = hashlib.sha256(payload).hexdigest()
if checksum != download_meta["sha256"]:
    raise ValueError("Raw file checksum does not match download metadata.")

lines = payload.decode("utf-8-sig").splitlines()
start = next(i for i, line in enumerate(lines)
             if line.startswith("year,yday,"))
raw_rows = list(csv.DictReader(lines[start:]))

expected = {(y, d) for y in range(2004, 2026) for d in range(1, 366)}
keys = [(int(r["year"]), int(r["yday"])) for r in raw_rows]
if len(keys) != len(expected) or set(keys) != expected:
    raise ValueError("Unexpected input calendar.")

by_date = {
    date(int(r["year"]), 1, 1) + timedelta(days=int(r["yday"]) - 1): r
    for r in raw_rows
}

def number(text):
    if text.strip().lower() in {"", "na", "nan", "-9999"}:
        return None
    value = float(text)
    return value if math.isfinite(value) else None

def flag(value, threshold):
    return "" if value is None else str(value >= threshold).lower()

rows = []
day = date(2004, 1, 1)

while day <= date(2025, 12, 31):
    raw = by_date.get(day)
    tmax = number(raw["tmax (deg c)"]) if raw else None
    tmin = number(raw["tmin (deg c)"]) if raw else None
    prcp = number(raw["prcp (mm/day)"]) if raw else None

    if tmax is not None and tmin is not None and tmax < tmin:
        raise ValueError(f"{day}: TMAX below TMIN")
    if prcp is not None and prcp < 0:
        raise ValueError(f"{day}: negative precipitation")

    rows.append({
        "source": "Daymet",
        "location_id": name,
        "latitude": download_meta["requested_latitude"],
        "longitude": download_meta["requested_longitude"],
        "date": day.isoformat(),
        "calendar_status": "present" if raw else "daymet_calendar_omission",
        "tmax_c": tmax,
        "tmin_c": tmin,
        "prcp_mm": prcp,
        "is_growing_season": str(4 <= day.month <= 10).lower(),
        "is_freezing_day": "" if tmin is None else str(tmin < 0).lower(),
        "is_hot_day": flag(tmax, thresholds["hot_c"]),
        "is_wet_day": flag(prcp, thresholds["wet_mm"]),
        "is_heavy_precip_day": flag(prcp, thresholds["heavy_mm"]),
    })
    day += timedelta(days=1)

# Calculate wet spells across the full calendar before filtering periods.
wet = [r["is_wet_day"] for r in rows]
prolonged = [value if value != "true" else "" for value in wet]
i = 0

while i < len(wet):
    if wet[i] != "true":
        i += 1
        continue

    end = i
    while end + 1 < len(wet) and wet[end + 1] == "true":
        end += 1

    left_dry = i > 0 and wet[i - 1] == "false"
    right_dry = end + 1 < len(wet) and wet[end + 1] == "false"

    if end - i + 1 >= thresholds["wet_run_days"]:
        value = "true"
    elif left_dry and right_dry:
        value = "false"
    else:
        value = ""

    prolonged[i:end + 1] = [value] * (end - i + 1)
    i = end + 1

for row, value in zip(rows, prolonged):
    row["is_prolonged_wet_day"] = value

indicators = [
    "is_freezing_day", "is_hot_day", "is_wet_day",
    "is_heavy_precip_day", "is_prolonged_wet_day",
]
summaries = []

for year in range(2004, 2026):
    annual = [r for r in rows if r["date"].startswith(str(year))]
    growing = [r for r in annual if r["is_growing_season"] == "true"]

    for period, selected in [("annual", annual), ("growing_season", growing)]:
        summary = {
            "location_id": name,
            "year": year,
            "period": period,
            "calendar_days": len(selected),
        }

        for field in indicators:
            for value, suffix in [("true", "true"), ("false", "false"), ("", "unknown")]:
                summary[f"{field}_{suffix}"] = sum(
                    r[field] == value for r in selected
                )

        for field in ["tmax_c", "tmin_c", "prcp_mm"]:
            observed = sum(r[field] is not None for r in selected)
            summary[f"{field}_observed_days"] = observed
            summary[f"{field}_coverage"] = round(observed / len(selected), 6)

        run = longest = 0
        for row in selected:
            run = run + 1 if row["is_wet_day"] == "true" else 0
            longest = max(longest, run)
        summary["longest_observed_wet_run_days"] = longest
        summaries.append(summary)

def write_csv(path, records):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)

daily_path = OUT / f"{name}_daily.csv"
summary_path = OUT / f"{name}_summary.csv"
write_csv(daily_path, rows)
write_csv(summary_path, summaries)

omitted = [r["date"] for r in rows
           if r["calendar_status"] == "daymet_calendar_omission"]
metadata = {
    "location_id": name,
    "input_sha256": checksum,
    "thresholds": thresholds,
    "freeze_definition": "tmin_c < 0",
    "growing_season": "April through October",
    "raw_rows": len(raw_rows),
    "daily_rows": len(rows),
    "summary_rows": len(summaries),
    "calendar_omission_dates": omitted,
    "missing_data_policy": "Unknown; no interpolation or dry-day substitution",
    "wet_run_policy": "Labels calculated before year and season filtering",
}
(OUT / f"{name}_processing_metadata.json").write_text(
    json.dumps(metadata, indent=2), encoding="utf-8"
)

print("Daily file:", daily_path)
print("Summary file:", summary_path)
print("Raw rows:", len(raw_rows))
print("Daily calendar rows:", len(rows))
print("Calendar omissions retained as unknown:", len(omitted))
print("Summary rows:", len(summaries))

check = next(s for s in summaries
             if s["year"] == 2025 and s["period"] == "growing_season")
print("2025 growing-season check:")
for field in indicators:
    print(f"  {field}: {check[field + '_true']} true, "
          f"{check[field + '_unknown']} unknown")
print("  Longest observed wet run:",
      check["longest_observed_wet_run_days"], "days")
