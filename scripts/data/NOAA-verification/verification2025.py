"""Check the final five stations for 2025 using the delivered NOAA raw files.

Adapted from the research-stage 2025 screening method. Shared validation logic
is in verification20years.py; keep both scripts in the same directory.

Requires Python 3.9+ with no third-party packages. Run from repository root:
    python scripts/data/NOAA-verification/verification2025.py
    python scripts/data/NOAA-verification/verification2025.py --output-dir ../research/noaa/verification_2025

Default input: data/NOAA/raw/ and its manifest, resolved from the repository
location. Full input checksums are verified before filtering to 2025.
Default output: data/NOAA/verification/verification2025/. Use --output-dir for
working results outside the repository. Reruns replace named output reports.
Accepts the same command-line options as verification20years.py; see that
file's header for output descriptions and coverage definitions. This checks
the final five stations, not the historical candidate pool. Raw data remain
unchanged, and no downloads or missing-value filling are performed.
"""
from verification20years import main


if __name__ == '__main__':
    main(default_start=2025, default_end=2025, output_name='verification2025')
