"""
csv_parser.py — Extract and normalize records from OSHA IMIS CSV.

Source: backend/data/csv/January2015toNovember2025.csv
  - 105,996 rows, 28 columns
  - US OSHA Severe Injury Reports (Jan 2015 – Nov 2025)
  - Streamed row-by-row to avoid loading 57 MB into RAM

Field mapping:
  ID           -> report_id (prefixed OSHA-)
  EventDate    -> date (ISO), year
  State        -> region
  country      -> always "United States"
  NatureTitle  -> cause
  EventTitle   -> activity
  Final Narrative -> narrative
  (no life_saving_rules, no function, no what_went_wrong,
   no corrective_actions, no causal_factors for OSHA records)
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterator

from .normalizer import clean_or_null, empty_record, parse_date

# ---------------------------------------------------------------------------
# Column index constants (from header inspection)
# ---------------------------------------------------------------------------
COL_ID = 0
COL_UPA = 1
COL_EVENT_DATE = 2
COL_EMPLOYER = 3
COL_ADDRESS1 = 4
COL_ADDRESS2 = 5
COL_CITY = 6
COL_STATE = 7
COL_ZIP = 8
COL_LATITUDE = 9
COL_LONGITUDE = 10
COL_NAICS = 11
COL_HOSPITALIZED = 12
COL_AMPUTATION = 13
COL_LOSS_OF_EYE = 14
COL_INSPECTION = 15
COL_NARRATIVE = 16
COL_NATURE = 17
COL_NATURE_TITLE = 18
COL_BODY = 19
COL_BODY_TITLE = 20
COL_EVENT = 21
COL_EVENT_TITLE = 22
COL_SOURCE = 23
COL_SOURCE_TITLE = 24
COL_SEC_SOURCE = 25
COL_SEC_SOURCE_TITLE = 26
COL_FEDERAL_STATE = 27

_SOURCE_FILE = "January2015toNovember2025.csv"
_SOURCE_TYPE = "csv_osha"


def _safe_col(row: list[str], index: int) -> str:
    """Safely get a column value from a row."""
    try:
        return row[index]
    except IndexError:
        return ""


def extract_csv_records(csv_path: str | Path) -> Iterator[dict]:
    """
    Stream-process the OSHA CSV and yield normalized incident records.
    Each row becomes one normalized dict. Rows with empty narratives
    are still included (narrative -> null) since other fields may be useful.
    """
    csv_path = Path(csv_path)
    print(f"  [CSV ] {csv_path.name}")

    row_num = 0
    with open(str(csv_path), "r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            print(f"  [ERROR] CSV file is empty: {csv_path.name}")
            return

        for row in reader:
            row_num += 1

            # Parse date
            date_raw = _safe_col(row, COL_EVENT_DATE)
            date_str, year = parse_date(date_raw)

            rec = empty_record()
            rec["report_id"] = f"OSHA-{_safe_col(row, COL_ID)}"
            rec["date"] = date_str
            rec["year"] = year
            rec["country"] = "United States"
            state_raw = _safe_col(row, COL_STATE)
            rec["region"] = clean_or_null(state_raw.title()) if state_raw else None
            rec["function"] = None
            rec["activity"] = clean_or_null(_safe_col(row, COL_EVENT_TITLE))
            rec["cause"] = clean_or_null(_safe_col(row, COL_NATURE_TITLE))
            rec["life_saving_rules"] = []
            rec["narrative"] = clean_or_null(_safe_col(row, COL_NARRATIVE))
            rec["what_went_wrong"] = None
            rec["corrective_actions"] = None
            rec["causal_factors"] = []
            rec["source_file"] = _SOURCE_FILE
            rec["source_type"] = _SOURCE_TYPE
            rec["source_year"] = year
            rec["source_page"] = None

            yield rec

    print(f"  [CSV ] {csv_path.name} — {row_num:,} rows processed")
