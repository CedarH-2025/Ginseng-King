import csv
import json
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data/Daymet/cleaned"

metrics = [
    "is_freezing_day",
    "is_hot_day",
    "is_wet_day",
    "is_heavy_precip_day",
    "is_prolonged_wet_day",
]

def read_csv(path):
    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))

def require(condition, message):
    if not condition:
        raise ValueError(message)

expected_dates = {
    (date(2004, 1, 1) + timedelta(days=i)).isoformat()
    for i in range((date(2026, 1, 1) - date(2004, 1, 1)).days)
}

audit = {}
county_summary = []

for dataset in ["reference", "county"]:
    daily = read_csv(OUT / f"daymet_{dataset}_daily.csv")
    summaries = read_csv(OUT / f"daymet_{dataset}_summary.csv")

    require(len(daily) == 40180, f"{dataset}: daily row count")
    require(len(summaries) == 220, f"{dataset}: summary row count")

    keys = {(r["location_id"], r["date"]) for r in daily}
    require(len(keys) == len(daily), f"{dataset}: duplicate dates")

    by_location = defaultdict(list)
    by_year = defaultdict(list)

    for row in daily:
        by_location[row["location_id"]].append(row)
        by_year[(row["location_id"], int(row["date"][:4]))].append(row)

        month = int(row["date"][5:7])
        expected_season = str(4 <= month <= 10).lower()
        require(row["is_growing_season"] == expected_season,
                f"{dataset}: growing-season flag")

        for metric in metrics:
            require(row[metric] in {"true", "false", ""},
                    f"{dataset}: invalid label value")

    require(len(by_location) == 5, f"{dataset}: location count")

    for location, records in by_location.items():
        require({r["date"] for r in records} == expected_dates,
                f"{location}: incomplete calendar")

    summary_keys = {
        (r["location_id"], r["year"], r["period"]) for r in summaries
    }
    expected_summary_keys = {
        (location, str(year), period)
        for location in by_location
        for year in range(2004, 2026)
        for period in ["annual", "growing_season"]
    }
    require(len(summary_keys) == len(summaries)
            and summary_keys == expected_summary_keys,
            f"{dataset}: missing or duplicate summaries")

    for summary in summaries:
        selected = by_year[(summary["location_id"], int(summary["year"]))]
        if summary["period"] == "growing_season":
            selected = [r for r in selected
                        if r["is_growing_season"] == "true"]
            require(len(selected) == 214, "Growing-season date count")

        require(int(summary["calendar_days"]) == len(selected),
                "Summary calendar-day count")

        for metric in metrics:
            for value, suffix in [("true", "true"),
                                  ("false", "false"), ("", "unknown")]:
                actual = sum(r[metric] == value for r in selected)
                require(actual == int(summary[f"{metric}_{suffix}"]),
                        f"{dataset}: inconsistent summary counts")

        for variable in ["tmax_c", "tmin_c", "prcp_mm"]:
            observed = sum(r[variable] != "" for r in selected)
            require(observed == int(summary[f"{variable}_observed_days"]),
                    f"{dataset}: inconsistent coverage count")
            coverage = observed / len(selected)
            require(abs(coverage - float(summary[f"{variable}_coverage"]))
                    <= 0.000001,
                    f"{dataset}: inconsistent coverage fraction")

    omissions = sum(r["calendar_status"] == "daymet_calendar_omission"
                    for r in daily)
    require(omissions == 30, f"{dataset}: calendar omission count")

    audit[dataset] = {
        "daily_rows": len(daily),
        "summary_rows": len(summaries),
        "locations": len(by_location),
        "calendar_omissions": omissions,
        "calendar_and_summary_checks": "passed",
    }

    print(f"{dataset}: calendar and summary checks PASSED")

    growing = [r for r in summaries if r["period"] == "growing_season"]
    for variable in ["tmax_c", "tmin_c", "prcp_mm"]:
        minimum = min(float(r[f"{variable}_coverage"]) for r in growing)
        print(f"  Minimum growing-season {variable} coverage: {minimum:.2%}")

    if dataset == "county":
        county_summary = growing

year_means = []

for year in range(2004, 2026):
    selected = [r for r in county_summary if int(r["year"]) == year]
    result = {"year": year, "sampling_points": len(selected)}

    for metric in metrics:
        complete = [r for r in selected
                    if int(r[f"{metric}_unknown"]) == 0]
        result[f"{metric}_complete_points"] = len(complete)
        result[f"{metric}_mean_days"] = (
            round(sum(int(r[f"{metric}_true"]) for r in complete) / 5, 2)
            if len(complete) == 5 else ""
        )
    year_means.append(result)

path = OUT / "county_year_means.csv"
with path.open("w", encoding="utf-8", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(year_means[0]))
    writer.writeheader()
    writer.writerows(year_means)

(OUT / "daymet_results_audit.json").write_text(
    json.dumps(audit, indent=2), encoding="utf-8"
)

print("\nCOUNTY PRELIMINARY RESULTS")
print("Simple averages of five sampling points; April-October only.")

for metric in metrics:
    field = f"{metric}_mean_days"
    available = [r for r in year_means if r[field] != ""]
    top = sorted(available, key=lambda r: (-r[field], r["year"]))[:3]
    print(metric + ":")
    for row in top:
        print(f"  {row['year']}: {row[field]} mean days")

print("\nSaved:", path)
print("Saved:", OUT / "daymet_results_audit.json")
