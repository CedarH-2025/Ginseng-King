import csv
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
INPUT = ROOT / "data/Daymet/cleaned/wausau_asos_2025_daily.csv"
OUTPUT = ROOT / "data/Daymet/cleaned/wausau_asos_2025_labeled.csv"

def wet_spell_labels(dates, flags, min_run=3):
    labels = [value if value != "true" else "" for value in flags]
    i = 0

    while i < len(flags):
        if flags[i] != "true":
            i += 1
            continue

        end = i
        while (end + 1 < len(flags)
               and flags[end + 1] == "true"
               and (dates[end + 1] - dates[end]).days == 1):
            end += 1

        left_dry = (
            i > 0
            and flags[i - 1] == "false"
            and (dates[i] - dates[i - 1]).days == 1
        )
        right_dry = (
            end + 1 < len(flags)
            and flags[end + 1] == "false"
            and (dates[end + 1] - dates[end]).days == 1
        )

        if end - i + 1 >= min_run:
            value = "true"
        elif left_dry and right_dry:
            value = "false"
        else:
            value = ""

        labels[i:end + 1] = [value] * (end - i + 1)
        i = end + 1

    return labels

with INPUT.open(encoding="utf-8-sig", newline="") as file:
    rows = list(csv.DictReader(file))

rows.sort(key=lambda row: row["date"])
dates = [date.fromisoformat(row["date"]) for row in rows]
flags = [row["is_wet_day"] for row in rows]
labels = wet_spell_labels(dates, flags)

for row, value in zip(rows, labels):
    row["is_prolonged_wet_day"] = value

with OUTPUT.open("w", encoding="utf-8", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

season = [row for row in rows if row["is_growing_season"] == "true"]

run = 0
longest = 0
previous = None

for row in season:
    day = date.fromisoformat(row["date"])
    if row["is_wet_day"] == "true":
        contiguous = previous is not None and (day - previous).days == 1
        run = run + 1 if contiguous else 1
        longest = max(longest, run)
    else:
        run = 0
    previous = day

print("Saved:", OUTPUT)
print("Daily rows:", len(rows))
print("April-October rows:", len(season))
print("Confirmed prolonged-wet days:",
      sum(row["is_prolonged_wet_day"] == "true" for row in season))
print("Unknown prolonged-wet days:",
      sum(row["is_prolonged_wet_day"] == "" for row in season))
print("Longest observed wet run within April-October:", longest, "days")
