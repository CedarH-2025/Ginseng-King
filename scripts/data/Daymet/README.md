# Daymet Workflow

Contributor: Heming Bai

## Environment

Successfully run with Python 3.13.7 on Windows.
Uses only the Python standard library; no pip installation is required.

Run commands from the repository root.

## Main workflow

Download and process the five NOAA reference coordinates:

    py scripts/data/Daymet/run_daymet_references.py

Verify county sampling coordinates against the Census boundary,
then download and process the five county samples:

    py scripts/data/Daymet/run_daymet_county.py

Check calendar and summary consistency and regenerate preliminary
county sampling-point yearly means:

    py scripts/data/Daymet/check_daymet_results.py

The batch scripts reuse existing raw files when both the CSV and its
download metadata exist. Processing verifies the recorded raw checksum.
The county script retrieves the boundary again when rerun.

## Individual location

Example download:

    py scripts/data/Daymet/download_daymet.py --location wausau_asos_reference --lat 44.9275 --lon -89.6253

Example processing:

    py scripts/data/Daymet/process_daymet.py --location wausau_asos_reference

## Main outputs

Files are under data/Daymet/cleaned/.

- daymet_county_daily.csv: county sampling-point daily records.
- daymet_county_summary.csv: annual and growing-season summaries.
- daymet_reference_daily.csv: daily data at NOAA reference coordinates.
- daymet_reference_summary.csv: reference-coordinate summaries.
- county_year_means.csv: simple five-point growing-season means.
- daymet_results_audit.json: structural checking results.

Per-location daily files, summary files, and processing metadata
are also retained.

## Reading the CSV files

Boolean labels are lowercase true or false.
Empty labels mean unknown; empty weather values mean unavailable.
Do not convert empty cells to zero or false.

Source temperatures are degrees Celsius and precipitation is daily
water-equivalent millimeters. No division by ten is needed.

Calendar omissions are explicitly marked in calendar_status.
Thresholds and input checksums are recorded in processing metadata.

## Exploratory files

clean_daymet_sample.py and add_wet_spells.py were used for the initial
Wausau 2025 example. They are not required by the main batch workflow.

See progress-note/Daymet_Progress.md for methods, findings, and limitations.
