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
  const [dailyText, summaryText, metadataText, websiteManifestText, stationRegionText] = await Promise.all([
    fetchRequired('daily_weather.csv', 'Daily weather data'),
    fetchRequired('seasonal_summary.csv', 'Seasonal summary data'),
    fetchRequired('processing_metadata.json', 'Processing metadata'),
    fetchRequired('website_data_manifest.json', 'Website data manifest'),
    fetchRequired('station_region.geojson', 'Regional station map'),
  ]);

  const daily = parseCsv(dailyText).map(typeDailyRow);
  const summary = parseCsv(summaryText).map(typeSummaryRow);
  const metadata = JSON.parse(metadataText);
  const websiteManifest = JSON.parse(websiteManifestText);
  const stationRegion = JSON.parse(stationRegionText);
  validateDatasets(daily, summary, metadata);
  if (stationRegion.type !== 'FeatureCollection' || stationRegion.features?.length !== 4) {
    throw new Error('Regional station map does not contain the expected four county boundaries.');
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
