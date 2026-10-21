export function parseCsv(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length || record.length) {
    record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
    records.push(record);
  }

  if (!records.length) return [];
  const headers = records.shift();
  headers[0] = headers[0].replace(/^\uFEFF/, '');

  return records
    .filter((values) => values.length > 1 || values[0] !== '')
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
    );
}

function numberOrNull(value) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanOrNull(value) {
  if (value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new TypeError(`Unexpected boolean value: ${value}`);
}

function typeDailyRow(row) {
  return {
    station_id: row.station_id,
    station_name: row.station_name,
    date: row.date,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    is_growing_season: booleanOrNull(row.is_growing_season),
    tmax_c: numberOrNull(row.tmax_c),
    tmax_status: row.tmax_status,
    tmin_c: numberOrNull(row.tmin_c),
    tmin_status: row.tmin_status,
    prcp_mm: numberOrNull(row.prcp_mm),
    prcp_status: row.prcp_status,
    is_freezing_day: booleanOrNull(row.is_freezing_day),
    is_hot_day: booleanOrNull(row.is_hot_day),
    is_wet_day: booleanOrNull(row.is_wet_day),
    is_heavy_precip_day: booleanOrNull(row.is_heavy_precip_day),
    is_prolonged_wet_day: booleanOrNull(row.is_prolonged_wet_day),
  };
}

function typeSummaryRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      key === 'station_id' || key === 'period' ? value : numberOrNull(value),
    ]),
  );
}

function typeDaymetSummaryRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ['source', 'reference_noaa_station_id', 'location_id', 'period'].includes(key)
        ? value
        : numberOrNull(value),
    ]),
  );
}

function typeDaymetDailyRow(row) {
  return {
    source: row.source,
    location_id: row.location_id,
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    date: row.date,
    calendar_status: row.calendar_status,
    tmax_c: numberOrNull(row.tmax_c),
    tmin_c: numberOrNull(row.tmin_c),
    prcp_mm: numberOrNull(row.prcp_mm),
    is_growing_season: booleanOrNull(row.is_growing_season),
    is_freezing_day: booleanOrNull(row.is_freezing_day),
    is_hot_day: booleanOrNull(row.is_hot_day),
    is_wet_day: booleanOrNull(row.is_wet_day),
    is_heavy_precip_day: booleanOrNull(row.is_heavy_precip_day),
    is_prolonged_wet_day: booleanOrNull(row.is_prolonged_wet_day),
  };
}

function typeLocationRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      ['latitude', 'longitude'].includes(key) ? numberOrNull(value) : value,
    ]),
  );
}

function typeCountyYearMeanRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      key === 'year' || key.endsWith('_points') || key === 'sampling_points' ? numberOrNull(value) : numberOrNull(value),
    ]),
  );
}

async function fetchRequired(path, label) {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${label} could not be loaded (${response.status} ${response.statusText}).`);
  }
  return response.text();
}

function validateDatasets(daily, summary, metadata) {
  if (daily.length !== metadata.rows) {
    throw new Error(
      `Daily data has ${daily.length.toLocaleString()} rows, but metadata expects ${metadata.rows.toLocaleString()}.`,
    );
  }

  const stationIds = new Set(daily.map((row) => row.station_id));
  const metadataStations = Object.keys(metadata.stations ?? {});
  if (stationIds.size !== metadataStations.length || metadataStations.some((id) => !stationIds.has(id))) {
    throw new Error('Station IDs in daily_weather.csv and processing_metadata.json do not match.');
  }

  const expectedSummaryRows = metadataStations.length * 22 * 2;
  if (summary.length !== expectedSummaryRows) {
    throw new Error(
      `Summary data has ${summary.length} rows; ${expectedSummaryRows} station-year-period rows were expected.`,
    );
  }

  if (daily[0]?.date !== '2004-01-01' || daily.at(-1)?.date !== '2025-12-31') {
    throw new Error('Daily weather dates do not span the documented 2004–2025 period.');
  }
}

export async function loadDatasets() {
  const [
    dailyText,
    summaryText,
    metadataText,
    websiteManifestText,
    stationRegionText,
    daymetCountySummaryText,
    daymetCountyDailyText,
    daymetReferenceSummaryText,
    daymetCountyMeansText,
    daymetAuditText,
    countyLocationsText,
    referenceLocationsText,
  ] = await Promise.all([
    fetchRequired('daily_weather.csv', 'Daily weather data'),
    fetchRequired('seasonal_summary.csv', 'Seasonal summary data'),
    fetchRequired('processing_metadata.json', 'Processing metadata'),
    fetchRequired('website_data_manifest.json', 'Website data manifest'),
    fetchRequired('station_region.geojson', 'Regional station map'),
    fetchRequired('daymet_county_summary.csv', 'Daymet county summary data'),
    fetchRequired('daymet_county_daily.csv', 'Daymet county daily data'),
    fetchRequired('daymet_reference_summary.csv', 'Daymet reference summary data'),
    fetchRequired('county_year_means.csv', 'Daymet county yearly means'),
    fetchRequired('daymet_results_audit.json', 'Daymet audit metadata'),
    fetchRequired('county_locations.csv', 'Daymet county locations'),
    fetchRequired('reference_locations.csv', 'Daymet reference locations'),
  ]);

  const daily = parseCsv(dailyText).map(typeDailyRow);
  const summary = parseCsv(summaryText).map(typeSummaryRow);
  const metadata = JSON.parse(metadataText);
  const websiteManifest = JSON.parse(websiteManifestText);
  const stationRegion = JSON.parse(stationRegionText);
  const daymetCountySummary = parseCsv(daymetCountySummaryText).map(typeDaymetSummaryRow);
  const daymetCountyDaily = parseCsv(daymetCountyDailyText).map(typeDaymetDailyRow);
  const daymetReferenceSummary = parseCsv(daymetReferenceSummaryText).map(typeDaymetSummaryRow);
  const daymetCountyMeans = parseCsv(daymetCountyMeansText).map(typeCountyYearMeanRow);
  const daymetAudit = JSON.parse(daymetAuditText);
  const daymetCountyLocations = parseCsv(countyLocationsText).map(typeLocationRow);
  const daymetReferenceLocations = parseCsv(referenceLocationsText).map(typeLocationRow);
  validateDatasets(daily, summary, metadata);
  if (stationRegion.type !== 'FeatureCollection' || stationRegion.features?.length !== 4) {
    throw new Error('Regional station map does not contain the expected four county boundaries.');
  }
  if (
    daymetCountySummary.length !== 220 ||
    daymetCountyDaily.length !== 40_180 ||
    daymetReferenceSummary.length !== 220 ||
    daymetCountyLocations.length !== 5 ||
    daymetAudit.county?.calendar_and_summary_checks !== 'passed'
  ) {
    throw new Error('Daymet county data did not pass the expected structural checks.');
  }

  const stations = [];
  const seen = new Set();
  for (const row of daily) {
    if (seen.has(row.station_id)) continue;
    seen.add(row.station_id);
    stations.push({
      id: row.station_id,
      name: row.station_name,
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }

  return {
    daily,
    summary,
    metadata,
    websiteManifest,
    stationRegion,
    daymet: {
      countySummary: daymetCountySummary,
      countyDaily: daymetCountyDaily,
      referenceSummary: daymetReferenceSummary,
      countyMeans: daymetCountyMeans,
      audit: daymetAudit,
      countyLocations: daymetCountyLocations,
      referenceLocations: daymetReferenceLocations,
    },
    stations,
    dailyByStation: Map.groupBy
      ? Map.groupBy(daily, (row) => row.station_id)
      : daily.reduce((groups, row) => {
          if (!groups.has(row.station_id)) groups.set(row.station_id, []);
          groups.get(row.station_id).push(row);
          return groups;
        }, new Map()),
  };
}
