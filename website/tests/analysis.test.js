import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyProlongedWet,
  lastObservedSpringFreeze,
  longestObservedWetRun,
  recomputeSensitivity,
  rowsToCsv,
} from '../src/analysis.js';
import { parseCsv } from '../src/data.js';

test('prolonged wet classification preserves uncertainty at missing boundaries', () => {
  assert.deepEqual(
    classifyProlongedWet([false, true, true, false], 3),
    [false, false, false, false],
  );
  assert.deepEqual(
    classifyProlongedWet([null, true, true, false], 3),
    [null, null, null, false],
  );
  assert.deepEqual(
    classifyProlongedWet([null, true, true, true, false], 3),
    [null, true, true, true, false],
  );
});

test('a missing precipitation day is unknown and breaks a wet run', () => {
  const source = [
    { date: '2025-04-01', tmax_c: 31, tmin_c: 2, prcp_mm: 2 },
    { date: '2025-04-02', tmax_c: null, tmin_c: -1, prcp_mm: 3 },
    { date: '2025-04-03', tmax_c: 20, tmin_c: 4, prcp_mm: null },
    { date: '2025-04-04', tmax_c: 29, tmin_c: 5, prcp_mm: 4 },
    { date: '2025-04-05', tmax_c: 22, tmin_c: 6, prcp_mm: 5 },
  ];
  const result = recomputeSensitivity(source, {
    hotC: 30,
    wetMm: 1,
    heavyMm: 20,
    prolongedDays: 3,
    startMonth: 4,
    endMonth: 10,
  });

  assert.equal(result[1].sensitivity.hot, null);
  assert.equal(result[2].sensitivity.wet, null);
  assert.equal(result[2].sensitivity.heavy, null);
  assert.equal(result[0].sensitivity.prolonged, null);
  assert.equal(result[3].sensitivity.prolonged, null);

  const longest = longestObservedWetRun(result);
  assert.equal(longest.days, 2);
  assert.equal(longest.exact, false);
  assert.equal(longest.unknownDays, 1);
});

test('last spring freeze reports uncertainty only for later missing TMIN values', () => {
  const rows = [
    { date: '2025-03-01', sensitivity: { freeze: null } },
    { date: '2025-04-02', sensitivity: { freeze: true } },
    { date: '2025-05-03', sensitivity: { freeze: null } },
    { date: '2025-07-01', sensitivity: { freeze: null } },
  ];
  assert.deepEqual(lastObservedSpringFreeze(rows), {
    date: '2025-04-02',
    exact: false,
    unknownAfter: 1,
  });
});

test('CSV parser and exporter preserve blank and quoted cells', () => {
  const parsed = parseCsv('name,value,note\r\nalpha,,"rain, trace"\r\n');
  assert.deepEqual(parsed, [{ name: 'alpha', value: '', note: 'rain, trace' }]);

  const exported = rowsToCsv(parsed, [
    { label: 'name', value: (row) => row.name },
    { label: 'note', value: (row) => row.note },
  ]);
  assert.equal(exported, 'name,note\r\nalpha,"rain, trace"');
});
