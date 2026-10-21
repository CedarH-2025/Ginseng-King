import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { recomputeSensitivity } from '../src/analysis.js';
import { parseCsv } from '../src/data.js';

const cleanedDirectory = new URL('../../data/NOAA/cleaned/', import.meta.url);

function numberOrNull(value) {
  return value === '' ? null : Number(value);
}

function booleanOrNull(value) {
  return value === '' ? null : value === 'true';
}

test('canonical files load and default sensitivity reproduces every baseline daily label', async () => {
  const [dailyText, summaryText, metadataText] = await Promise.all([
    readFile(new URL('daily_weather.csv', cleanedDirectory), 'utf8'),
    readFile(new URL('seasonal_summary.csv', cleanedDirectory), 'utf8'),
    readFile(new URL('processing_metadata.json', cleanedDirectory), 'utf8'),
  ]);

  const metadata = JSON.parse(metadataText);
  const sourceRows = parseCsv(dailyText);
  const summaryRows = parseCsv(summaryText);
  assert.equal(sourceRows.length, metadata.rows);
  assert.equal(summaryRows.length, 220);
  assert.equal(Object.keys(metadata.stations).length, 5);

  const grouped = new Map();
  for (const row of sourceRows) {
    if (!grouped.has(row.station_id)) grouped.set(row.station_id, []);
    grouped.get(row.station_id).push({
      date: row.date,
      tmax_c: numberOrNull(row.tmax_c),
      tmin_c: numberOrNull(row.tmin_c),
      prcp_mm: numberOrNull(row.prcp_mm),
      is_growing_season: booleanOrNull(row.is_growing_season),
      baseline: {
        hot: booleanOrNull(row.is_hot_day),
        freeze: booleanOrNull(row.is_freezing_day),
        wet: booleanOrNull(row.is_wet_day),
        heavy: booleanOrNull(row.is_heavy_precip_day),
        prolonged: booleanOrNull(row.is_prolonged_wet_day),
      },
    });
  }

  for (const stationRows of grouped.values()) {
    const recomputed = recomputeSensitivity(stationRows, {
      hotC: metadata.thresholds.hot_tmax_at_least_c,
      wetMm: metadata.thresholds.wet_prcp_at_least_mm,
      heavyMm: metadata.thresholds.heavy_prcp_at_least_mm,
      prolongedDays: metadata.thresholds.prolonged_wet_minimum_days,
      startMonth: 4,
      endMonth: 10,
    });

    for (let index = 0; index < recomputed.length; index += 1) {
      const actual = recomputed[index];
      const expected = stationRows[index];
      assert.deepEqual(actual.sensitivity, expected.baseline, `label mismatch on ${actual.date}`);
      assert.equal(
        actual.inSensitivitySeason,
        expected.is_growing_season,
        `season mismatch on ${actual.date}`,
      );
    }
  }
});
