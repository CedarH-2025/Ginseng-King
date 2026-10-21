# Ginseng King Weather Dashboard

An interactive, browser-only weather evidence dashboard for the CS 598 Ginseng King project. It summarizes historical outdoor weather observations relevant to Wisconsin American ginseng research without claiming effects on disease, yield, or root quality.

## Quick start

From the `website/` directory:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Other commands:

```bash
npm test          # Run unit and data-integration tests
npm run build     # Create the production site in dist/
npm run preview   # Preview the production build
npm run check     # Run tests and then build
```

`npm run dev` and `npm run build` automatically run `scripts/prepare-data.mjs`. The script validates and copies the canonical cleaned data into the ignored `public/data/` directory. Generated data copies and map geometry should not be edited by hand.

## Data sources

The dashboard uses five NOAA GHCN-Daily stations from January 1, 2004 through December 31, 2025:

- Wausau ASOS
- Merrill
- Marshfield Exp Farm
- Stevens Point
- Marshfield Municipal Airport

Canonical repository inputs:

| File | Dashboard use |
|---|---|
| `data/NOAA/cleaned/daily_weather.csv` | 40,180 station-day rows used by Daily Detail and sensitivity calculations |
| `data/NOAA/cleaned/seasonal_summary.csv` | 220 station-year-period rows used by Overview, Explore Data, and coverage views |
| `data/NOAA/cleaned/processing_metadata.json` | Station list, baseline thresholds, status counts, input checksums, and provenance |
| `data/Daymet/cleaned/daymet_county_summary.csv` | 220 Daymet sampling-point year-period rows used by the Daymet interactive charts |
| `data/Daymet/cleaned/daymet_county_daily.csv` | 40,180 Daymet sampling-point daily rows retained for provenance and future daily extensions |
| `data/Daymet/cleaned/daymet_reference_summary.csv` | Daymet summaries at NOAA station coordinates used for NOAA-vs-Daymet reference comparison |
| `data/Daymet/cleaned/county_year_means.csv` | Simple five-point growing-season means used for Daymet yearly ranking cards/charts |
| `data/Daymet/county_locations.csv` | Five Marathon County geographic sampling points |
| `data/Daymet/cleaned/daymet_results_audit.json` | Daymet structural row-count and calendar audit results |
| `progress-note/NOAA_Cleaning.md` | Cleaning rules, nullable-label semantics, and threshold rationale |
| `progress-note/NOAA_DataChoose.md` | Station-selection rationale and geographic roles |
| `progress-note/Daymet_Progress.md` | Daymet methods, calendar handling, preliminary county results, and limitations |

Main daily fields include station ID/name, date, latitude, longitude, TMAX, TMIN, PRCP, processing status, growing-season flag, and nullable hot/freeze/wet/heavy/prolonged-wet labels. Summary fields include expected and usable days, variable coverage, and true/false/unknown label counts.

Daymet fields use degrees Celsius and water-equivalent millimeters directly. Daymet calendar omissions are retained as rows with unknown weather values and labels.

The regional map uses U.S. Census Bureau county boundaries packaged by `us-atlas`. The preparation script extracts only Lincoln, Marathon, Wood, and Portage counties, so the browser never requests an external map service.

## Dashboard guide

### 1. Overview

This panel provides a quick project and dataset summary.

**Metric cards**

- **Study window:** 2004–2025, or 22 calendar years.
- **Weather stations:** five retained NOAA stations.
- **Daily records:** station-day observations, including dates with missing values.
- **Summary records:** station × year × period combinations.

**Growing-season hot days**

- Shows the five-station mean number of April–October hot days for each year.
- The shaded band is the observed minimum-to-maximum station range.
- The baseline definition is TMAX ≥ 30°C.
- Hover over a year to see the mean and station range.

**Typical wet-day count differs by station**

- Shows each station's mean April–October wet-day count across 2004–2025.
- A baseline wet day has PRCP ≥ 1 mm.
- This chart compares observed weather counts; it does not rank agricultural performance.

**Coverage is high, but not always complete**

- Shows the lowest station coverage in each April–October season for TMAX, TMIN, and PRCP.
- A dip means at least one station had missing or excluded observations that year.
- Hover to inspect the exact percentage and variable.

**Central Wisconsin station map**

- Shows the five stations within a four-county regional extent rather than on a world map.
- Hover over a point to see station name, station ID, coordinates, and geographic role.
- Scroll to zoom and drag to pan.
- The two Marshfield markers are visually offset so both can be inspected; their tooltip coordinates remain the true coordinates.
- Expand **View accessible station table** for the same information in table form.

### 2. Explore Data

This panel compares the repository's official baseline summaries.

**Filters**

- **Station:** select one, several, or all stations.
- **Year range:** choose inclusive start and end years.
- **Period:** switch between Annual and April–October.
- **Metric:** select hot, freezing, wet, heavy-precipitation, prolonged-wet days, or mean coverage.

Metric definitions:

| Metric | Baseline meaning |
|---|---|
| Hot days | TMAX ≥ 30°C |
| Freezing days | TMIN < 0°C |
| Wet days | PRCP ≥ 1 mm |
| Heavy precipitation days | PRCP ≥ 20 mm |
| Prolonged-wet days | Days in a confirmed run of at least three wet days |
| Mean coverage | Mean of TMAX, TMIN, and PRCP usable-day coverage |

**Station trend chart**

- Draws one line per selected station across the selected years.
- Hover to compare station values for a year.
- Use the slider or mouse/touch gestures to zoom along the time axis.
- Highlighting a line makes crowded comparisons easier.

**Station × year heatmap**

- Columns are years and rows are selected stations.
- Cell color represents the selected metric.
- Hover over a cell to see its exact value and unknown-day count.
- Use the bottom slider to focus on a shorter year window.

**Station summary table**

- Reports the mean, minimum, maximum, and total unknown count for the active filters.
- For coverage, “unknown” is reported in variable-days across TMAX, TMIN, and PRCP.

**Exports**

- **Trend PNG** and **Heatmap PNG** download report-ready images.
- **Filtered CSV** downloads the currently selected station-year rows.
- The download icon inside a chart also exports that chart as PNG.

### 3. Daymet

This panel turns the new Daymet V4 R1 county sampling-point outputs into interactive charts. The default view matches the preliminary static figures: April–October, 2004–2025, five Marathon County sampling points.

**Filters**

- **County sampling point:** select central, northern, southern, western, eastern, or any subset.
- **Year range:** choose inclusive start and end years.
- **Period:** switch between Annual and April–October.
- **Metric:** select freezing days, hot days, longest wet spell, wet days, heavy precipitation days, or prolonged-wet days.

**Daymet sampling-point line chart**

- Draws one line per selected Marathon County sampling point.
- Use it to compare whether exposure patterns move together across points and years.
- Hover over a year to read exact values.
- Use the slider or mouse/touch gestures to zoom along the year axis.

**Five-point mean chart**

- Shows the highest years by simple five-point mean for the selected metric.
- This is not an area-weighted county average.
- For metrics not present in `county_year_means.csv`, the chart calculates the mean from the selected point-year rows.

**Point × year heatmap**

- Rows are selected Daymet sampling points and columns are years.
- Cell color represents the selected metric.
- Hover over a cell to see the exact value and unknown-label count.

**NOAA baseline vs Daymet reference coordinates**

- Compares NOAA station summaries against Daymet summaries at the matching station coordinates.
- This is available for count metrics that exist in both summaries.
- Longest observed wet-run length is not in the NOAA seasonal summary, so that comparison is intentionally not shown for the longest wet spell metric.

**Sampling-point summary table**

- Reports mean, minimum, maximum, and unknown-label totals for the active Daymet selection.

**Exports**

- **Line PNG** and **Heatmap PNG** download the active Daymet charts.
- **Filtered CSV** downloads the active Daymet point-year rows.

### 4. Daily Detail & Sensitivity

This panel examines one station and year at daily resolution.

**Controls**

- Select a station and year.
- Adjust the hot, wet-day, heavy-precipitation, and prolonged-wet-duration thresholds.
- Change the growing-season start and end months.
- **Restore baseline** returns all controls to the documented project defaults.

These controls perform exploratory calculations in the browser. They do not modify the cleaned source files or replace the official baseline values.

**Summary cards**

- Report exploratory hot, wet, and heavy-precipitation counts.
- Report the longest observed consecutive wet run in the selected season.
- Report the last observed spring freeze from January through June.
- Each card separately reports relevant unknown observations.

If precipitation is missing, the displayed longest wet run is an observed lower bound rather than a guaranteed maximum.

**Daily temperature chart**

- Red line: observed TMAX.
- Blue line: observed TMIN.
- Red dots: days meeting the active hot threshold.
- Blue dots: freezing days using the fixed TMIN < 0°C definition.
- Dashed horizontal lines mark the hot and freezing thresholds.
- The pale background shows the selected growing season.
- Line gaps are missing or excluded observations; they are not interpolated.

**Daily precipitation chart**

- Bars show observed daily PRCP in millimeters.
- Wet and heavy-precipitation days use different colors.
- Dashed lines show the active wet and heavy thresholds.
- An “×” marks unknown precipitation rather than a zero or dry day.
- Missing PRCP always breaks an observed wet run.

Both daily charts support hover tooltips, horizontal zooming, and PNG export.

**Baseline vs current controls**

- Compares official baseline true/unknown counts against the current exploratory controls.
- This table makes sensitivity changes visible without overwriting the baseline.

**Event and gap log**

- Lists dates with an active weather event or a missing TMAX, TMIN, or PRCP value.
- Shows the daily values and all applicable labels.

### 5. Data Quality, Methods & Limitations

This panel explains data completeness, cleaning, provenance, and interpretation limits.

**Coverage controls**

- Select TMAX, TMIN, or PRCP.
- Switch between Annual and April–October coverage.

**Coverage heatmap**

- Columns are years and rows are stations.
- Color represents the percentage of expected days with usable observations after final cleaning.
- Hover to see coverage, usable-day count, and unknown-day count.

**Usable and unknown days table**

- Provides the exact coverage accounting for every station-year in the selected period.
- Unknown days equal expected days minus usable days for the selected variable.

The remainder of the panel documents:

- Official baseline thresholds.
- Processing and raw-download dates.
- Cleaning status counts for each variable.
- The difference between station-screening coverage and final analysis coverage.
- Data provenance and SHA-256 checksums.
- Required limitations on agricultural interpretation.
- The status of the NOAA-vs-Daymet comparison now included in the Daymet panel.

### 6. About Us

This panel lists the three project members, their proposal-defined responsibilities, verified UIUC email addresses, and the team's remote-collaboration plan. Email addresses are clickable `mailto:` links.

## How to interpret missing values

- Empty weather cells are missing or excluded observations.
- Empty boolean labels mean **unknown**, not false.
- Missing precipitation is never treated as a dry day.
- Wet runs never bridge a missing precipitation date.
- No interpolation or imputation is performed.
- A short wet run touching a missing day can remain unknown.

## Analytical boundary

NOAA stations measure outdoor air temperature and precipitation. They do not directly measure conditions under ginseng shade structures, soil moisture, leaf wetness, root-zone temperature, plant health, disease, yield, or root quality.

The 30°C hot threshold and three-day prolonged-wet threshold are adjustable project screening choices, not validated ginseng-damage thresholds. The dashboard supports descriptive weather comparison and exploratory sensitivity analysis; it does not support agricultural causal claims.

## Static architecture

The application uses Vite, vanilla JavaScript, and Apache ECharts. It has:

- No backend or database.
- No credentials or GitHub token.
- No runtime request to a private repository.
- No runtime NOAA, GitHub, or external map API dependency.

Production files are written to `dist/`.
