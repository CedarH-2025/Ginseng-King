import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const websiteDirectory = resolve(scriptDirectory, '..');
const repositoryDirectory = resolve(websiteDirectory, '..');
const sourceDirectory = join(repositoryDirectory, 'data', 'NOAA', 'cleaned');
const outputDirectory = join(websiteDirectory, 'public', 'data');
const require = createRequire(import.meta.url);
const REGION_COUNTIES = new Set(['55069', '55073', '55097', '55141']);

const expectedFiles = [
  { name: 'daily_weather.csv', expectedRows: 40_180 },
  { name: 'seasonal_summary.csv', expectedRows: 220 },
  { name: 'processing_metadata.json' },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function countCsvRows(buffer) {
  const text = buffer.toString('utf8').trimEnd();
  return Math.max(0, text.split(/\r?\n/).length - 1);
}

async function documentedDate() {
  const notePath = join(repositoryDirectory, 'progress-note', 'NOAA_Cleaning.md');
  const note = await readFile(notePath, 'utf8');
  return note.match(/^Date:\s*([^.]+)\./m)?.[1] ?? null;
}

async function rawDownloadDate() {
  const manifestPath = join(repositoryDirectory, 'data', 'NOAA', 'raw', 'download_manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const dates = [...new Set(manifest.map((item) => item.download_date).filter(Boolean))];
  return dates.length === 1 ? dates[0] : null;
}

await mkdir(outputDirectory, { recursive: true });

const files = [];
for (const file of expectedFiles) {
  const sourcePath = join(sourceDirectory, file.name);
  const outputPath = join(outputDirectory, file.name);
  const contents = await readFile(sourcePath);
  const rows = file.name.endsWith('.csv') ? countCsvRows(contents) : undefined;

  if (file.expectedRows !== undefined && rows !== file.expectedRows) {
    throw new Error(
      `${file.name} has ${rows.toLocaleString()} rows; expected ${file.expectedRows.toLocaleString()}.`,
    );
  }

  await copyFile(sourcePath, outputPath);
  files.push({
    name: file.name,
    source: relative(websiteDirectory, sourcePath),
    bytes: contents.byteLength,
    sha256: sha256(contents),
    ...(rows === undefined ? {} : { rows }),
  });
}

const metadata = JSON.parse(await readFile(join(sourceDirectory, 'processing_metadata.json'), 'utf8'));
if (metadata.rows !== 40_180 || Object.keys(metadata.stations ?? {}).length !== 5) {
  throw new Error('processing_metadata.json does not describe the expected five-station dataset.');
}

const countyTopology = JSON.parse(
  await readFile(require.resolve('us-atlas/counties-10m.json'), 'utf8'),
);
const regionalFeatures = feature(countyTopology, countyTopology.objects.counties).features.filter(
  (county) => REGION_COUNTIES.has(String(county.id)),
);
if (regionalFeatures.length !== REGION_COUNTIES.size) {
  throw new Error('Could not prepare the four-county Central Wisconsin station map.');
}
const stationRegion = {
  type: 'FeatureCollection',
  name: 'Central Wisconsin NOAA station region',
  features: regionalFeatures,
};
const stationRegionText = `${JSON.stringify(stationRegion)}\n`;
await writeFile(join(outputDirectory, 'station_region.geojson'), stationRegionText, 'utf8');

const websiteManifest = {
  prepared_at: new Date().toISOString(),
  preparation: 'Exact static copies made from repository-cleaned data; no analytical values changed.',
  source_directory: relative(websiteDirectory, sourceDirectory),
  cleaning_documentation_date: await documentedDate(),
  raw_download_date: await rawDownloadDate(),
  map_boundary: {
    name: 'station_region.geojson',
    source: 'U.S. Census Bureau cartographic boundaries via us-atlas 3.0.1',
    county_fips: [...REGION_COUNTIES],
    sha256: sha256(Buffer.from(stationRegionText)),
  },
  files,
};

await writeFile(
  join(outputDirectory, 'website_data_manifest.json'),
  `${JSON.stringify(websiteManifest, null, 2)}\n`,
  'utf8',
);

console.log(
  `Prepared ${files.length} source files in ${relative(repositoryDirectory, outputDirectory)} ` +
    `(${files.filter((file) => file.rows).map((file) => `${file.name}: ${file.rows.toLocaleString()} rows`).join(', ')}).`,
);
