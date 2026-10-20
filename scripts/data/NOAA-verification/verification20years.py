"""Verify completeness of the final five NOAA stations for 2004-2025.

The requested filename says 20years; the agreed window is 22 calendar years.
Requires Python 3.9+ and the standard library only. No downloads are performed.
Raw files are never modified. Keep verification2025.py alongside this file;
the one-year command imports the shared parser and audit logic from here.

Run from the repository root:
    python scripts/data/NOAA-verification/verification20years.py
    python scripts/data/NOAA-verification/verification20years.py --output-dir ../research/noaa/verification_full
    python -m unittest discover -s scripts/data/NOAA-verification -p test_verification.py

Defaults are resolved from this file's location, independent of the working
directory. Input: data/NOAA/raw/, including download_manifest.json.
Output: data/NOAA/verification/verification20years/. Use --output-dir to keep
working results outside the repository. Reruns replace the four report files.
Options: --raw-dir, --output-dir, --start-year, --end-year, and
--coverage-threshold (default 0.95).

Outputs: COMPLETENESS_REPORT.md, completeness_detail.json,
station_year_status.json, and audit_summary.json. These record annual and
April-October coverage, missing/quality-excluded dates, missing months, gap
runs, flag counts, input checksums, common years, and consistency anomalies.

Usable means nonmissing with a blank NOAA QFLAG. Leap days and absent months
are included. Trace precipitation remains a recorded observation. Malformed
or duplicate monthly records in the requested period and checksum mismatches
stop the audit. Passing coverage does not mean complete observations or
reliable rainfall-spell estimates across gaps. No values are filled.

Adapted from the research-stage checks for the final five-station delivery;
excluded-candidate files and redundant daily exports are not required.
"""
import argparse
import calendar
from collections import Counter
from datetime import date, timedelta
import hashlib
import json
from pathlib import Path

STATIONS = {
    'USW00014897': 'WAUSAU ASOS', 'USC00475364': 'MERRILL',
    'USC00475120': 'MARSHFIELD EXP FARM', 'USC00478171': 'STEVENS PT',
    'USW00094985': 'MARSHFIELD MUNI AP',
}
VARIABLES = ('TMAX', 'TMIN', 'PRCP')


def parse_file(path, station, start, end):
    """Reject malformed/duplicate monthly records rather than overwriting silently."""
    observations, months, issues = {}, set(), []
    for number, line in enumerate(path.read_text(encoding='ascii').splitlines(), 1):
        if len(line) != 269:
            raise ValueError(f'{path.name}:{number}: expected 269 characters')
        sid, year, month, variable = line[:11], int(line[11:15]), int(line[15:17]), line[17:21]
        if sid != station or not 1 <= month <= 12:
            raise ValueError(f'{path.name}:{number}: unexpected station/year/month')
        if not start <= year <= end:
            continue
        key = year, month, variable
        if key in months:
            raise ValueError(f'{path.name}:{number}: duplicate monthly record {key}')
        months.add(key)
        if variable not in VARIABLES:
            continue
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            chunk = line[21+(day-1)*8:29+(day-1)*8]
            value = int(chunk[:5])
            obs = {'raw_value': value, 'mflag': chunk[5].strip(), 'qflag': chunk[6].strip(), 'sflag': chunk[7].strip()}
            obs['usable'] = value != -9999 and not obs['qflag']
            observations[date(year, month, day), variable] = obs
            if value != -9999 and variable == 'PRCP' and value < 0:
                issues.append({'date': date(year, month, day).isoformat(), 'issue': 'negative_precipitation', 'variable': variable})
    for day, variable in observations:
        if variable != 'TMAX':
            continue
        maximum, minimum = observations[day, variable], observations.get((day, 'TMIN'))
        if minimum and maximum['usable'] and minimum['usable'] and maximum['raw_value'] < minimum['raw_value']:
            issues.append({'date': day.isoformat(), 'issue': 'tmax_below_tmin', 'variable': 'TMAX/TMIN'})
    return observations, months, issues


def summarize(observations, months, year, variable, period, threshold):
    first, last = (date(year, 1, 1), date(year, 12, 31)) if period == 'Annual' else (date(year, 4, 1), date(year, 10, 31))
    days = [first + timedelta(days=i) for i in range((last-first).days+1)]
    missing, flagged, absent, runs = [], [], [], []
    measurements, sources, qualities = Counter(), Counter(), Counter()
    run_start = None
    usable = 0
    for day in days:
        obs = observations.get((day, variable))
        if obs is None:
            absent.append(day.isoformat())
            missing.append(day.isoformat())
        elif obs['raw_value'] == -9999:
            missing.append(day.isoformat())
        else:
            for field, counter in [('mflag', measurements), ('qflag', qualities), ('sflag', sources)]:
                if obs[field]:
                    counter[obs[field]] += 1
            if obs['qflag']:
                flagged.append(day.isoformat())
        valid = obs is not None and obs['usable']
        usable += valid
        if not valid and run_start is None:
            run_start = day
        if run_start is not None and (valid or day == last):
            run_end = day-timedelta(days=1) if valid else day
            runs.append({'start': run_start.isoformat(), 'end': run_end.isoformat(), 'days': (run_end-run_start).days+1})
            run_start = None
    expected = len(days)
    assert usable + len(missing) + len(flagged) == expected
    return dict(year=year, period=period, variable=variable, expected_days=expected,
        usable_days=usable, missing_days=len(missing), quality_excluded_days=len(flagged),
        absent_record_days=len(absent), coverage_pct=round(100*usable/expected, 4),
        meets_coverage_threshold=usable/expected >= threshold, complete=usable == expected,
        missing_months=[m for m in range(first.month, last.month+1) if (year, m, variable) not in months],
        longest_unusable_run=max((r['days'] for r in runs), default=0), unusable_runs=runs,
        missing_dates=missing, quality_excluded_dates=flagged, measurement_flags=dict(measurements),
        quality_flags=dict(qualities), source_flags=dict(sources))


def main(argv=None, default_start=2004, default_end=2025, output_name='verification20years'):
    workspace = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, default=workspace/'data/NOAA/raw')
    parser.add_argument('--output-dir', type=Path, default=workspace/'data/NOAA/verification'/output_name)
    parser.add_argument('--start-year', type=int, default=default_start)
    parser.add_argument('--end-year', type=int, default=default_end)
    parser.add_argument('--coverage-threshold', type=float, default=0.95)
    args = parser.parse_args(argv)
    if args.start_year > args.end_year or not 0 <= args.coverage_threshold <= 1:
        parser.error('Invalid year range or coverage threshold')
    if args.output_dir.resolve().is_relative_to(args.raw_dir.resolve()):
        parser.error('Output directory must be outside the raw data directory')
    manifest = json.loads((args.raw_dir/'download_manifest.json').read_text(encoding='utf-8'))
    index = {item['station_id']: item for item in manifest}
    rows, files, anomalies = [], [], []
    for sid, name in STATIONS.items():
        item = index[sid]
        path = args.raw_dir/item['filename']
        if path.parent.resolve() != args.raw_dir.resolve():
            raise ValueError('Manifest filename must point inside raw directory')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item['delivered_sha256']:
            raise ValueError(f'Checksum mismatch: {path.name}')
        observations, months, issues = parse_file(path, sid, args.start_year, args.end_year)
        files.append(dict(station_id=sid, filename=path.name, sha256=digest, checksum_verified=True, monthly_records=len(months)))
        anomalies.extend(dict(station_id=sid, **issue) for issue in issues)
        for year in range(args.start_year, args.end_year+1):
            for period in ('Annual', 'Apr-Oct'):
                for variable in VARIABLES:
                    rows.append(dict(station_id=sid, station_name=name, **summarize(observations, months, year, variable, period, args.coverage_threshold)))
    station_years = []
    for sid in STATIONS:
        for year in range(args.start_year, args.end_year+1):
            for period in ('Annual', 'Apr-Oct'):
                selected = [r for r in rows if r['station_id'] == sid and r['year'] == year and r['period'] == period]
                station_years.append(dict(station_id=sid, year=year, period=period,
                    all_variables_meet_threshold=all(r['meets_coverage_threshold'] for r in selected),
                    all_variables_complete=all(r['complete'] for r in selected)))
    common = {}
    for period in ('Annual', 'Apr-Oct'):
        common[period] = {}
        for key in ('all_variables_meet_threshold', 'all_variables_complete'):
            common[period][key] = [y for y in range(args.start_year, args.end_year+1)
                if all(r[key] for r in station_years if r['year'] == y and r['period'] == period)]
    config = dict(start_year=args.start_year, end_year=args.end_year, coverage_threshold=args.coverage_threshold,
        growing_season='April 1 through October 31', required_variables=list(VARIABLES), stations=STATIONS,
        usable_definition='Nonmissing value with blank NOAA QFLAG. Other flags preserved; no imputation.',
        limitation='Coverage passing is not final analytical acceptance; rainfall gaps and measurement/source flags require review.')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for filename, value in [('completeness_detail.json', rows), ('station_year_status.json', station_years),
                            ('audit_summary.json', dict(configuration=config, files=files, common_years=common, anomalies=anomalies))]:
        (args.output_dir/filename).write_text(json.dumps(value, indent=2), encoding='utf-8')
    lines = ['# NOAA Data Completeness Audit', '',
        f'Study window: {args.start_year}–{args.end_year}. Coverage threshold: {args.coverage_threshold:.0%} per variable. {len(STATIONS)} stations; TMAX, TMIN, and PRCP.', '',
        'All input checksums matched the delivery manifest. The audit did not modify raw files. Leap days are included; absent monthly records count as missing days. Nonblank QFLAG values are excluded from usable coverage. Trace precipitation remains a recorded value, with its measurement flag retained.', '',
        '## Station results', '',
        'Counts are years passing the coverage threshold, not necessarily complete years. All-variable counts require all three variables to pass in the same station-year.', '',
        '| Station | Annual all variables | Apr-Oct TMAX | Apr-Oct TMIN | Apr-Oct PRCP | Apr-Oct all variables | Apr-Oct completely observed years |',
        '|---|---:|---:|---:|---:|---:|---:|']
    total = args.end_year-args.start_year+1
    for sid, name in STATIONS.items():
        sy = [r for r in station_years if r['station_id'] == sid]
        counts = [sum(r['period']=='Annual' and r['all_variables_meet_threshold'] for r in sy)]
        counts += [sum(r['station_id']==sid and r['period']=='Apr-Oct' and r['variable']==v and r['meets_coverage_threshold'] for r in rows) for v in VARIABLES]
        counts += [sum(r['period']=='Apr-Oct' and r[key] for r in sy) for key in ('all_variables_meet_threshold','all_variables_complete')]
        lines.append(f'| {name} ({sid}) | ' + ' | '.join(f'{n}/{total}' for n in counts) + ' |')
    lines += ['', f'## Common years across all {len(STATIONS)} stations', '']
    for period, values in common.items():
        for key, years in values.items():
            lines.append(f"- {period}, {key.replace('_', ' ')}: {len(years)} years ({', '.join(map(str, years)) or 'none'}).")
    lines += ['', '## Interpretation', '',
        'These are completeness results, not a final selection of 20 years. Do not label partially observed years complete. A threshold pass does not establish reliable consecutive-rainfall counts: an unknown day must not be treated as dry or automatically bridged. Review gap timing, measurement and source flags, observation-day definitions, and flagged anomalies before calculating indicators. Station-specific usable years may differ from the shared station intersection.', '',
        f'Basic value-consistency anomalies: {len(anomalies)}. Details are retained in audit_summary.json. Nonmissing quality-flagged counts and dates are in completeness_detail.json.', '',
        '## Year-by-year growing-season coverage', '',
        'Cells show TMAX / TMIN / PRCP usable percentages. Thresholds are applied to unrounded fractions.', '',
        '| Year | ' + ' | '.join(STATIONS) + ' |', '|---|' + '---:|'*len(STATIONS)]
    for year in range(args.start_year, args.end_year+1):
        cells = []
        for sid in STATIONS:
            selected = [r for r in rows if r['station_id']==sid and r['year']==year and r['period']=='Apr-Oct']
            cells.append(' / '.join(f"{r['coverage_pct']:.2f}" for r in selected))
        lines.append(f'| {year} | ' + ' | '.join(cells) + ' |')
    (args.output_dir/'COMPLETENESS_REPORT.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print('\n'.join(lines[:lines.index('## Interpretation')]))


if __name__ == '__main__':
    main()
