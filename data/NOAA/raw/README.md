# NOAA Raw Daily Weather Records for 2004 to 2025

This delivery contains NOAA GHCN-Daily records for five selected stations, covering January 1, 2004 through December 31, 2025 (22 calendar years). Download date: October 20, 2026. Stockbridge-Munsee was removed after the historical precipitation completeness audit.

## Stations

| Station ID | NOAA station name | Latitude | Longitude |
|---|---|---:|---:|
| USW00014897 | WAUSAU ASOS | 44.9275 | -89.6253 |
| USC00475364 | MERRILL | 45.1786 | -89.6617 |
| USC00475120 | MARSHFIELD EXP FARM | 44.6411 | -90.1333 |
| USC00478171 | STEVENS PT | 44.5114 | -89.5853 |
| USW00094985 | MARSHFIELD MUNI AP | 44.6378 | -90.1875 |

## Raw format and provenance

Each .dly file is an exact subset of NOAA original monthly lines for the selected years, retaining every available element and the original values and flags. Each line represents one station, year, month, and element, with up to 31 daily slots. Files are raw source subsets, not cleaned analysis datasets. Only the year filter has been applied. No missing values were filled, no quality-flagged observations were removed, and no units were converted.

TMAX and TMIN are stored in tenths of degrees Celsius; PRCP is stored in tenths of millimeters. The missing-value sentinel is -9999. Quality and measurement flags must be interpreted before analysis. See ghcnd_readme.txt for the full official format specification. Other elements may be present and have different units.

download_manifest.json lists the five retained stations, source URLs, download date, source and delivery SHA-256 checksums, and basic year/variable presence counts. These counts are download verification only. A separate completeness audit has been performed; some observations remain missing or quality-flagged.

## Study-period decision and limitations

The confirmed common study and raw delivery window remains January 1, 2004 through December 31, 2025 (22 calendar years). The original start-date choice reflected Stockbridge-Munsee's incomplete 2003 record; the window was retained after removing that station.

The five retained stations each have at least 95% usable observations for every required variable in every April–October growing season of the 22-year window. Usable means nonmissing with a blank NOAA quality flag. Only five growing seasons are completely observed for all three variables simultaneously across all five stations: 2008, 2012, 2013, 2015, and 2017. For full calendar years, 18 years meet the shared 95% criterion. Passing coverage does not establish reliable consecutive-rainfall estimates across missing days. No missing values have been filled, and indicator-specific gap treatment remains necessary.

See [NOAA Data Selection Stage Note](../../../progress-note/NOAA_DataChoose.md) for the candidate list, station-removal rationale, and current selection.

The two Marshfield stations are close together and do not provide independent spatial replication. NOAA stations supplement the separate Daymet sampling points and need not all lie inside Marathon County.

## Official source

https://www.ncei.noaa.gov/pub/data/ghcn/daily/
