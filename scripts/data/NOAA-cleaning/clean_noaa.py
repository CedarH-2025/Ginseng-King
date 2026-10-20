"""Clean five NOAA stations and add nullable daily weather labels.

Python 3.9+, standard library only. From repository root:
    python scripts/data/NOAA-cleaning/clean_noaa.py
Optional: --output-dir PATH --hot-c 30 --wet-mm 1 --heavy-mm 20 --wet-days 3
Reads data/NOAA/raw/ and its manifest without modifying source files.
Writes daily_weather.csv, seasonal_summary.csv, and processing_metadata.json
to data/NOAA/cleaned/. Repeated runs replace these generated output files.
CSV booleans are lowercase true/false; an empty cell means unknown/missing.
Flag meanings and threshold rationale are recorded in progress-note/
NOAA_Cleaning.md, rather than a separate README or report.
"""
import argparse
import calendar
from collections import Counter
import csv
from datetime import date, timedelta
import hashlib
import importlib.util
import json
import math
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location('noaa_verification', REPO/'scripts/data/NOAA-verification/verification20years.py')
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)
LABELS = ['is_freezing_day', 'is_hot_day', 'is_wet_day', 'is_heavy_precip_day', 'is_prolonged_wet_day']
VARIABLES = {'TMAX':'tmax_c', 'TMIN':'tmin_c', 'PRCP':'prcp_mm'}


def prolonged_flags(wet, minimum):
    """Label whole confirmed runs; short gap-adjacent wet runs stay unknown."""
    result = [False if value is False else None for value in wet]
    i = 0
    while i < len(wet):
        if wet[i] is not True:
            i += 1
            continue
        j = i
        while j < len(wet) and wet[j] is True:
            j += 1
        if j-i >= minimum:
            label = True
        elif (i == 0 or wet[i-1] is None or j == len(wet) or wet[j] is None):
            label = None
        else:
            label = False
        result[i:j] = [label]*(j-i)
        i = j
    return result


def clean_observation(obs, variable):
    if obs is None:
        return None, 'absent_record'
    if obs['raw_value'] == -9999:
        return None, 'missing_value'
    if obs['qflag']:
        return None, 'quality_flag_excluded'
    if variable == 'PRCP' and obs['raw_value'] < 0:
        return None, 'negative_precipitation'
    if variable == 'PRCP' and obs['mflag'] in ('A', 'P'):
        return None, 'accumulated_or_presumed_zero'
    return obs['raw_value']/10, 'usable'


def classify(value, threshold, below=False):
    return None if value is None else (value < threshold if below else value >= threshold)


def write_csv(path, rows):
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        for row in rows:
            writer.writerow({k: ('true' if v else 'false') if isinstance(v,bool) else v for k,v in row.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=REPO/'data/NOAA/cleaned')
    parser.add_argument('--hot-c', type=float, default=30)
    parser.add_argument('--wet-mm', type=float, default=1)
    parser.add_argument('--heavy-mm', type=float, default=20)
    parser.add_argument('--wet-days', type=int, default=3)
    args = parser.parse_args()
    if not all(math.isfinite(v) for v in [args.hot_c,args.wet_mm,args.heavy_mm]) or args.wet_mm <= 0 or args.heavy_mm < args.wet_mm or args.wet_days < 2:
        parser.error('Thresholds must be finite; wet > 0; heavy >= wet; wet-days >= 2')
    raw = REPO/'data/NOAA/raw'
    if args.output_dir.resolve().is_relative_to(raw.resolve()):
        parser.error('Outputs cannot be written inside raw input directory')
    manifest = json.loads((raw/'download_manifest.json').read_text(encoding='utf-8'))
    index = {item['station_id']:item for item in manifest}
    if set(index) != set(VERIFY.STATIONS) or len(manifest) != 5:
        raise ValueError('Manifest must contain exactly the five selected stations')
    dates = [date(2004,1,1)+timedelta(days=i) for i in range((date(2025,12,31)-date(2004,1,1)).days+1)]
    daily, summaries, sources = [], [], []
    for sid, name in VERIFY.STATIONS.items():
        item = index[sid]
        path = raw/item['filename']
        if path.parent.resolve() != raw.resolve():
            raise ValueError('Unexpected manifest path')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != item['delivered_sha256']:
            raise ValueError(f'Input checksum mismatch: {sid}')
        obs, _, _ = VERIFY.parse_file(path,sid,2004,2025)
        rows = []
        for day in dates:
            row = dict(station_id=sid, station_name=name, date=day.isoformat(), latitude=item['latitude'], longitude=item['longitude'],
                       is_growing_season=4 <= day.month <= 10)
            for var, field in VARIABLES.items():
                original = obs.get((day,var))
                row[field], row[f'{var.lower()}_status'] = clean_observation(original,var)
                row[f'{var.lower()}_raw_value'] = original['raw_value'] if original else None
                for flag in ('mflag','qflag','sflag'):
                    row[f'{var.lower()}_{flag}'] = original[flag] if original else ''
            if row['tmax_c'] is not None and row['tmin_c'] is not None and row['tmax_c'] < row['tmin_c']:
                for var in ('TMAX','TMIN'):
                    row[VARIABLES[var]] = None
                    row[f'{var.lower()}_status'] = 'tmax_below_tmin'
            row['is_freezing_day'] = classify(row['tmin_c'],0,below=True)
            row['is_hot_day'] = classify(row['tmax_c'],args.hot_c)
            row['is_wet_day'] = classify(row['prcp_mm'],args.wet_mm)
            row['is_heavy_precip_day'] = classify(row['prcp_mm'],args.heavy_mm)
            rows.append(row)
        for row, label in zip(rows,prolonged_flags([r['is_wet_day'] for r in rows],args.wet_days)):
            row['is_prolonged_wet_day'] = label
        daily.extend(rows)
        for year in range(2004,2026):
            for period in ('Annual','Apr-Oct'):
                subset = [r for r in rows if int(r['date'][:4]) == year and (period=='Annual' or r['is_growing_season'])]
                summary = dict(station_id=sid, year=year, period=period, expected_days=len(subset))
                for var, field in VARIABLES.items():
                    valid = sum(r[field] is not None for r in subset)
                    summary[f'{var.lower()}_usable_days'] = valid
                    summary[f'{var.lower()}_coverage_pct'] = round(100*valid/len(subset),4)
                for field in LABELS:
                    for status, value in [('true',True),('false',False),('unknown',None)]:
                        summary[f'{field}_{status}_days'] = sum(r[field] is value for r in subset)
                summaries.append(summary)
        sources.append(dict(station_id=sid, filename=path.name, sha256=digest))
    assert len(daily) == 40180 and len(summaries) == 220
    args.output_dir.mkdir(parents=True,exist_ok=True)
    write_csv(args.output_dir/'daily_weather.csv',daily)
    write_csv(args.output_dir/'seasonal_summary.csv',summaries)
    metadata = dict(period='2004-01-01/2025-12-31', stations=VERIFY.STATIONS, rows=len(daily),
        thresholds=dict(freezing_tmin_below_c=0,hot_tmax_at_least_c=args.hot_c,wet_prcp_at_least_mm=args.wet_mm,
                        heavy_prcp_at_least_mm=args.heavy_mm,prolonged_wet_minimum_days=args.wet_days),
        boolean_encoding='true/false; empty CSV cells represent null (unknown)',
        sources=sources,status_counts={v:dict(Counter(r[f'{v.lower()}_status'] for r in daily)) for v in VARIABLES},
        notes='See progress-note/NOAA_Cleaning.md for rules and analytical context.')
    (args.output_dir/'processing_metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print(json.dumps(dict(rows=len(daily),station_count=5,summary_rows=len(summaries),status_counts=metadata['status_counts']),indent=2))


if __name__ == '__main__':
    main()
