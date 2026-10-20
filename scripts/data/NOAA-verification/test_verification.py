"""Focused checks for calendar handling and silent-data-loss risks."""
import unittest
from datetime import date
from pathlib import Path
from verification20years import parse_file, summarize


def record(variable='PRCP', value=10, qflag=' ', mflag=' ', year=2004, month=2):
    return f'USW00014897{year:04}{month:02}{variable}' + f'{value:5}{mflag}{qflag}7'*31


class CompletenessTests(unittest.TestCase):
    def parse(self, text):
        class TextFixture:
            name = 'fixture.dly'

            def read_text(self, encoding):
                return text

        return parse_file(TextFixture(), 'USW00014897', 2004, 2025)

    def test_single_year_filter(self):
        class TextFixture:
            name = 'fixture.dly'

            def read_text(self, encoding):
                return record(year=2004) + '\n' + record(year=2025)

        obs, months, _ = parse_file(TextFixture(), 'USW00014897', 2025, 2025)
        self.assertEqual(len(obs), 28)
        self.assertEqual(months, {(2025, 2, 'PRCP')})

    def test_leap_day_and_absent_months(self):
        obs, months, _ = self.parse(record())
        self.assertIn((date(2004,2,29), 'PRCP'), obs)
        summary = summarize(obs, months, 2004, 'PRCP', 'Annual', .95)
        self.assertEqual(summary['expected_days'], 366)
        self.assertEqual(summary['usable_days'], 29)
        self.assertEqual(summary['missing_days'], 337)
        self.assertEqual(summary['longest_unusable_run'], 306)
        self.assertEqual(len(summary['missing_months']), 11)

    def test_quality_missing_and_trace_are_distinct(self):
        obs, months, _ = self.parse(record(qflag='X'))
        summary = summarize(obs, months, 2004, 'PRCP', 'Annual', .95)
        self.assertEqual(summary['quality_excluded_days'], 29)
        self.assertEqual(summary['usable_days'], 0)
        self.assertEqual(summary['longest_unusable_run'], 366)
        obs, months, _ = self.parse(record(value=-9999))
        self.assertEqual(summarize(obs, months, 2004, 'PRCP', 'Annual', .95)['missing_days'],366)
        obs, months, _ = self.parse(record(value=0, mflag='T'))
        summary = summarize(obs, months, 2004, 'PRCP', 'Annual', .95)
        self.assertEqual(summary['usable_days'], 29)
        self.assertEqual(summary['measurement_flags'], {'T':29})

    def test_duplicate_and_malformed_records_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.parse(record()+'\n'+record())
        with self.assertRaisesRegex(ValueError, '269'):
            self.parse(record()[:-1])

    def test_value_inconsistencies_are_reported(self):
        _, _, issues = self.parse(record(value=-1)+'\n'+record('TMAX',0)+'\n'+record('TMIN',10))
        self.assertEqual(sum(i['issue']=='negative_precipitation' for i in issues),29)
        self.assertEqual(sum(i['issue']=='tmax_below_tmin' for i in issues),29)


if __name__ == '__main__':
    unittest.main()
