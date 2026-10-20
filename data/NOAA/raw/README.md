# NOAA Raw Daily Weather Records for 2004 to 2025

This delivery contains NOAA GHCN-Daily records for six provisionally selected stations, covering January 1, 2004 through December 31, 2025 (22 calendar years). Download date: October 20, 2026.

## Stations

| Station ID | NOAA station name | Latitude | Longitude |
|---|---|---:|---:|
| USW00014897 | WAUSAU ASOS | 44.9275 | -89.6253 |
| USC00475364 | MERRILL | 45.1786 | -89.6617 |
| USC00475120 | MARSHFIELD EXP FARM | 44.6411 | -90.1333 |
| USC00478171 | STEVENS PT | 44.5114 | -89.5853 |
| USW00094985 | MARSHFIELD MUNI AP | 44.6378 | -90.1875 |
| USC00478190 | STOCKBRIDGE-MUNSEE RSVN | 44.87 | -88.9044 |

## Raw format and provenance

Each .dly file is an exact subset of NOAA original monthly lines for the selected years, retaining every available element and the original values and flags. Each line represents one station, year, month, and element, with up to 31 daily slots. Files are raw source subsets, not cleaned analysis datasets. Only the year filter has been applied. No missing values were filled, no quality-flagged observations were removed, and no units were converted.

TMAX and TMIN are stored in tenths of degrees Celsius; PRCP is stored in tenths of millimeters. The missing-value sentinel is -9999. Quality and measurement flags must be interpreted before analysis. See ghcnd_readme.txt for the full official format specification. Other elements may be present and have different units.

download_manifest.json lists source URLs, download date, source and delivery SHA-256 checksums, and basic year/variable presence counts. These counts are download verification only, not a completed historical suitability assessment. All three required variables have at least one nonmissing observation in every selected station-year, but some years are incomplete.

## Study-period decision and limitations

The user confirmed January 1, 2004 through December 31, 2025 as the common study and raw delivery window (22 calendar years). The earlier 2003 start was excluded because Stockbridge-Munsee Reservation only has December records in that year. Inclusion of a year in the files does not guarantee complete observations in that year. Final analytical inclusion must be determined later using growing-season completeness and quality checks. The station set was chosen using the 2025 feasibility screen; full-period analysis is deferred.

The two Marshfield stations are close together and do not provide independent spatial replication. NOAA stations supplement the separate Daymet sampling points and need not all lie inside Marathon County.

## Official source

https://www.ncei.noaa.gov/pub/data/ghcn/daily/
