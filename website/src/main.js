import './style.css';
import { loadDatasets } from './data.js';
import {
  EVENT_DEFINITIONS,
  METRICS,
  filterSummary,
  lastObservedSpringFreeze,
  mean,
  metricUnknown,
  metricValue,
  recomputeSensitivity,
  rowsToCsv,
  summarizeBaseline,
  summarizeSensitivity,
} from './analysis.js';
import {
  CHART_GRID,
  CHART_MUTED,
  STATION_COLORS,
  baseChartOption,
  exportChart,
  registerMap,
  renderChart,
  renderEmptyChart,
  resizeCharts,
} from './charts.js';

const app = document.querySelector('#app');

const ROUTES = {
  overview: { label: 'Overview', eyebrow: 'Project snapshot', number: '01' },
  explore: { label: 'Explore data', eyebrow: 'Station × year evidence', number: '02' },
  daily: { label: 'Daily detail', eyebrow: 'Sensitivity workspace', number: '03' },
  methods: { label: 'Quality & methods', eyebrow: 'Provenance and limits', number: '04' },
  about: { label: 'About us', eyebrow: 'Team and responsibilities', number: '05' },
};

const STATION_ROLES = {
  USW00014897: 'Central and local reference',
  USC00475364: 'Northern reference',
  USC00475120: 'Southwestern reference',
  USC00478171: 'Southern reference',
  USW00094985: 'Additional southwestern reference',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_LABELS = {
  missing_value: 'Missing source value',
  quality_flag_excluded: 'Quality-flag excluded',
  accumulated_or_presumed_zero: 'Accumulated / presumed zero excluded',
};

const TEAM_MEMBERS = [
  {
    name: 'Heming Bai',
    initials: 'HB',
    email: 'hemingb2@illinois.edu',
    focus: 'Coordination, pipeline & integration',
    responsibilities: [
      'Project coordination and Daymet data acquisition',
      'Data-processing pipeline and exposure-indicator implementation',
      'Final report and presentation integration',
      'Visualization or dashboard development',
    ],
  },
  {
    name: 'Cedar Huang',
    initials: 'CH',
    email: 'mengyun4@illinois.edu',
    focus: 'NOAA data quality & validation',
    responsibilities: [
      'NOAA station identification and data-quality analysis',
      'NOAA–Daymet comparison',
      'Validation documentation',
      'Analysis-workflow testing',
    ],
  },
  {
    name: 'Haiyue Liu',
    initials: 'HL',
    email: 'haiyuel3@illinois.edu',
    focus: 'Literature, assumptions & interpretation',
    responsibilities: [
      'Literature review',
      'Agricultural assumptions and analytical-threshold definitions',
      'Interpretation of results and limitations',
      'Presentation-material preparation',
    ],
  },
];

const VERTICAL_AXIS_NAME = {
  nameLocation: 'middle',
  nameGap: 47,
  nameTextStyle: { color: CHART_MUTED, fontSize: 11 },
};

let datasets;
let state;
let activeDailyRows = [];
let activeExploreRows = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value, maximumFractionDigits = 1) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}

function formatDate(date) {
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function stationName(id) {
  return datasets.metadata.stations[id] ?? id;
}

function stationColor(id) {
  const index = datasets.stations.findIndex((station) => station.id === id);
  return STATION_COLORS[Math.max(0, index) % STATION_COLORS.length];
}

function downloadText(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function monthOptions(selected) {
  return MONTHS.map(
    (month, index) =>
      `<option value="${index + 1}" ${index + 1 === selected ? 'selected' : ''}>${month}</option>`,
  ).join('');
}

function yearOptions(selected) {
  return Array.from({ length: 22 }, (_, index) => 2004 + index)
    .map((year) => `<option value="${year}" ${year === selected ? 'selected' : ''}>${year}</option>`)
    .join('');
}

function stationOptions(selected) {
  return datasets.stations
    .map(
      (station) =>
        `<option value="${station.id}" ${station.id === selected ? 'selected' : ''}>` +
        `${escapeHtml(station.name)} · ${station.id}</option>`,
    )
    .join('');
}

function metricOptions(selected) {
  return Object.entries(METRICS)
    .map(
      ([key, metric]) =>
        `<option value="${key}" ${key === selected ? 'selected' : ''}>${metric.label}</option>`,
    )
    .join('');
}

function navMarkup() {
  return Object.entries(ROUTES)
    .map(
      ([route, details]) => `
        <a class="nav-link" href="#${route}" data-route="${route}">
          <span class="nav-number">${details.number}</span>
          <span>${details.label}</span>
        </a>`,
    )
    .join('');
}

function stationCheckboxes() {
  return datasets.stations
    .map(
      (station, index) => `
        <label class="check-row">
          <input type="checkbox" name="explore-station" value="${station.id}"
            ${state.explore.stations.includes(station.id) ? 'checked' : ''}>
          <span class="station-swatch" style="--swatch:${STATION_COLORS[index]}"></span>
          <span><strong>${escapeHtml(station.name)}</strong><small>${station.id}</small></span>
        </label>`,
    )
    .join('');
}

function stationTableRows() {
  return datasets.stations
    .map(
      (station) => `
        <tr>
          <td><strong>${escapeHtml(station.name)}</strong><span class="cell-sub">${station.id}</span></td>
          <td>${station.latitude.toFixed(4)}</td>
          <td>${station.longitude.toFixed(4)}</td>
          <td>${STATION_ROLES[station.id]}</td>
        </tr>`,
    )
    .join('');
}

function buildLayout() {
  const thresholds = datasets.metadata.thresholds;
  const manifest = datasets.websiteManifest;

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Dashboard navigation">
        <a class="brand" href="#overview" aria-label="Ginseng King overview">
          <span class="brand-mark" aria-hidden="true"><span></span></span>
          <span><strong>Ginseng King</strong><small>Weather evidence lab</small></span>
        </a>
        <nav class="side-nav">${navMarkup()}</nav>
        <div class="sidebar-source">
          <span class="status-dot"></span>
          <p><strong>Static data ready</strong><br>NOAA GHCN-Daily<br>2004–2025</p>
        </div>
      </aside>

      <main id="main-content" class="main-content">
        <header class="mobile-header">
          <a class="mobile-brand" href="#overview">Ginseng King</a>
          <nav aria-label="Mobile dashboard navigation">${navMarkup()}</nav>
        </header>

        <section class="page" id="page-overview" data-page="overview">
          <div class="hero">
            <div class="hero-heading">
              <p class="eyebrow">CS 598 · Digital Agriculture</p>
              <h1>Historical Weather Analysis for Wisconsin American Ginseng</h1>
            </div>
            <div class="hero-copy">
              <p class="hero-lede">
                An interactive view of station-level heat, freezing, and precipitation observations—built
                to support a midterm report without turning weather associations into crop-health claims.
              </p>
              <div class="hero-tags">
                <span>NOAA GHCN-Daily</span><span>Five stations</span><span>22 calendar years</span>
              </div>
            </div>
            <aside class="interpretation-note">
              <span class="note-kicker">Interpretation boundary</span>
              <p>These are outdoor station measurements. They describe weather exposure, not disease,
                yield, root quality, or conditions beneath ginseng shade structures.</p>
            </aside>
          </div>

          <div class="metric-grid" aria-label="Dataset summary">
            <article class="metric-card"><span>Study window</span><strong>2004–2025</strong><small>22 complete calendar years</small></article>
            <article class="metric-card"><span>Weather stations</span><strong>${datasets.stations.length}</strong><small>Central Wisconsin references</small></article>
            <article class="metric-card"><span>Daily records</span><strong>${datasets.daily.length.toLocaleString()}</strong><small>Station-day rows retained</small></article>
            <article class="metric-card"><span>Summary records</span><strong>${datasets.summary.length.toLocaleString()}</strong><small>Station × year × period</small></article>
          </div>

          <section class="content-section">
            <div class="section-heading">
              <div><p class="eyebrow">Preliminary results</p><h2>Three views into weather variability</h2></div>
              <p>Baseline labels use the repository’s documented thresholds. Hover for station-year detail
                or use Explore Data to change the evidence slice.</p>
            </div>
            <div class="overview-chart-grid">
              <article class="chart-card chart-card-wide">
                <div id="overview-hot-chart" class="chart chart-medium" role="img" aria-label="Growing-season hot days by year"></div>
                <p id="overview-hot-finding" class="finding"></p>
              </article>
              <article class="chart-card">
                <div id="overview-wet-chart" class="chart chart-medium" role="img" aria-label="Mean growing-season wet days by station"></div>
                <p id="overview-wet-finding" class="finding"></p>
              </article>
              <article class="chart-card">
                <div id="overview-coverage-chart" class="chart chart-medium" role="img" aria-label="Minimum growing-season coverage by year"></div>
                <p id="overview-coverage-finding" class="finding"></p>
              </article>
            </div>
          </section>

          <section class="content-section station-section">
            <div class="section-heading">
              <div><p class="eyebrow">Observation network</p><h2>Five retained NOAA stations</h2></div>
              <p>Hover a station for its name, coordinates, and geographic role. Scroll to zoom and drag
                to pan within the four-county Central Wisconsin region.</p>
            </div>
            <article class="chart-card station-map-card">
              <div id="station-map-chart" class="chart station-map" role="img"
                aria-label="Interactive regional map of five retained NOAA stations"></div>
              <div class="map-caption">
                <p><strong>Regional context only.</strong> County boundaries: U.S. Census Bureau via
                  us-atlas. The two Marshfield stations are about 4.3 km apart and are not independent
                  spatial samples.</p>
                <span>Lincoln · Marathon · Wood · Portage counties</span>
              </div>
            </article>
            <details class="station-table-details">
              <summary>View accessible station table</summary>
              <div class="table-shell">
                <table>
                  <thead><tr><th>Station</th><th>Latitude</th><th>Longitude</th><th>Geographic role</th></tr></thead>
                  <tbody>${stationTableRows()}</tbody>
                </table>
              </div>
            </details>
          </section>
        </section>

        <section class="page" id="page-explore" data-page="explore" hidden>
          <div class="page-heading">
            <div><p class="eyebrow">Station × year evidence</p><h1>Explore Baseline Summaries</h1></div>
            <p>Compare observed event counts and usable-data coverage. Empty labels remain unknown and are
              reported separately—not silently counted as no-event days.</p>
          </div>

          <div class="explorer-layout">
            <aside class="filter-card" aria-label="Explore data filters">
              <div class="filter-title"><span>Filters</span><button id="explore-reset" class="text-button" type="button">Reset</button></div>
              <fieldset>
                <legend>Station</legend>
                <div class="inline-actions">
                  <button id="select-all-stations" class="mini-button" type="button">Select all</button>
                  <button id="clear-stations" class="mini-button" type="button">Clear</button>
                </div>
                <div class="station-checks">${stationCheckboxes()}</div>
              </fieldset>
              <fieldset>
                <legend>Year range</legend>
                <div class="paired-inputs">
                  <label>From<select id="explore-start-year">${yearOptions(state.explore.startYear)}</select></label>
                  <label>To<select id="explore-end-year">${yearOptions(state.explore.endYear)}</select></label>
                </div>
              </fieldset>
              <label class="field-label">Period
                <select id="explore-period">
                  <option value="Annual">Annual</option>
                  <option value="Apr-Oct" selected>April–October</option>
                </select>
              </label>
              <label class="field-label">Metric
                <select id="explore-metric">${metricOptions(state.explore.metric)}</select>
              </label>
              <div id="metric-definition" class="definition-box"></div>
            </aside>

            <div class="explorer-results">
              <div class="result-toolbar">
                <p id="explore-result-count" aria-live="polite"></p>
                <div>
                  <button class="button button-secondary" type="button" data-chart-export="explore-trend-chart">Trend PNG</button>
                  <button class="button button-secondary" type="button" data-chart-export="explore-heatmap-chart">Heatmap PNG</button>
                  <button id="export-explore-csv" class="button" type="button">Filtered CSV</button>
                </div>
              </div>
              <article class="chart-card">
                <div id="explore-trend-chart" class="chart chart-large" role="img" aria-label="Selected metric trend by station and year"></div>
              </article>
              <article class="chart-card">
                <div id="explore-heatmap-chart" class="chart chart-large" role="img" aria-label="Selected metric station by year heatmap"></div>
              </article>
              <article class="table-card">
                <div class="card-heading"><div><p class="eyebrow">Current selection</p><h2>Station summary</h2></div>
                  <p id="explore-table-note"></p></div>
                <div class="table-shell"><table>
                  <thead><tr><th>Station</th><th>Years</th><th>Mean</th><th>Minimum</th><th>Maximum</th><th>Unknown</th></tr></thead>
                  <tbody id="explore-summary-body"></tbody>
                </table></div>
              </article>
            </div>
          </div>
        </section>

        <section class="page" id="page-daily" data-page="daily" hidden>
          <div class="page-heading">
            <div><p class="eyebrow">Exploratory sensitivity analysis</p><h1>Daily Detail & Sensitivity</h1></div>
            <p>Controls below recalculate labels in this browser only. They do not alter or masquerade as
              the repository’s official baseline outputs.</p>
          </div>

          <section class="sensitivity-panel">
            <div class="control-row primary-controls">
              <label>Station<select id="daily-station">${stationOptions(state.daily.station)}</select></label>
              <label>Year<select id="daily-year">${yearOptions(state.daily.year)}</select></label>
              <button id="reset-thresholds" class="button button-secondary" type="button">Restore baseline</button>
            </div>
            <div class="threshold-grid">
              <label>Hot threshold <span>°C, at or above</span>
                <input id="threshold-hot" type="number" min="-20" max="50" step="0.5" value="${thresholds.hot_tmax_at_least_c}">
              </label>
              <label>Wet-day threshold <span>mm, at or above</span>
                <input id="threshold-wet" type="number" min="0.1" max="100" step="0.1" value="${thresholds.wet_prcp_at_least_mm}">
              </label>
              <label>Heavy precipitation <span>mm, at or above</span>
                <input id="threshold-heavy" type="number" min="0.1" max="200" step="0.5" value="${thresholds.heavy_prcp_at_least_mm}">
              </label>
              <label>Prolonged wet duration <span>consecutive days</span>
                <input id="threshold-duration" type="number" min="2" max="30" step="1" value="${thresholds.prolonged_wet_minimum_days}">
              </label>
              <label>Season starts
                <select id="threshold-start-month">${monthOptions(4)}</select>
              </label>
              <label>Season ends
                <select id="threshold-end-month">${monthOptions(10)}</select>
              </label>
            </div>
            <div class="panel-foot">
              <p id="sensitivity-definition">Freeze remains fixed at TMIN &lt; 0°C. Wet runs are computed on the
                station’s continuous 2004–2025 calendar before filtering the selected year and season.</p>
              <p id="threshold-error" class="form-error" role="alert"></p>
            </div>
          </section>

          <div id="daily-summary-cards" class="metric-grid daily-metrics"></div>
          <div id="daily-gap-warning" class="data-warning" hidden></div>

          <div class="daily-chart-grid">
            <article class="chart-card chart-card-wide">
              <div id="daily-temperature-chart" class="chart chart-large" role="img" aria-label="Daily maximum and minimum temperature"></div>
            </article>
            <article class="chart-card chart-card-wide">
              <div id="daily-precipitation-chart" class="chart chart-large" role="img" aria-label="Daily precipitation and missing observations"></div>
            </article>
          </div>

          <section class="table-card comparison-card">
            <div class="card-heading">
              <div><p class="eyebrow">Do not overwrite the baseline</p><h2>Baseline vs current controls</h2></div>
              <p id="comparison-note"></p>
            </div>
            <div class="table-shell"><table>
              <thead><tr><th>Event</th><th>Official baseline true</th><th>Official unknown</th><th>Exploratory true</th><th>Exploratory unknown</th></tr></thead>
              <tbody id="baseline-comparison-body"></tbody>
            </table></div>
          </section>

          <section class="table-card">
            <div class="card-heading">
              <div><p class="eyebrow">Observed dates</p><h2>Event and gap log</h2></div>
              <p id="event-log-note"></p>
            </div>
            <div class="table-shell table-scroll"><table>
              <thead><tr><th>Date</th><th>TMAX</th><th>TMIN</th><th>PRCP</th><th>Labels / data gaps</th></tr></thead>
              <tbody id="daily-event-body"></tbody>
            </table></div>
          </section>
        </section>

        <section class="page" id="page-methods" data-page="methods" hidden>
          <div class="page-heading">
            <div><p class="eyebrow">Data quality, methods & limitations</p><h1>Data Quality, Methods & Limitations</h1></div>
            <p>Coverage, thresholds, provenance, and analytical limits are part of the result—not footnotes
              to be hidden after a chart is exported.</p>
          </div>

          <section class="quality-controls">
            <label>Coverage variable
              <select id="quality-variable">
                <option value="prcp">PRCP</option>
                <option value="tmax">TMAX</option>
                <option value="tmin">TMIN</option>
              </select>
            </label>
            <label>Period
              <select id="quality-period">
                <option value="Apr-Oct">April–October</option>
                <option value="Annual">Annual</option>
              </select>
            </label>
            <button class="button button-secondary" type="button" data-chart-export="quality-heatmap-chart">Coverage PNG</button>
          </section>

          <article class="chart-card">
            <div id="quality-heatmap-chart" class="chart chart-large" role="img" aria-label="Station year coverage heatmap"></div>
          </article>

          <section class="table-card">
            <div class="card-heading">
              <div><p class="eyebrow">Every station-year</p><h2>Usable and unknown days</h2></div>
              <p id="quality-table-note"></p>
            </div>
            <div class="table-shell table-scroll"><table>
              <thead><tr><th>Station</th><th>Year</th><th>Expected days</th><th>Usable days</th><th>Unknown days</th><th>Coverage</th></tr></thead>
              <tbody id="quality-table-body"></tbody>
            </table></div>
          </section>

          <div class="methods-grid">
            <article class="method-card">
              <p class="eyebrow">Baseline definitions</p><h2>Screening thresholds</h2>
              <dl class="threshold-list">
                <div><dt>Freezing day</dt><dd>TMIN &lt; ${thresholds.freezing_tmin_below_c}°C</dd></div>
                <div><dt>Hot day</dt><dd>TMAX ≥ ${thresholds.hot_tmax_at_least_c}°C</dd></div>
                <div><dt>Wet day</dt><dd>PRCP ≥ ${thresholds.wet_prcp_at_least_mm} mm</dd></div>
                <div><dt>Heavy precipitation</dt><dd>PRCP ≥ ${thresholds.heavy_prcp_at_least_mm} mm</dd></div>
                <div><dt>Prolonged wet day</dt><dd>In a run ≥ ${thresholds.prolonged_wet_minimum_days} wet days</dd></div>
              </dl>
              <p class="method-note">The 30°C and three-day choices are adjustable project screening
                definitions, not validated American-ginseng damage thresholds.</p>
            </article>

            <article class="method-card">
              <p class="eyebrow">Processing record</p><h2>Static, traceable inputs</h2>
              <dl class="metadata-list">
                <div><dt>Study period</dt><dd>${datasets.metadata.period}</dd></div>
                <div><dt>Cleaning note date</dt><dd>${escapeHtml(manifest.cleaning_documentation_date ?? 'Not recorded')}</dd></div>
                <div><dt>Raw download date</dt><dd>${escapeHtml(manifest.raw_download_date ?? 'Not recorded')}</dd></div>
                <div><dt>Website copy prepared</dt><dd>${formatDate(manifest.prepared_at.slice(0, 10))}</dd></div>
                <div><dt>Boolean encoding</dt><dd>true / false / empty = unknown</dd></div>
              </dl>
              <p class="method-note">The source processing metadata does not record a separate execution
                timestamp. The documentation date is shown without relabeling it as one.</p>
            </article>
            <article class="method-card method-card-wide">
              <p class="eyebrow">Metadata status counts</p><h2>Cleaning outcome ledger</h2>
              <p class="ledger-intro">Counts cover all ${datasets.metadata.rows.toLocaleString()} station-day rows.
                Exclusion applies per variable, so one excluded value does not discard the other variables on that date.</p>
              <div class="status-ledger">
                ${Object.entries(datasets.metadata.status_counts)
                  .map(
                    ([variable, counts]) => `<div class="status-block">
                      <span>${variable}</span><strong>${counts.usable.toLocaleString()}</strong><small>usable values</small>
                      <dl>${Object.entries(counts)
                        .filter(([status]) => status !== 'usable')
                        .map(
                          ([status, count]) =>
                            `<div><dt>${STATUS_LABELS[status] ?? status.replaceAll('_', ' ')}</dt><dd>${count.toLocaleString()}</dd></div>`,
                        )
                        .join('')}</dl>
                    </div>`,
                  )
                  .join('')}
              </div>
            </article>
          </div>

          <section class="content-section">
            <div class="section-heading">
              <div><p class="eyebrow">Analysis coverage</p><h2>Why screening and final coverage differ</h2></div>
            </div>
            <div class="explanation-grid">
              <article><span>01</span><h3>Station screening</h3><p>The selection stage used a project
                criterion of at least 95% usable April–October observations in 2025 and then audited
                2004–2025. This is not a NOAA quality standard.</p></article>
              <article><span>02</span><h3>Final cleaning</h3><p>Analysis coverage additionally excludes
                quality-flagged values, negative precipitation, accumulated or presumed-zero
                precipitation, and inconsistent TMAX/TMIN pairs.</p></article>
              <article><span>03</span><h3>Unknown stays unknown</h3><p>No interpolation or imputation is
                used. Missing precipitation is never converted to a dry day and always breaks an
                observed wet run.</p></article>
            </div>
          </section>

          <section class="limitations">
            <div><p class="eyebrow">Required interpretation limits</p><h2>Interpretation Limits</h2></div>
            <ul>
              <li>Stations measure outdoor air temperature and precipitation—not temperature under shade
                structures, soil moisture, leaf wetness, root-zone conditions, or plant health.</li>
              <li>These data cannot establish causality for disease, yield, or root quality.</li>
              <li>The two Marshfield stations are approximately 4.3 km apart and cannot be treated as
                independent spatial samples.</li>
              <li>PRCP is liquid-equivalent precipitation; it is not a direct measurement of liquid rain
                or field water availability.</li>
              <li>A short wet run next to a missing day can remain unknown. Confirmed runs are never
                bridged across a missing observation.</li>
            </ul>
          </section>

          <section class="content-section">
            <div class="section-heading">
              <div><p class="eyebrow">Provenance</p><h2>Canonical cleaned files</h2></div>
              <p>Build-time copies retain the source bytes and SHA-256 checksums.</p>
            </div>
            <div class="file-grid">
              ${manifest.files
                .map(
                  (file) => `<article class="file-card"><span>${file.name.endsWith('.csv') ? 'CSV' : 'JSON'}</span>
                    <h3>${file.name}</h3><p>${file.rows ? `${file.rows.toLocaleString()} data rows` : 'Thresholds, stations, and checksums'}</p>
                    <code title="${file.sha256}">${file.sha256.slice(0, 16)}…</code></article>`,
                )
                .join('')}
            </div>
          </section>

          <section class="coming-next">
            <div><span class="status-pill">Coming next</span><h2>NOAA vs Daymet</h2>
              <p>A future comparison area is reserved for gridded Daymet weather data. No Daymet
                acquisition, analysis, result, or completion status is implied in this MVP.</p></div>
            <span class="coming-mark" aria-hidden="true">D</span>
          </section>
        </section>

        <section class="page" id="page-about" data-page="about" hidden>
          <div class="page-heading">
            <div><p class="eyebrow">Team and responsibilities</p><h1>Meet the Ginseng King Team</h1></div>
            <p>Responsibilities below are transcribed from the submitted CS 598 project proposal.
              Every member owns a primary area and also reviews the final results.</p>
          </div>

          <div class="team-grid">
            ${TEAM_MEMBERS.map(
              (member) => `<article class="team-card">
                <div class="member-heading">
                  <span class="member-initials" aria-hidden="true">${member.initials}</span>
                  <div><p class="eyebrow">${member.focus}</p><h2>${member.name}</h2></div>
                </div>
                <h3>Primary responsibilities</h3>
                <ul>${member.responsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>
                <div class="contact-row">
                  <span>Contact</span>
                  <a href="mailto:${member.email}">${member.email}</a>
                </div>
              </article>`,
            ).join('')}
          </div>

          <section class="collaboration-card">
            <div>
              <p class="eyebrow">Remote collaboration plan</p>
              <h2>Shared work, weekly coordination</h2>
            </div>
            <div class="collaboration-points">
              <article><span>01</span><h3>Shared repository</h3><p>Code and documents are maintained in a shared Git repository.</p></article>
              <article><span>02</span><h3>Weekly meeting</h3><p>The team plans one online meeting each week and tracks work, deadlines, and progress.</p></article>
              <article><span>03</span><h3>Meaningful remote work</h3><p>Remote members contribute to collection, cleaning, analysis, visualization, and writing.</p></article>
            </div>
          </section>

          <p class="proposal-source">Source: <strong>Ginseng King Project Proposal — Historical Weather
            Analysis for Wisconsin American Ginseng</strong>, “Team Responsibilities” and “Remote
            Collaboration.”</p>
        </section>

        <footer class="site-footer">
          <span>Ginseng King · CS 598 Digital Agriculture</span>
          <span>Static NOAA evidence dashboard · No backend</span>
        </footer>
      </main>
    </div>`;
}

function initializeState() {
  const thresholds = datasets.metadata.thresholds;
  state = {
    route: 'overview',
    explore: {
      stations: datasets.stations.slice(0, 3).map((station) => station.id),
      startYear: 2004,
      endYear: 2025,
      period: 'Apr-Oct',
      metric: 'hot',
    },
    daily: {
      station: datasets.stations[0].id,
      year: 2025,
      thresholds: {
        hotC: thresholds.hot_tmax_at_least_c,
        wetMm: thresholds.wet_prcp_at_least_mm,
        heavyMm: thresholds.heavy_prcp_at_least_mm,
        prolongedDays: thresholds.prolonged_wet_minimum_days,
        startMonth: 4,
        endMonth: 10,
      },
    },
    quality: {
      variable: 'prcp',
      period: 'Apr-Oct',
    },
  };
}

function renderStationMap() {
  const mapName = 'central-wisconsin-station-region';
  registerMap(mapName, datasets.stationRegion);

  const pointLayout = {
    USC00475364: { label: 'top', offset: [0, -2] },
    USW00014897: { label: 'right', offset: [0, 0] },
    USC00475120: { label: 'left', offset: [-8, -7] },
    USW00094985: { label: 'right', offset: [8, 7] },
    USC00478171: { label: 'right', offset: [0, 0] },
  };

  renderChart('station-map-chart', {
    ...baseChartOption({
      title: 'Central Wisconsin station network',
      subtitle: 'Four-county extent centered on the retained NOAA stations · hover points for details',
      filename: 'ginseng-king-station-map',
    }),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params) => {
        const station = params.data;
        if (!station?.stationId) return `<strong>${params.name} County</strong>`;
        return `<strong>${station.name}</strong><br>${station.stationId}<br>` +
          `Latitude: ${station.latitude.toFixed(4)}<br>Longitude: ${station.longitude.toFixed(4)}<br>` +
          `Geographic role: ${station.role}`;
      },
    },
    geo: {
      map: mapName,
      roam: true,
      scaleLimit: { min: 0.9, max: 8 },
      layoutCenter: ['50%', '57%'],
      layoutSize: '88%',
      itemStyle: {
        areaColor: '#e6eee6',
        borderColor: '#9aafa4',
        borderWidth: 1.2,
      },
      emphasis: {
        itemStyle: { areaColor: '#d5e4d6' },
        label: { color: '#173f35', fontWeight: 700 },
      },
      select: { disabled: true },
      label: {
        show: true,
        color: '#70827b',
        fontSize: 10,
        formatter: ({ name }) => `${name} Co.`,
      },
    },
    graphic: [
      {
        type: 'text',
        right: 24,
        bottom: 19,
        style: {
          text: 'N ↑',
          fill: '#506a62',
          font: '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      },
    ],
    series: datasets.stations.map((station) => ({
      name: station.name,
      type: 'scatter',
      coordinateSystem: 'geo',
      symbol: 'circle',
      symbolSize: 15,
      symbolOffset: pointLayout[station.id].offset,
      data: [
        {
          name: station.name,
          value: [station.longitude, station.latitude],
          stationId: station.id,
          latitude: station.latitude,
          longitude: station.longitude,
          role: STATION_ROLES[station.id],
        },
      ],
      label: {
        show: true,
        position: pointLayout[station.id].label,
        distance: 7,
        formatter: station.name,
        color: '#203630',
        fontSize: 9,
        fontWeight: 650,
        textBorderColor: '#ffffff',
        textBorderWidth: 3,
      },
      itemStyle: {
        color: stationColor(station.id),
        borderColor: '#ffffff',
        borderWidth: 2,
        shadowBlur: 5,
        shadowColor: 'rgba(23,63,53,.25)',
      },
      emphasis: {
        scale: 1.45,
        label: { fontSize: 11, fontWeight: 750 },
      },
      z: 5,
    })),
  });
}

function renderOverview() {
  renderStationMap();
  const growing = datasets.summary.filter((row) => row.period === 'Apr-Oct');
  const years = Array.from({ length: 22 }, (_, index) => 2004 + index);

  const hotByYear = years.map((year) => {
    const values = growing
      .filter((row) => row.year === year)
      .map((row) => row.is_hot_day_true_days);
    return {
      year,
      average: mean(values),
      minimum: Math.min(...values),
      maximum: Math.max(...values),
    };
  });

  renderChart('overview-hot-chart', {
    ...baseChartOption({
      title: 'Growing-season hot days',
      subtitle: 'Five-station mean and observed station range · baseline TMAX ≥ 30°C',
      filename: 'ginseng-king-overview-hot-days',
      grid: { top: 96 },
    }),
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const entry = hotByYear[items[0]?.dataIndex];
        return `<strong>${entry.year}</strong><br>Five-station mean: ${formatNumber(entry.average)} days<br>` +
          `Observed station range: ${entry.minimum}–${entry.maximum} days`;
      },
    },
    legend: { top: 64, left: 12, data: ['Five-station mean', 'Station range'] },
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      axisLabel: { interval: 2, color: CHART_MUTED },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'value',
      name: 'days',
      ...VERTICAL_AXIS_NAME,
      minInterval: 1,
      axisLabel: { color: CHART_MUTED },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    series: [
      {
        name: 'Range floor',
        type: 'line',
        stack: 'range',
        data: hotByYear.map((entry) => entry.minimum),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: 'Station range',
        type: 'line',
        stack: 'range',
        data: hotByYear.map((entry) => entry.maximum - entry.minimum),
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: '#d95f59', opacity: 0.16 },
      },
      {
        name: 'Five-station mean',
        type: 'line',
        data: hotByYear.map((entry) => Number(entry.average.toFixed(1))),
        smooth: 0.18,
        symbolSize: 5,
        lineStyle: { width: 3, color: '#b64e4a' },
        itemStyle: { color: '#b64e4a' },
      },
    ],
  });

  const wetByStation = datasets.stations.map((station) => {
    const rows = growing.filter((row) => row.station_id === station.id);
    return {
      station,
      value: mean(rows.map((row) => row.is_wet_day_true_days)),
    };
  });

  renderChart('overview-wet-chart', {
    ...baseChartOption({
      title: 'Typical wet-day count differs by station',
      subtitle: 'Mean April–October count, 2004–2025 · baseline PRCP ≥ 1 mm',
      filename: 'ginseng-king-overview-wet-days',
      grid: { left: 132, bottom: 34 },
    }),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items) => `${items[0].name}<br><strong>${formatNumber(items[0].value)} days/year</strong>`,
    },
    xAxis: {
      type: 'value',
      name: 'mean days',
      axisLabel: { color: CHART_MUTED },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: wetByStation.map(({ station }) => station.name),
      axisLabel: {
        color: CHART_MUTED,
        width: 116,
        overflow: 'truncate',
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: wetByStation.map(({ value }, index) => ({
          value: Number(value.toFixed(1)),
          itemStyle: { color: STATION_COLORS[index], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 24,
        label: { show: true, position: 'right', formatter: ({ value }) => formatNumber(value) },
      },
    ],
  });

  const coverageFields = [
    ['TMAX', 'tmax_coverage_pct', '#d95f59'],
    ['TMIN', 'tmin_coverage_pct', '#3977a8'],
    ['PRCP', 'prcp_coverage_pct', '#148a85'],
  ];
  renderChart('overview-coverage-chart', {
    ...baseChartOption({
      title: 'Coverage is high, but not always complete',
      subtitle: 'Lowest station coverage in each April–October season',
      filename: 'ginseng-king-overview-coverage',
      grid: { top: 96 },
    }),
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${formatNumber(value, 2)}%`,
    },
    legend: { top: 64, left: 12 },
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      axisLabel: { interval: 2, color: CHART_MUTED },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'value',
      name: '% usable',
      ...VERTICAL_AXIS_NAME,
      min: 94,
      max: 100,
      axisLabel: { formatter: '{value}%', color: CHART_MUTED },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    series: coverageFields.map(([name, field, color]) => ({
      name,
      type: 'line',
      data: years.map((year) =>
        Math.min(...growing.filter((row) => row.year === year).map((row) => row[field])),
      ),
      symbolSize: 5,
      lineStyle: { width: 2.5, color },
      itemStyle: { color },
    })),
  });

  const highestHot = growing.reduce((best, row) =>
    row.is_hot_day_true_days > best.is_hot_day_true_days ? row : best,
  );
  document.querySelector('#overview-hot-finding').innerHTML =
    `<strong>Observed peak:</strong> ${stationName(highestHot.station_id)} recorded ` +
    `${highestHot.is_hot_day_true_days} baseline hot days in ${highestHot.year}; this is weather ` +
    `exposure, not evidence of crop damage.`;

  const wetValues = wetByStation.map((entry) => entry.value);
  document.querySelector('#overview-wet-finding').innerHTML =
    `<strong>Across-year station means span ${formatNumber(Math.min(...wetValues))}–${formatNumber(Math.max(...wetValues))} days.</strong> ` +
    `Use the explorer to see whether that difference is persistent or year-specific.`;

  const minCoverage = Math.min(
    ...growing.flatMap((row) => [
      row.tmax_coverage_pct,
      row.tmin_coverage_pct,
      row.prcp_coverage_pct,
    ]),
  );
  document.querySelector('#overview-coverage-finding').innerHTML =
    `<strong>Lowest final April–October variable coverage: ${formatNumber(minCoverage, 2)}%.</strong> ` +
    `Passing the 95% screen still leaves individual unknown days that matter for event counts and wet runs.`;
}

function explorerSelection() {
  return {
    stations: state.explore.stations,
    startYear: state.explore.startYear,
    endYear: state.explore.endYear,
    period: state.explore.period,
  };
}

function renderExplore() {
  const metric = METRICS[state.explore.metric];
  activeExploreRows = filterSummary(datasets.summary, explorerSelection());
  const years = Array.from(
    { length: state.explore.endYear - state.explore.startYear + 1 },
    (_, index) => state.explore.startYear + index,
  );

  document.querySelector('#metric-definition').innerHTML =
    `<strong>${metric.label}</strong><p>${metric.description}</p>` +
    (state.explore.metric === 'coverage'
      ? '<small>Unknown is reported as missing variable-days across TMAX, TMIN, and PRCP.</small>'
      : '<small>Counts include observed true labels only; unknown is kept separate.</small>');
  document.querySelector('#explore-result-count').textContent =
    `${activeExploreRows.length} station-year rows · ${state.explore.period === 'Annual' ? 'Annual' : 'April–October'} · ${metric.label}`;

  if (!activeExploreRows.length) {
    renderEmptyChart('explore-trend-chart', 'Station trends', 'Select at least one station to draw this chart.');
    renderEmptyChart('explore-heatmap-chart', 'Station × year heatmap', 'Select at least one station to draw this chart.');
    document.querySelector('#explore-summary-body').innerHTML =
      '<tr><td colspan="6" class="empty-cell">No stations selected.</td></tr>';
    return;
  }

  const series = state.explore.stations.map((id) => ({
    name: stationName(id),
    type: 'line',
    data: years.map((year) => {
      const row = activeExploreRows.find((entry) => entry.station_id === id && entry.year === year);
      const value = row ? metricValue(row, state.explore.metric) : null;
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }),
    connectNulls: false,
    showSymbol: years.length <= 12,
    symbolSize: 6,
    lineStyle: { width: 2.5, color: stationColor(id) },
    itemStyle: { color: stationColor(id) },
    emphasis: { focus: 'series', lineStyle: { width: 4 } },
  }));

  renderChart('explore-trend-chart', {
    ...baseChartOption({
      title: `${metric.label} by station and year`,
      subtitle: `${state.explore.period === 'Annual' ? 'Annual' : 'April–October'} baseline summary · hover or highlight a station`,
      filename: `ginseng-king-${state.explore.metric}-trend`,
      grid: { top: 100, bottom: 74 },
    }),
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${formatNumber(value, 2)} ${metric.unit}`,
    },
    legend: {
      type: 'scroll',
      top: 64,
      left: 12,
      right: 55,
      data: state.explore.stations.map(stationName),
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 18, bottom: 12, borderColor: 'transparent', backgroundColor: '#eef3ef' },
    ],
    xAxis: {
      type: 'category',
      data: years,
      boundaryGap: false,
      name: 'year',
      axisLabel: { color: CHART_MUTED },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'value',
      name: metric.unit,
      ...VERTICAL_AXIS_NAME,
      min: state.explore.metric === 'coverage' ? 90 : 0,
      max: state.explore.metric === 'coverage' ? 100 : undefined,
      minInterval: state.explore.metric === 'coverage' ? undefined : 1,
      axisLabel: {
        color: CHART_MUTED,
        formatter: state.explore.metric === 'coverage' ? '{value}%' : '{value}',
      },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    series,
  });

  const heatmapData = [];
  const heatValues = [];
  state.explore.stations.forEach((id, stationIndex) => {
    years.forEach((year, yearIndex) => {
      const row = activeExploreRows.find((entry) => entry.station_id === id && entry.year === year);
      if (!row) return;
      const value = Number(metricValue(row, state.explore.metric).toFixed(2));
      heatmapData.push([yearIndex, stationIndex, value, metricUnknown(row, state.explore.metric)]);
      heatValues.push(value);
    });
  });

  const visualMinimum =
    state.explore.metric === 'coverage' ? Math.max(90, Math.floor(Math.min(...heatValues))) : 0;
  const visualMaximum =
    state.explore.metric === 'coverage' ? 100 : Math.max(1, Math.ceil(Math.max(...heatValues)));

  renderChart('explore-heatmap-chart', {
    ...baseChartOption({
      title: `${metric.label}: station × year`,
      subtitle: 'Cell color shows the baseline value; tooltip reports unknown days or variable-days',
      filename: `ginseng-king-${state.explore.metric}-heatmap`,
      grid: { left: 142, right: 82, bottom: 76 },
    }),
    tooltip: {
      position: 'top',
      formatter: ({ value }) => {
        const year = years[value[0]];
        const id = state.explore.stations[value[1]];
        const unknownUnit = state.explore.metric === 'coverage' ? 'unknown variable-days' : 'unknown days';
        return `<strong>${stationName(id)} · ${year}</strong><br>${metric.label}: ${formatNumber(value[2], 2)} ${metric.unit}<br>${value[3]} ${unknownUnit}`;
      },
    },
    dataZoom: [{ type: 'slider', xAxisIndex: 0, height: 18, bottom: 12 }],
    xAxis: {
      type: 'category',
      data: years,
      splitArea: { show: true },
      axisLabel: { color: CHART_MUTED },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'category',
      data: state.explore.stations.map(stationName),
      splitArea: { show: true },
      axisLabel: { color: CHART_MUTED, width: 125, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: visualMinimum,
      max: visualMaximum,
      dimension: 2,
      calculable: true,
      orient: 'vertical',
      right: 4,
      top: 100,
      inRange: { color: ['#f6e7be', '#79b7a5', '#135f63'] },
      textStyle: { color: CHART_MUTED },
    },
    series: [
      {
        name: metric.label,
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: years.length <= 10,
          formatter: ({ value }) => formatNumber(value[2], state.explore.metric === 'coverage' ? 1 : 0),
          color: '#173f35',
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(23,63,53,.28)' } },
      },
    ],
  });

  const summaryRows = state.explore.stations.map((id) => {
    const rows = activeExploreRows.filter((row) => row.station_id === id);
    const values = rows.map((row) => metricValue(row, state.explore.metric));
    return {
      id,
      count: rows.length,
      average: mean(values),
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      unknown: rows.reduce((total, row) => total + metricUnknown(row, state.explore.metric), 0),
    };
  });

  document.querySelector('#explore-summary-body').innerHTML = summaryRows
    .map(
      (row) => `<tr><td><strong>${stationName(row.id)}</strong><span class="cell-sub">${row.id}</span></td>
        <td>${row.count}</td><td>${formatNumber(row.average, 2)} ${metric.unit}</td>
        <td>${formatNumber(row.minimum, 2)}</td><td>${formatNumber(row.maximum, 2)}</td>
        <td>${row.unknown.toLocaleString()}${state.explore.metric === 'coverage' ? ' variable-days' : ' days'}</td></tr>`,
    )
    .join('');
  document.querySelector('#explore-table-note').textContent =
    `Mean, minimum, and maximum cover ${state.explore.startYear}–${state.explore.endYear}; unknown is summed.`;
}

function getThresholdInputs() {
  return {
    hotC: Number(document.querySelector('#threshold-hot').value),
    wetMm: Number(document.querySelector('#threshold-wet').value),
    heavyMm: Number(document.querySelector('#threshold-heavy').value),
    prolongedDays: Number(document.querySelector('#threshold-duration').value),
    startMonth: Number(document.querySelector('#threshold-start-month').value),
    endMonth: Number(document.querySelector('#threshold-end-month').value),
  };
}

function seasonLabel(thresholds) {
  if (thresholds.startMonth === 4 && thresholds.endMonth === 10) return 'April–October';
  return `${MONTHS[thresholds.startMonth - 1]}–${MONTHS[thresholds.endMonth - 1]}`;
}

function renderDaily() {
  const error = document.querySelector('#threshold-error');
  const candidate = getThresholdInputs();
  if (!Number.isInteger(candidate.prolongedDays) || candidate.prolongedDays < 2) {
    error.textContent = 'Prolonged wet duration must be a whole number of at least two days.';
    return;
  }
  if (candidate.wetMm <= 0 || candidate.heavyMm < candidate.wetMm) {
    error.textContent = 'Wet threshold must be above zero; heavy precipitation must be at least the wet threshold.';
    return;
  }
  if (candidate.startMonth > candidate.endMonth) {
    error.textContent = 'For this within-year view, the season start must not come after the season end.';
    return;
  }
  if (![candidate.hotC, candidate.wetMm, candidate.heavyMm].every(Number.isFinite)) {
    error.textContent = 'Enter finite numbers for all thresholds.';
    return;
  }
  error.textContent = '';
  state.daily.thresholds = candidate;

  const stationRows = datasets.dailyByStation.get(state.daily.station) ?? [];
  const recomputed = recomputeSensitivity(stationRows, candidate);
  const yearRows = recomputed.filter((row) => Number(row.date.slice(0, 4)) === state.daily.year);
  activeDailyRows = yearRows.filter((row) => row.inSensitivitySeason);
  const summary = summarizeSensitivity(activeDailyRows);
  const baseline = summarizeBaseline(activeDailyRows);
  const springFreeze = lastObservedSpringFreeze(yearRows);
  const season = seasonLabel(candidate);

  const longest = summary.longestWet;
  const longestValue = longest.days
    ? `${longest.exact ? '' : '≥ '}${longest.days} day${longest.days === 1 ? '' : 's'}`
    : longest.exact
      ? '0 days'
      : 'Unknown';
  const longestDetail = longest.days
    ? `${formatDate(longest.start)} to ${formatDate(longest.end)}${longest.exact ? '' : ' · observed lower bound'}`
    : longest.exact
      ? 'No wet day observed in this season'
      : 'Precipitation gaps prevent a reliable zero';
  const freezeValue = springFreeze.date ? formatDate(springFreeze.date) : springFreeze.exact ? 'None observed' : 'Unknown';
  const freezeDetail = springFreeze.exact
    ? 'Last observed TMIN < 0°C, January–June'
    : `${springFreeze.unknownAfter} later spring TMIN gap${springFreeze.unknownAfter === 1 ? '' : 's'}; date may not be final`;

  const summaryCards = [
    {
      label: `Hot days · ≥ ${formatNumber(candidate.hotC)}°C`,
      value: summary.events.hot.true,
      detail: `${summary.events.hot.unknown} unknown TMAX day${summary.events.hot.unknown === 1 ? '' : 's'}`,
    },
    {
      label: `Wet days · ≥ ${formatNumber(candidate.wetMm)} mm`,
      value: summary.events.wet.true,
      detail: `${summary.events.wet.unknown} unknown PRCP day${summary.events.wet.unknown === 1 ? '' : 's'}`,
    },
    {
      label: `Heavy precipitation · ≥ ${formatNumber(candidate.heavyMm)} mm`,
      value: summary.events.heavy.true,
      detail: `${summary.events.heavy.unknown} unknown PRCP day${summary.events.heavy.unknown === 1 ? '' : 's'}`,
    },
    { label: 'Longest observed wet run', value: longestValue, detail: longestDetail },
    { label: 'Last observed spring freeze', value: freezeValue, detail: freezeDetail },
  ];

  document.querySelector('#daily-summary-cards').innerHTML = summaryCards
    .map(
      (card) => `<article class="metric-card"><span>${card.label}</span><strong>${card.value}</strong><small>${card.detail}</small></article>`,
    )
    .join('');

  const warning = document.querySelector('#daily-gap-warning');
  const totalMissing = summary.tmaxMissing + summary.tminMissing + summary.prcpMissing;
  if (totalMissing) {
    warning.hidden = false;
    warning.innerHTML =
      `<strong>Data-gap warning for ${season} ${state.daily.year}:</strong> ` +
      `${summary.tmaxMissing} TMAX, ${summary.tminMissing} TMIN, and ${summary.prcpMissing} PRCP ` +
      `values are unknown or excluded. They remain gaps; no interpolation or dry-day substitution is used.` +
      (!longest.exact
        ? ' The longest wet run shown above is an observed lower bound, not a reliably known maximum.'
        : '');
  } else {
    warning.hidden = true;
    warning.textContent = '';
  }

  renderDailyTemperatureChart(yearRows, candidate);
  renderDailyPrecipitationChart(yearRows, candidate);

  document.querySelector('#comparison-note').textContent =
    `${stationName(state.daily.station)} · ${season} ${state.daily.year} · counts only, with unknown shown separately.`;
  document.querySelector('#baseline-comparison-body').innerHTML = EVENT_DEFINITIONS.map(
    (event) => `<tr><td><span class="event-key" style="--event:${event.color}"></span>${event.label}</td>
      <td>${baseline[event.key].true}</td><td>${baseline[event.key].unknown}</td>
      <td>${summary.events[event.key].true}</td><td>${summary.events[event.key].unknown}</td></tr>`,
  ).join('');

  const eventRows = activeDailyRows.filter(
    (row) =>
      EVENT_DEFINITIONS.some((event) => row.sensitivity[event.key] === true) ||
      row.tmax_c === null ||
      row.tmin_c === null ||
      row.prcp_mm === null,
  );

  document.querySelector('#event-log-note').textContent =
    `${eventRows.length} ${eventRows.length === 1 ? 'date' : 'dates'} with an observed event or missing variable in ${season}.`;
  document.querySelector('#daily-event-body').innerHTML = eventRows.length
    ? eventRows
        .map((row) => {
          const labels = EVENT_DEFINITIONS.filter((event) => row.sensitivity[event.key] === true)
            .map(
              (event) =>
                `<span class="event-badge" style="--event:${event.color}">${event.label}</span>`,
            );
          if (row.tmax_c === null) labels.push('<span class="event-badge gap">TMAX unknown</span>');
          if (row.tmin_c === null) labels.push('<span class="event-badge gap">TMIN unknown</span>');
          if (row.prcp_mm === null) labels.push('<span class="event-badge gap">PRCP unknown</span>');
          return `<tr><td><strong>${formatDate(row.date)}</strong><span class="cell-sub">${row.date}</span></td>
            <td>${row.tmax_c === null ? 'Unknown' : `${formatNumber(row.tmax_c)}°C`}</td>
            <td>${row.tmin_c === null ? 'Unknown' : `${formatNumber(row.tmin_c)}°C`}</td>
            <td>${row.prcp_mm === null ? 'Unknown' : `${formatNumber(row.prcp_mm)} mm`}</td>
            <td><div class="event-list">${labels.join('')}</div></td></tr>`;
        })
        .join('')
    : '<tr><td colspan="5" class="empty-cell">No events or data gaps under the current controls.</td></tr>';
}

function seasonMarkArea(year, thresholds) {
  const lastDay = new Date(Date.UTC(year, thresholds.endMonth, 0)).getUTCDate();
  const start = `${year}-${String(thresholds.startMonth).padStart(2, '0')}-01`;
  const end = `${year}-${String(thresholds.endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    silent: true,
    itemStyle: { color: 'rgba(209, 226, 209, .24)' },
    label: { show: true, color: '#61756e', fontSize: 11, formatter: 'Selected season' },
    data: [[{ xAxis: start }, { xAxis: end }]],
  };
}

function renderDailyTemperatureChart(rows, thresholds) {
  const dates = rows.map((row) => row.date);
  const commonXAxis = {
    type: 'category',
    data: dates,
    boundaryGap: false,
    axisLabel: {
      color: CHART_MUTED,
      formatter: (value) => value.slice(5),
      hideOverlap: true,
    },
    axisLine: { lineStyle: { color: CHART_GRID } },
  };

  renderChart('daily-temperature-chart', {
    ...baseChartOption({
      title: `Daily temperature · ${stationName(state.daily.station)} · ${state.daily.year}`,
      subtitle: `Observed TMAX and TMIN in °C · gaps are not connected · hot threshold ${formatNumber(thresholds.hotC)}°C`,
      filename: `ginseng-king-${state.daily.station}-${state.daily.year}-temperature`,
      grid: { top: 100, bottom: 82 },
    }),
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = rows[items[0]?.dataIndex];
        if (!row) return '';
        const eventLabels = EVENT_DEFINITIONS.filter(
          (event) => row.sensitivity[event.key] === true && ['hot', 'freeze'].includes(event.key),
        )
          .map((event) => event.label)
          .join(', ');
        return `<strong>${formatDate(row.date)}</strong><br>TMAX: ${row.tmax_c === null ? `Unknown (${row.tmax_status})` : `${formatNumber(row.tmax_c)}°C`}<br>` +
          `TMIN: ${row.tmin_c === null ? `Unknown (${row.tmin_status})` : `${formatNumber(row.tmin_c)}°C`}` +
          (eventLabels ? `<br>Events: ${eventLabels}` : '');
      },
    },
    legend: { top: 64, left: 12, data: ['TMAX', 'TMIN', 'Hot event', 'Freeze event'] },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 18, bottom: 14, borderColor: 'transparent', backgroundColor: '#eef3ef' },
    ],
    xAxis: commonXAxis,
    yAxis: {
      type: 'value',
      name: '°C',
      ...VERTICAL_AXIS_NAME,
      axisLabel: { color: CHART_MUTED, formatter: '{value}°' },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    series: [
      {
        name: 'TMAX',
        type: 'line',
        data: rows.map((row) => row.tmax_c),
        connectNulls: false,
        showSymbol: false,
        lineStyle: { color: '#d95f59', width: 2 },
        itemStyle: { color: '#d95f59' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { formatter: `Hot ${formatNumber(thresholds.hotC)}°C`, color: '#9c413f' },
          lineStyle: { color: '#d95f59', type: 'dashed' },
          data: [{ yAxis: thresholds.hotC }],
        },
        markArea: seasonMarkArea(state.daily.year, thresholds),
      },
      {
        name: 'TMIN',
        type: 'line',
        data: rows.map((row) => row.tmin_c),
        connectNulls: false,
        showSymbol: false,
        lineStyle: { color: '#3977a8', width: 2 },
        itemStyle: { color: '#3977a8' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { formatter: 'Freeze 0°C', color: '#2d618b' },
          lineStyle: { color: '#3977a8', type: 'dashed' },
          data: [{ yAxis: 0 }],
        },
      },
      {
        name: 'Hot event',
        type: 'scatter',
        data: rows.map((row) => (row.sensitivity.hot === true ? row.tmax_c : null)),
        symbolSize: 7,
        itemStyle: { color: '#a9363c' },
        z: 5,
      },
      {
        name: 'Freeze event',
        type: 'scatter',
        data: rows.map((row) => (row.sensitivity.freeze === true ? row.tmin_c : null)),
        symbolSize: 7,
        itemStyle: { color: '#225f91' },
        z: 5,
      },
    ],
  });
}

function renderDailyPrecipitationChart(rows, thresholds) {
  renderChart('daily-precipitation-chart', {
    ...baseChartOption({
      title: `Daily precipitation · ${stationName(state.daily.station)} · ${state.daily.year}`,
      subtitle: `Observed PRCP in mm · wet ≥ ${formatNumber(thresholds.wetMm)} · heavy ≥ ${formatNumber(thresholds.heavyMm)} · × marks unknown`,
      filename: `ginseng-king-${state.daily.station}-${state.daily.year}-precipitation`,
      grid: { top: 100, bottom: 82 },
    }),
    tooltip: {
      trigger: 'axis',
      formatter: (items) => {
        const row = rows[items[0]?.dataIndex];
        if (!row) return '';
        const labels = EVENT_DEFINITIONS.filter(
          (event) => row.sensitivity[event.key] === true && ['wet', 'heavy', 'prolonged'].includes(event.key),
        )
          .map((event) => event.label)
          .join(', ');
        return `<strong>${formatDate(row.date)}</strong><br>PRCP: ${
          row.prcp_mm === null ? `Unknown (${row.prcp_status})` : `${formatNumber(row.prcp_mm)} mm`
        }${labels ? `<br>Events: ${labels}` : ''}`;
      },
    },
    legend: { top: 64, left: 12, data: ['Observed PRCP', 'Missing PRCP'] },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 18, bottom: 14, borderColor: 'transparent', backgroundColor: '#eef3ef' },
    ],
    xAxis: {
      type: 'category',
      data: rows.map((row) => row.date),
      axisLabel: { color: CHART_MUTED, formatter: (value) => value.slice(5), hideOverlap: true },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'value',
      name: 'mm',
      ...VERTICAL_AXIS_NAME,
      min: 0,
      axisLabel: { color: CHART_MUTED },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    series: [
      {
        name: 'Observed PRCP',
        type: 'bar',
        data: rows.map((row) => {
          if (row.prcp_mm === null) return null;
          let color = '#b7c8bf';
          if (row.sensitivity.wet === true) color = '#2b9890';
          if (row.sensitivity.heavy === true) color = '#625fa6';
          return { value: row.prcp_mm, itemStyle: { color } };
        }),
        barMaxWidth: 8,
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: thresholds.wetMm,
              label: { formatter: 'Wet', color: '#16756f' },
              lineStyle: { color: '#2b9890', type: 'dashed' },
            },
            {
              yAxis: thresholds.heavyMm,
              label: { formatter: 'Heavy', color: '#56528f' },
              lineStyle: { color: '#625fa6', type: 'dashed' },
            },
          ],
        },
        markArea: seasonMarkArea(state.daily.year, thresholds),
      },
      {
        name: 'Missing PRCP',
        type: 'scatter',
        data: rows.map((row) => (row.prcp_mm === null ? 0 : null)),
        symbol: 'path://M-6,-6 L6,6 M6,-6 L-6,6',
        symbolSize: 11,
        itemStyle: { color: '#a94b45' },
        z: 6,
      },
    ],
  });
}

function qualityRows() {
  return datasets.summary.filter((row) => row.period === state.quality.period);
}

function renderQuality() {
  const rows = qualityRows();
  const variable = state.quality.variable;
  const label = variable.toUpperCase();
  const coverageField = `${variable}_coverage_pct`;
  const usableField = `${variable}_usable_days`;
  const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
  const values = rows.map((row) => row[coverageField]);
  const heatmap = [];

  datasets.stations.forEach((station, stationIndex) => {
    years.forEach((year, yearIndex) => {
      const row = rows.find((entry) => entry.station_id === station.id && entry.year === year);
      heatmap.push([
        yearIndex,
        stationIndex,
        row[coverageField],
        row[usableField],
        row.expected_days - row[usableField],
      ]);
    });
  });

  renderChart('quality-heatmap-chart', {
    ...baseChartOption({
      title: `${label} usable-data coverage`,
      subtitle: `${state.quality.period === 'Annual' ? 'Annual' : 'April–October'} station-year coverage after final cleaning`,
      filename: `ginseng-king-${variable}-coverage`,
      grid: { left: 142, right: 84, bottom: 76 },
    }),
    tooltip: {
      formatter: ({ value }) => {
        const id = datasets.stations[value[1]].id;
        return `<strong>${stationName(id)} · ${years[value[0]]}</strong><br>${label}: ${formatNumber(value[2], 3)}%<br>` +
          `${value[3]} usable · ${value[4]} unknown`;
      },
    },
    dataZoom: [{ type: 'slider', xAxisIndex: 0, height: 18, bottom: 12 }],
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: CHART_MUTED },
      splitArea: { show: true },
      axisLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'category',
      data: datasets.stations.map((station) => station.name),
      axisLabel: { color: CHART_MUTED, width: 125, overflow: 'truncate' },
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: Math.max(90, Math.floor(Math.min(...values))),
      max: 100,
      dimension: 2,
      calculable: true,
      orient: 'vertical',
      right: 4,
      top: 100,
      inRange: { color: ['#d98963', '#f4e7bd', '#76b3a1', '#135f63'] },
      textStyle: { color: CHART_MUTED },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmap,
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(23,63,53,.28)' } },
      },
    ],
  });

  document.querySelector('#quality-table-note').textContent =
    `${rows.length} rows · sorted by station then year · unknown = expected minus usable ${label} days.`;
  document.querySelector('#quality-table-body').innerHTML = rows
    .map(
      (row) => `<tr><td><strong>${stationName(row.station_id)}</strong><span class="cell-sub">${row.station_id}</span></td>
        <td>${row.year}</td><td>${row.expected_days}</td><td>${row[usableField]}</td>
        <td>${row.expected_days - row[usableField]}</td>
        <td><span class="coverage-value ${row[coverageField] < 95 ? 'coverage-low' : ''}">${formatNumber(row[coverageField], 3)}%</span></td></tr>`,
    )
    .join('');
}

function exportExploreCsv() {
  if (!activeExploreRows.length) return;
  const metric = METRICS[state.explore.metric];
  const csv = rowsToCsv(activeExploreRows, [
    { label: 'station_id', value: (row) => row.station_id },
    { label: 'station_name', value: (row) => stationName(row.station_id) },
    { label: 'year', value: (row) => row.year },
    { label: 'period', value: (row) => row.period },
    { label: 'metric', value: () => state.explore.metric },
    { label: 'metric_label', value: () => metric.label },
    { label: `value_${metric.unit === '%' ? 'pct' : metric.unit}`, value: (row) => metricValue(row, state.explore.metric) },
    {
      label: state.explore.metric === 'coverage' ? 'unknown_variable_days' : 'unknown_days',
      value: (row) => metricUnknown(row, state.explore.metric),
    },
    { label: 'expected_days', value: (row) => row.expected_days },
  ]);
  downloadText(
    `ginseng-king-${state.explore.metric}-${state.explore.period}-${state.explore.startYear}-${state.explore.endYear}.csv`,
    csv,
  );
}

function bindEvents() {
  window.addEventListener('hashchange', showRoute);

  document.querySelector('#explore-reset').addEventListener('click', () => {
    state.explore = {
      stations: datasets.stations.slice(0, 3).map((station) => station.id),
      startYear: 2004,
      endYear: 2025,
      period: 'Apr-Oct',
      metric: 'hot',
    };
    document.querySelectorAll('[name="explore-station"]').forEach((input) => {
      input.checked = state.explore.stations.includes(input.value);
    });
    document.querySelector('#explore-start-year').value = '2004';
    document.querySelector('#explore-end-year').value = '2025';
    document.querySelector('#explore-period').value = 'Apr-Oct';
    document.querySelector('#explore-metric').value = 'hot';
    renderExplore();
  });

  document.querySelector('#select-all-stations').addEventListener('click', () => {
    document.querySelectorAll('[name="explore-station"]').forEach((input) => {
      input.checked = true;
    });
    state.explore.stations = datasets.stations.map((station) => station.id);
    renderExplore();
  });
  document.querySelector('#clear-stations').addEventListener('click', () => {
    document.querySelectorAll('[name="explore-station"]').forEach((input) => {
      input.checked = false;
    });
    state.explore.stations = [];
    renderExplore();
  });
  document.querySelectorAll('[name="explore-station"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.explore.stations = Array.from(
        document.querySelectorAll('[name="explore-station"]:checked'),
        (element) => element.value,
      );
      renderExplore();
    });
  });

  document.querySelector('#explore-start-year').addEventListener('change', (event) => {
    state.explore.startYear = Number(event.target.value);
    if (state.explore.startYear > state.explore.endYear) {
      state.explore.endYear = state.explore.startYear;
      document.querySelector('#explore-end-year').value = String(state.explore.endYear);
    }
    renderExplore();
  });
  document.querySelector('#explore-end-year').addEventListener('change', (event) => {
    state.explore.endYear = Number(event.target.value);
    if (state.explore.endYear < state.explore.startYear) {
      state.explore.startYear = state.explore.endYear;
      document.querySelector('#explore-start-year').value = String(state.explore.startYear);
    }
    renderExplore();
  });
  document.querySelector('#explore-period').addEventListener('change', (event) => {
    state.explore.period = event.target.value;
    renderExplore();
  });
  document.querySelector('#explore-metric').addEventListener('change', (event) => {
    state.explore.metric = event.target.value;
    renderExplore();
  });
  document.querySelector('#export-explore-csv').addEventListener('click', exportExploreCsv);

  document.querySelectorAll('[data-chart-export]').forEach((button) => {
    button.addEventListener('click', () => {
      const chartId = button.dataset.chartExport;
      exportChart(chartId, `ginseng-king-${chartId.replace('-chart', '')}`);
    });
  });

  document.querySelector('#daily-station').addEventListener('change', (event) => {
    state.daily.station = event.target.value;
    renderDaily();
  });
  document.querySelector('#daily-year').addEventListener('change', (event) => {
    state.daily.year = Number(event.target.value);
    renderDaily();
  });
  document
    .querySelectorAll(
      '#threshold-hot, #threshold-wet, #threshold-heavy, #threshold-duration, #threshold-start-month, #threshold-end-month',
    )
    .forEach((control) => control.addEventListener('change', renderDaily));

  document.querySelector('#reset-thresholds').addEventListener('click', () => {
    const thresholds = datasets.metadata.thresholds;
    document.querySelector('#threshold-hot').value = thresholds.hot_tmax_at_least_c;
    document.querySelector('#threshold-wet').value = thresholds.wet_prcp_at_least_mm;
    document.querySelector('#threshold-heavy').value = thresholds.heavy_prcp_at_least_mm;
    document.querySelector('#threshold-duration').value = thresholds.prolonged_wet_minimum_days;
    document.querySelector('#threshold-start-month').value = '4';
    document.querySelector('#threshold-end-month').value = '10';
    renderDaily();
  });

  document.querySelector('#quality-variable').addEventListener('change', (event) => {
    state.quality.variable = event.target.value;
    renderQuality();
  });
  document.querySelector('#quality-period').addEventListener('change', (event) => {
    state.quality.period = event.target.value;
    renderQuality();
  });
}

function showRoute() {
  const requested = window.location.hash.replace('#', '');
  const route = ROUTES[requested] ? requested : 'overview';
  state.route = route;

  document.querySelectorAll('[data-page]').forEach((page) => {
    page.hidden = page.dataset.page !== route;
  });
  document.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (route === 'overview') renderOverview();
  if (route === 'explore') renderExplore();
  if (route === 'daily') renderDaily();
  if (route === 'methods') renderQuality();
  document.title = `${ROUTES[route].label} · Ginseng King`;
  window.scrollTo({ top: 0, behavior: 'instant' });
  requestAnimationFrame(resizeCharts);
}

function renderError(error) {
  console.error(error);
  app.innerHTML = `
    <main class="error-state">
      <div class="error-icon" aria-hidden="true">!</div>
      <p class="eyebrow">Data could not be loaded</p>
      <h1>The weather dashboard is unavailable.</h1>
      <p>${escapeHtml(error.message)}</p>
      <p class="error-help">Run <code>npm run prepare:data</code> from <code>website/</code>, then refresh.
        All three cleaned source files must be present in <code>data/NOAA/cleaned/</code>.</p>
      <button id="retry-load" class="button" type="button">Try again</button>
    </main>`;
  document.querySelector('#retry-load').addEventListener('click', initialize);
}

async function initialize() {
  app.innerHTML = `
    <main class="boot-state" aria-live="polite">
      <div class="loading-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <p>Loading 40,180 station-day observations…</p>
      <small>Missing values will remain unknown.</small>
    </main>`;
  try {
    datasets = await loadDatasets();
    initializeState();
    buildLayout();
    bindEvents();
    showRoute();
  } catch (error) {
    renderError(error);
  }
}

initialize();
