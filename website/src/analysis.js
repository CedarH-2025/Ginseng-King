export const METRICS = {
  hot: {
    label: 'Hot days',
    shortLabel: 'Hot days',
    field: 'is_hot_day_true_days',
    unknownField: 'is_hot_day_unknown_days',
    unit: 'days',
    color: '#d95f59',
    description: 'Days with usable TMAX at or above 30°C in the baseline data.',
  },
  freezing: {
    label: 'Freezing days',
    shortLabel: 'Freezing days',
    field: 'is_freezing_day_true_days',
    unknownField: 'is_freezing_day_unknown_days',
    unit: 'days',
    color: '#3977a8',
    description: 'Days with usable TMIN below 0°C.',
  },
  wet: {
    label: 'Wet days',
    shortLabel: 'Wet days',
    field: 'is_wet_day_true_days',
    unknownField: 'is_wet_day_unknown_days',
    unit: 'days',
    color: '#148a85',
    description: 'Days with usable precipitation at or above 1 mm in the baseline data.',
  },
  heavy: {
    label: 'Heavy precipitation days',
    shortLabel: 'Heavy precip. days',
    field: 'is_heavy_precip_day_true_days',
    unknownField: 'is_heavy_precip_day_unknown_days',
    unit: 'days',
    color: '#6a63a8',
    description: 'Days with usable precipitation at or above 20 mm in the baseline data.',
  },
  prolonged: {
    label: 'Prolonged-wet days',
    shortLabel: 'Prolonged-wet days',
    field: 'is_prolonged_wet_day_true_days',
    unknownField: 'is_prolonged_wet_day_unknown_days',
    unit: 'days',
    color: '#2f6d58',
    description: 'Days belonging to confirmed baseline runs of at least three consecutive wet days.',
  },
  coverage: {
    label: 'Mean variable coverage',
    shortLabel: 'Mean coverage',
    field: null,
    unknownField: null,
    unit: '%',
    color: '#c18b2f',
    description: 'Arithmetic mean of TMAX, TMIN, and PRCP usable-day coverage.',
  },
};

export const EVENT_DEFINITIONS = [
  { key: 'hot', label: 'Hot', color: '#d95f59', baselineField: 'is_hot_day' },
  { key: 'freeze', label: 'Freeze', color: '#3977a8', baselineField: 'is_freezing_day' },
  { key: 'wet', label: 'Wet', color: '#148a85', baselineField: 'is_wet_day' },
  { key: 'heavy', label: 'Heavy precipitation', color: '#6a63a8', baselineField: 'is_heavy_precip_day' },
  { key: 'prolonged', label: 'Prolonged wet', color: '#2f6d58', baselineField: 'is_prolonged_wet_day' },
];

export function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) / finite.length : null;
}

export function metricValue(row, metricKey) {
  if (metricKey === 'coverage') {
    return mean([row.tmax_coverage_pct, row.tmin_coverage_pct, row.prcp_coverage_pct]);
  }
  return row[METRICS[metricKey].field];
}

export function metricUnknown(row, metricKey) {
  if (metricKey === 'coverage') {
    return (
      row.expected_days * 3 -
      row.tmax_usable_days -
      row.tmin_usable_days -
      row.prcp_usable_days
    );
  }
  return row[METRICS[metricKey].unknownField];
}

export function filterSummary(rows, { stations, startYear, endYear, period }) {
  const selected = new Set(stations);
  return rows.filter(
    (row) =>
      selected.has(row.station_id) &&
      row.year >= startYear &&
      row.year <= endYear &&
      row.period === period,
  );
}

export function classifyProlongedWet(wetFlags, minimumDays) {
  if (!Number.isInteger(minimumDays) || minimumDays < 2) {
    throw new RangeError('Prolonged-wet duration must be an integer of at least two days.');
  }

  const result = wetFlags.map((value) => (value === false ? false : null));
  let index = 0;
  while (index < wetFlags.length) {
    if (wetFlags[index] !== true) {
      index += 1;
      continue;
    }

    let end = index;
    while (end < wetFlags.length && wetFlags[end] === true) end += 1;

    let label = false;
    if (end - index >= minimumDays) {
      label = true;
    } else if (
      index === 0 ||
      wetFlags[index - 1] === null ||
      end === wetFlags.length ||
      wetFlags[end] === null
    ) {
      label = null;
    }

    for (let runIndex = index; runIndex < end; runIndex += 1) result[runIndex] = label;
    index = end;
  }

  return result;
}

export function isMonthInSeason(month, startMonth, endMonth) {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth;
  return month >= startMonth || month <= endMonth;
}

function classify(value, threshold, comparison = 'at-least') {
  if (value === null) return null;
  return comparison === 'below' ? value < threshold : value >= threshold;
}

export function recomputeSensitivity(stationRows, thresholds) {
  const { hotC, wetMm, heavyMm, prolongedDays, startMonth, endMonth } = thresholds;
  const numeric = [hotC, wetMm, heavyMm, startMonth, endMonth];
  if (numeric.some((value) => !Number.isFinite(value))) {
    throw new RangeError('Sensitivity thresholds must be finite numbers.');
  }
  if (wetMm <= 0 || heavyMm < wetMm) {
    throw new RangeError('Wet threshold must be above zero and heavy precipitation cannot be below it.');
  }

  const rows = [...stationRows].sort((first, second) => first.date.localeCompare(second.date));
  const wetFlags = rows.map((row) => classify(row.prcp_mm, wetMm));
  const prolongedFlags = classifyProlongedWet(wetFlags, prolongedDays);

  return rows.map((row, index) => {
    const month = Number(row.date.slice(5, 7));
    return {
      ...row,
      inSensitivitySeason: isMonthInSeason(month, startMonth, endMonth),
      sensitivity: {
        hot: classify(row.tmax_c, hotC),
        freeze: classify(row.tmin_c, 0, 'below'),
        wet: wetFlags[index],
        heavy: classify(row.prcp_mm, heavyMm),
        prolonged: prolongedFlags[index],
      },
    };
  });
}

export function nullableCounts(rows, accessor) {
  const counts = { true: 0, false: 0, unknown: 0 };
  for (const row of rows) {
    const value = accessor(row);
    if (value === true) counts.true += 1;
    else if (value === false) counts.false += 1;
    else counts.unknown += 1;
  }
  return counts;
}

export function longestObservedWetRun(rows) {
  let current = [];
  let longest = [];
  let unknownDays = 0;

  for (const row of rows) {
    if (row.sensitivity.wet === true) {
      current.push(row);
      if (current.length > longest.length) longest = [...current];
    } else {
      if (row.sensitivity.wet === null) unknownDays += 1;
      current = [];
    }
  }

  return {
    days: longest.length,
    start: longest[0]?.date ?? null,
    end: longest.at(-1)?.date ?? null,
    exact: unknownDays === 0,
    unknownDays,
  };
}

export function lastObservedSpringFreeze(yearRows) {
  const springRows = yearRows.filter((row) => Number(row.date.slice(5, 7)) <= 6);
  const freezeRows = springRows.filter((row) => row.sensitivity.freeze === true);
  const last = freezeRows.at(-1) ?? null;
  const unknownAfter = springRows.filter(
    (row) => row.sensitivity.freeze === null && (!last || row.date > last.date),
  ).length;

  return {
    date: last?.date ?? null,
    exact: unknownAfter === 0,
    unknownAfter,
  };
}

export function summarizeSensitivity(rows) {
  const events = Object.fromEntries(
    EVENT_DEFINITIONS.map((event) => [
      event.key,
      nullableCounts(rows, (row) => row.sensitivity[event.key]),
    ]),
  );

  return {
    expectedDays: rows.length,
    events,
    tmaxMissing: rows.filter((row) => row.tmax_c === null).length,
    tminMissing: rows.filter((row) => row.tmin_c === null).length,
    prcpMissing: rows.filter((row) => row.prcp_mm === null).length,
    longestWet: longestObservedWetRun(rows),
  };
}

export function summarizeBaseline(rows) {
  return Object.fromEntries(
    EVENT_DEFINITIONS.map((event) => [
      event.key,
      nullableCounts(rows, (row) => row[event.baselineField]),
    ]),
  );
}

function quoteCsvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows, columns) {
  const header = columns.map((column) => quoteCsvCell(column.label)).join(',');
  const body = rows.map((row) =>
    columns.map((column) => quoteCsvCell(column.value(row))).join(','),
  );
  return [header, ...body].join('\r\n');
}
