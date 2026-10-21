# Daymet Data Preparation and Preliminary Analysis

Project member: Heming Bai

## Completed work

Downloaded and processed Daymet daily maximum temperature, minimum
temperature, and precipitation for 2004-2025 at ten coordinates:

- Five NOAA station reference coordinates for later station-Daymet comparison.
- Five geographic sampling points inside Marathon County for county sampling-point analysis.

The county points cover central, northern, southern, western, and eastern
positions. Their coordinates were checked against the U.S. Census Bureau
TIGERweb county boundary, GEOID 55073. These are geographic sampling
locations, not verified ginseng farms or a random sample of agricultural land.

## Data organization

- data/Daymet/raw/: original CSV downloads and download metadata.
- data/Daymet/geography/: county boundary and verification metadata.
- data/Daymet/reference_locations.csv: NOAA reference coordinates and station IDs.
- data/Daymet/county_locations.csv: county sampling coordinates.
- data/Daymet/cleaned/daymet_reference_daily.csv: reference-coordinate daily data.
- data/Daymet/cleaned/daymet_reference_summary.csv: reference-coordinate summaries.
- data/Daymet/cleaned/daymet_county_daily.csv: county sampling-point daily data.
- data/Daymet/cleaned/daymet_county_summary.csv: county sampling-point summaries.
- data/Daymet/cleaned/county_year_means.csv: simple five-point yearly means.
- data/Daymet/cleaned/daymet_results_audit.json: calendar and summary audit results.
- scripts/data/Daymet/: download, processing, batch, and checking scripts.

Each download records its source URL, requested coordinates, retrieval
time, source header, and SHA-256 checksum. Processing verifies the raw
checksum and records the thresholds used.

## Calendar handling

Each raw location file contains 8,030 records: 22 years of 365 Daymet days.
Daymet includes February 29 but omits December 31 in leap years.

The processing pipeline inserts the six omitted calendar dates per
location, keeping weather values and labels unknown. No interpolation
or substitution with dry days is performed.

Each location therefore has 8,036 calendar rows and 44 summary rows:
22 annual periods and 22 April-October growing seasons.

Each five-location dataset contains 40,180 daily calendar rows and
220 summary rows. Of those daily rows, 30 are calendar omissions
retained as unknown.

## Indicator definitions

Temperatures are already in degrees Celsius. Daily precipitation is
expressed as water-equivalent millimeters, including forms other than rain.

- Freezing day: TMIN < 0 degrees Celsius.
- Hot day: TMAX >= 30 degrees Celsius.
- Wet day: PRCP >= 1 mm.
- Heavy precipitation day: PRCP >= 20 mm.
- Prolonged wet day: membership in an observed run of at least three wet days.

The heat threshold and three-day duration are project screening choices,
not established universal ginseng-damage thresholds.

Wet-spell membership is calculated over the complete chronological
series before filtering by year or season. Every day in a confirmed
run is labeled true. Missing precipitation interrupts confirmation.
Short runs adjoining missing data or dataset boundaries remain unknown
when their complete duration cannot be established.

The longest observed wet run in each summary is calculated within that
specific annual or growing-season period. With missing values, it is
an observed lower bound rather than an estimate of the complete run.

## Checks performed

For both five-location datasets, calendar and summary consistency
checks passed, including:

- Expected row counts and unique location-date keys.
- Complete calendar coverage for every location.
- Growing-season flags and 214 calendar days per growing season.
- Valid true, false, and unknown label representations.
- Agreement between daily label counts and summary counts.
- Agreement between daily nonmissing values and reported coverage.

The processing pipeline also rejects negative precipitation and
TMAX below TMIN when both temperature values are available.

Minimum April-October availability of TMAX, TMIN, and PRCP was 100%
across all location-years in both Daymet datasets. This describes
availability of gridded estimates, not agreement with field observations.

The 2025 Wausau reference result was consistent between the initial
single-year scripts and the full-period pipeline: 26 freezing days,
11 hot days, 66 wet days, 10 heavy-precipitation days, and 18 prolonged
wet days, with a longest growing-season wet run of five days.

## Preliminary county sampling-point results

The following are simple averages of the five sampling points during
April-October, not county area-weighted averages.

| Indicator | Highest three years and mean days |
|---|---|
| Freezing days | 2018: 43.8; 2020: 41.8; 2013: 38.4 |
| Hot days | 2012: 32.2; 2005: 21.8; 2018: 20.8 |
| Wet days | 2014: 88.2; 2017: 87.8; 2019: 87.2 |
| Heavy precipitation days | 2019: 14.4; 2021: 14.2; 2010: 13.4 |
| Prolonged wet days | 2014: 47.8; 2013: 46.6; 2004: 44.4 |

Yearly means are calculated only when all five points have complete
labels for that indicator and period. Counts at different points need
not refer to the same calendar dates.

Different years rank highest for different indicators. This supports
examining heat, freezing, and wet-weather exposure separately rather
than treating a year as uniformly favorable or unfavorable.

These rankings are descriptive. They do not establish a long-term
trend, statistical significance, crop damage, disease, or yield effects.

## Remaining work and collaboration

- Cedar Huang: use the reference-coordinate data for NOAA-Daymet comparison.
- Work with Haiyue Liu on agricultural assumptions and interpretation.
- Connect county sampling-point data to visualizations or the dashboard.
- Test alternative thresholds and growing-season windows.
- Review point-level patterns and explain limitations in the project report.

The reference dataset includes reference_noaa_station_id for matching
with NOAA. Compare records by station ID and calendar date, not row order.
Unknown labels must remain distinguishable from false.

The structural audit does not constitute an independent validation of
Daymet accuracy. Public outdoor weather estimates also do not directly
measure conditions under ginseng shade structures or plant health.

## Sources

- Daymet download service: https://daymet.ornl.gov/web_services.html
- Daymet calendar and format: https://daymet.ornl.gov/single-pixel-tool-guide
- Daymet dataset citation: https://doi.org/10.3334/ORNLDAAC/2129
- Census county boundaries: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer
