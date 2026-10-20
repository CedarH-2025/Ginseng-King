# NOAA Data Selection Stage Note

Date: October 20, 2026  
Project member: Cedar Huang  
Stage: Station selection and raw data acquisition

This note records the candidate stations, the 2025 screening method, the final five stations, and the agreed data period for reuse in later project reporting. Following the 2004–2025 completeness audit, Stockbridge-Munsee was removed because of inadequate historical precipitation coverage. The final five-station set was confirmed by Cedar Huang.

## Initial candidate stations

Station metadata and variable-specific record years were obtained from the NOAA GHCN-Daily station and element inventories. TMAX means daily maximum temperature, TMIN daily minimum temperature, and PRCP daily precipitation. The years below are inventory endpoints, not evidence of continuous or complete daily coverage. An endpoint of 2026 does not imply a complete 2026 calendar year.

| Candidate station ID | NOAA name | Latitude | Longitude | Required variables and listed record years |
|---|---|---:|---:|---|
| USW00014897 | WAUSAU ASOS | 44.9275 | -89.6253 | TMAX, TMIN, PRCP: 1941–2026 |
| USC00475364 | MERRILL | 45.1786 | -89.6617 | TMAX, TMIN, PRCP: 1905–2026 |
| USC00475120 | MARSHFIELD EXP FARM | 44.6411 | -90.1333 | TMAX, TMIN, PRCP: 1912–2026 |
| USC00475255 | MEDFORD | 45.1308 | -90.3439 | TMAX, TMIN: 1893–2025; PRCP: 1889–2026 |
| USC00477349 | ROSHOLT | 44.6272 | -89.3061 | TMAX: 1941–2026; TMIN: 1947–2026; PRCP: 1941–2026 |
| USC00478171 | STEVENS PT | 44.5114 | -89.5853 | TMAX, TMIN, PRCP: 1893–2026 |
| USW00094985 | MARSHFIELD MUNI AP | 44.6378 | -90.1875 | TMAX, TMIN: 1996–2026; PRCP: 1998–2026 |
| USC00470239 | ANTIGO | 45.1606 | -89.1131 | TMAX, TMIN: 1894–2010; PRCP: 1894–2026 |
| USC00478241 | STRATFORD 1 NW | 44.8175 | -90.0900 | PRCP: 1948–2026; TMIN: 1976 only; no TMAX entry |
| USC00478969 | WAUSAU WSAW TV | 44.9464 | -89.6222 | PRCP: 2001–2026; no TMAX or TMIN entry |

Three additional candidates were subsequently screened to find replacements and improve geographic coverage. Marshfield Muni AP, already in the initial list, was also screened in this replacement round.

| Additional candidate station ID | NOAA name | Latitude | Longitude | Required variables and listed record years |
|---|---|---:|---:|---|
| USC00476357 | OWEN 1E | 44.9461 | -90.5517 | TMAX, TMIN, PRCP: 1946–2026 |
| USC00478190 | STOCKBRIDGE-MUNSEE RSVN | 44.8700 | -88.9044 | TMAX, TMIN, PRCP: 2003–2026 |
| USC00475808 | NEILLSVILLE 3ESE | 44.5378 | -90.5350 | TMAX, TMIN, PRCP: 1893–2026 |

## Selection method

Candidates were first checked for recent availability of all three required variables. Antigo was excluded from the recent three-variable screen because its temperature records end in 2010. Stratford 1 NW and Wausau WSAW TV lack the required recent temperature records.

Daily records for calendar year 2025, the latest complete calendar year at the time of selection, were downloaded for ten candidates across two screening rounds. Coverage was checked for the full year (365 days) and the initial April–October growing season (214 days). A usable daily value was defined as nonmissing and having a blank NOAA quality flag. Checks also included duplicate records, consecutive missing-day gaps, negative precipitation, and daily maximum temperature below daily minimum temperature. Missing values were not filled.

Selection emphasized PRCP completeness because missing precipitation can substantially distort rainy-day counts and the longest consecutive rainy period. Temperature completeness and geographic distribution were also considered. A proposed screening threshold was at least 95% usable growing-season observations for each variable; this was a project screening choice, not a NOAA standard. Blank quality flags and high coverage do not independently establish measurement accuracy.

| Screened station | Usable growing-season TMAX | Usable growing-season TMIN | Usable growing-season PRCP | Selection decision |
|---|---:|---:|---:|---|
| WAUSAU ASOS | 214/214 | 214/214 | 214/214 | Selected |
| MERRILL | 214/214 | 214/214 | 214/214 | Selected |
| MARSHFIELD EXP FARM | 214/214 | 214/214 | 214/214 | Selected |
| STEVENS PT | 214/214 | 214/214 | 214/214 | Selected |
| MARSHFIELD MUNI AP | 214/214 | 214/214 | 213/214 | Selected; one missing precipitation day |
| STOCKBRIDGE-MUNSEE RSVN | 214/214 | 214/214 | 206/214 | Initially selected; subsequently removed after the full-period PRCP audit |
| MEDFORD | 120/214 | 119/214 | 214/214 | Not selected because of substantial temperature gaps |
| ROSHOLT | 203/214 | 204/214 | 201/214 | Not selected because of missing observations, particularly PRCP |
| OWEN 1E | 194/214 | 205/214 | 196/214 | Not selected because of temperature and precipitation gaps |
| NEILLSVILLE 3ESE | 214/214 | 214/214 | 193/214 | Not selected because of precipitation gaps |

Stockbridge-Munsee initially met the proposed screening threshold, with 96.26% usable growing-season PRCP in 2025. However, the 2004–2025 audit found that its PRCP coverage reached 95% in only one growing season (2025); its temperature variables each passed in 19 growing seasons. It was therefore removed from the final selection and raw delivery. Its candidate metadata and initial screening results remain above as selection history. Missing days must not be treated as dry days or automatically bridged in rainfall-spell calculations.

## Final station list

| Station ID | NOAA name | Latitude | Longitude | Geographic role |
|---|---|---:|---:|---|
| USW00014897 | WAUSAU ASOS | 44.9275 | -89.6253 | Central and local reference |
| USC00475364 | MERRILL | 45.1786 | -89.6617 | Northern reference |
| USC00475120 | MARSHFIELD EXP FARM | 44.6411 | -90.1333 | Southwestern reference |
| USC00478171 | STEVENS PT | 44.5114 | -89.5853 | Southern reference |
| USW00094985 | MARSHFIELD MUNI AP | 44.6378 | -90.1875 | Additional southwestern reference |

The two Marshfield stations are approximately 4.3 km apart, so the five stations must not be treated as independent spatial samples. Removing Stockbridge-Munsee reduces eastern coverage. NOAA stations provide observations for comparison with Daymet and are separate from the project's planned 5–10 county sampling points.

## Data period and current status

The agreed study and raw delivery period remains **January 1, 2004 through December 31, 2025**, covering **22 calendar years**. The start date was originally chosen because Stockbridge-Munsee only had December records in 2003. Its subsequent removal does not change the agreed study window.

The full-period audit verified that **all five retained stations meet the 95% usable-day threshold for TMAX, TMIN, and PRCP in every April–October growing season from 2004 through 2025**. All 22 growing seasons therefore pass this initial coverage criterion; no arbitrary reduction to 20 years is required. This does not mean that all observations are present: only five years (2008, 2012, 2013, 2015, and 2017) have fully observed, unflagged growing-season data for all three variables across all five stations. Indicator-specific gap treatment remains necessary.

For full calendar years, only 18 years meet the same 95% threshold simultaneously across all five stations. Annual and growing-season suitability must therefore be distinguished. The threshold is a project screening criterion, not proof of measurement accuracy or reliable rainfall-spell estimates across gaps.

Five raw station files are stored in `data/NOAA/raw/`, named `<station_id>_2004_2025.dly`. The Stockbridge-Munsee file and its manifest entry were removed after the station-set revision. The retained files preserve original NOAA monthly lines, all available elements, native units, missing-value codes, and flags. Only the year filter was applied. The directory also contains an English README, the official format documentation, and `download_manifest.json` with source URLs, checksums, and basic station-year variable-presence counts. Data were downloaded on October 20, 2026.

## Source references

- [NOAA GHCN-Daily station inventory](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt)
- [NOAA GHCN-Daily variable and year inventory](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt)
- [NOAA GHCN-Daily data format and flags](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt)
- [Delivered raw data and provenance](../data/NOAA/raw/README.md)
