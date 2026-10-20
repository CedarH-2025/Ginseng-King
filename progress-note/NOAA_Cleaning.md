# NOAA Cleaning and Daily Weather Labels

Date: October 20, 2026. Project member: Cedar Huang.

The five retained stations are processed for all calendar dates from January 1, 2004 through December 31, 2025. The script is `scripts/data/NOAA-cleaning/clean_noaa.py`. Outputs are stored in `data/NOAA/cleaned/`. Raw files remain unchanged. Verification helpers under `scripts/data/NOAA-verification` are imported by the cleaning script.

## Data structure and cleaning decisions

`daily_weather.csv` contains one row per station and date: station ID and name, latitude, longitude, calendar date, temperatures in degrees Celsius, precipitation in millimeters, the growing-season flag, original raw integer values, NOAA flags, variable-specific processing status, and weather labels. All 40,180 station-days are retained, including leap days and dates without usable observations. `is_growing_season` is true for April through October. Weather labels are computed throughout the year, independently of this season flag.

TMAX, TMIN, and PRCP values are divided by ten to obtain analysis units. Raw -9999 values and absent observations become empty analysis cells. Nonblank QFLAG observations are excluded from the corresponding analysis variable. Original values, MFLAG, QFLAG, and SFLAG remain available. Negative precipitation is excluded; if otherwise usable TMAX is below TMIN, both temperature values are excluded and given an explicit status. PRCP measurement flags A (accumulation since the last measurement) and P (missing presumed zero) are excluded from daily analysis. Other measurement and source flags are preserved without automatic exclusion. Trace precipitation retains its recorded zero and T measurement flag. No interpolation or imputation is applied, and exclusion of one variable does not automatically remove other variables on the same date.

CSV boolean cells contain lowercase `true` or `false`. Empty label cells mean unknown, not false. Downstream readers should explicitly preserve this distinction when importing the CSV. Empty weather-value cells mean missing or excluded, with the reason recorded in the corresponding status column.

## Weather definitions

| Field | Operational definition | Basis |
|---|---|---|
| is_freezing_day | TMIN < 0 degrees Celsius | Meteorological freezing exposure; consistent with the project proposal |
| is_hot_day | TMAX >= 30 degrees Celsius | Initial configurable project screening threshold; not a numerical crop-damage threshold established by the cited planting guides |
| is_wet_day | PRCP >= 1 mm | Climdex wet-day convention |
| is_heavy_precip_day | PRCP >= 20 mm | Climdex R20mm precipitation convention |
| is_prolonged_wet_day | A day belonging to an observed run of at least three consecutive wet days | Configurable project duration choice using the wet-day definition |

Every date in a confirmed wet run of at least three days is marked true, including the first two days retrospectively. Runs are computed on the full continuous station calendar, across month, season, and year boundaries. Known dry days are false. Missing precipitation days are unknown. A short wet run touching a missing day or the dataset boundary is also unknown because its full duration cannot be established; short runs bounded by observed dry days are false. Confirmed runs of three or more observed wet days are true even if a missing neighbor leaves their full extent uncertain. Unknown days are never bridged or converted to dry days.

## Interpretation for later reporting

Indicator categories were selected by considering ginseng production guidance alongside the available station weather variables. Official guidance identifies heat, excessive moisture, and freezing-related conditions as relevant concerns, but station air temperature and precipitation do not measure shaded-canopy conditions, root temperature, leaf wetness, or soil moisture. The numerical definitions combine meteorological conventions and explicitly identified project choices. They are reference labels for weather analysis, not diagnoses of plant injury, disease, yield loss, or verified field conditions.

No crop-specific universal 30-degree heat threshold or three-day wet-spell damage threshold was established by the cited guides. No Daymet comparison was used to calibrate these thresholds; the earlier Wausau Daymet sample demonstrated format matching only. PRCP includes liquid-equivalent precipitation rather than a separate observation of liquid rain. These distinctions are recorded here for reuse in the later report, without producing a full report at this stage.

## Output summaries and provenance

`seasonal_summary.csv` records observed true, false, and unknown label counts and variable coverage for every station-year, separately for annual and April–October periods. A count of observed true labels is not an imputed full-period total. Growing-season wet-run membership can reflect adjoining dates outside April–October because labels are assigned before seasonal filtering.

`processing_metadata.json` records actual thresholds, input SHA-256 checksums, station set, row count, and cleaning-status counts. Input checksums are verified against the raw delivery manifest. The input format parser also rejects duplicate monthly records and malformed records. Thresholds can be changed through command-line arguments; regenerate all outputs together so the metadata always matches them.

The initial run produced 40,180 daily rows and 220 station-year-period summary rows. Three focused validation checks passed, covering wet-run uncertainty, threshold and quality handling, row uniqueness, label recomputation, summary-count accounting, and unchanged raw checksums. The cleaning stage additionally excludes accumulated or presumed-zero precipitation, so its coverage can differ from the earlier verification stage that checked only missing values and QFLAG.

After a reported date-display concern, an explicit calendar-set comparison confirmed exactly 8,036 unique dates per station from 2004-01-01 through 2025-12-31, with all six leap days per station present. No date rows are missing from daily_weather.csv. Empty weather values or labels must be distinguished from missing dates. The cleaning script was relocated to the corrected scripts/data/NOAA-cleaning path; the erroneous script directory was removed.

Sources:

- [Wisconsin and Minnesota Extension ginseng guidance](https://corn.agronomy.wisc.edu/Crops/Ginseng.aspx)
- [Ontario ginseng production guidance](https://www.ontario.ca/page/ginseng-production)
- [Climdex wet-day, R20mm, and consecutive-wet-day definitions](https://www.climdex.org/learn/indices/)
- Official NOAA GHCN-Daily format and flag definitions are preserved in `data/NOAA/raw/ghcnd_readme.txt`.
