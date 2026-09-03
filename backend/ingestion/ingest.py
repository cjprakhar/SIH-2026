"""
ingest.py — CLI entry point and orchestrator for SIF Intelligence data ingestion.

Usage (from backend/ directory):
    python -m ingestion.ingest                      # full ingestion
    python -m ingestion.ingest --dry-run            # show examples only, no write
    python -m ingestion.ingest --pdf-only           # PDFs only
    python -m ingestion.ingest --csv-only           # CSV only
    python -m ingestion.ingest --limit 500          # cap records per source (debug)

Output: backend/data/reports.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

from .csv_parser import extract_csv_records
from .deduplicator import dedup_stats, deduplicate
from .normalizer import reset_pdf_counters
from .pdf_parser import SKIP_PDF_STEMS, extract_all_pdfs, extract_pdf_records

# ---------------------------------------------------------------------------
# Paths (relative to backend/)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent.parent  # backend/
PDF_DIR = BASE_DIR / "data" / "raw" / "pdf"
CSV_PATH = BASE_DIR / "data" / "csv" / "January2015toNovember2025.csv"
OUTPUT_PATH = BASE_DIR / "data" / "reports.json"
REFERENCE_DIR = BASE_DIR / "data" / "reference"  # never touched


# ---------------------------------------------------------------------------
# Pre-ingestion summary
# ---------------------------------------------------------------------------

def print_source_summary() -> None:
    print("\n" + "=" * 60)
    print("SIF INTELLIGENCE — DATA INGESTION")
    print("=" * 60)

    print("\n[1] PDF SOURCE FILES")
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    for f in pdf_files:
        stem = f.stem
        size_kb = f.stat().st_size // 1024
        status = "SKIP (no incident records)" if stem in SKIP_PDF_STEMS else "OK"
        print(f"    {f.name:<25}  {size_kb:>6} KB  [{status}]")

    print(f"\n[2] CSV SOURCE FILE")
    if CSV_PATH.exists():
        size_mb = CSV_PATH.stat().st_size / (1024 * 1024)
        print(f"    {CSV_PATH.name:<45}  {size_mb:.1f} MB")
    else:
        print(f"    NOT FOUND: {CSV_PATH}")

    print(f"\n[3] REFERENCE (excluded — never processed)")
    for f in REFERENCE_DIR.glob("*.pdf"):
        print(f"    {f.name}")

    print(f"\n[4] OUTPUT")
    print(f"    {OUTPUT_PATH}")
    print()


# ---------------------------------------------------------------------------
# Dry-run: show example normalized records
# ---------------------------------------------------------------------------

def print_dry_run_examples() -> None:
    print("\n" + "=" * 60)
    print("DRY RUN — EXAMPLE NORMALIZED RECORDS")
    print("=" * 60)

    reset_pdf_counters()

    # --- PDF examples: pick first 2 PDF files with records ---
    print("\n--- Example PDF records (first 2 per file) ---\n")
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    pdf_examples_done = 0
    for pdf_file in pdf_files:
        if pdf_file.stem in SKIP_PDF_STEMS:
            continue
        count = 0
        for rec in extract_pdf_records(pdf_file):
            print(json.dumps(rec, indent=2, ensure_ascii=False))
            print()
            count += 1
            if count >= 2:
                break
        if count > 0:
            pdf_examples_done += 1
        if pdf_examples_done >= 2:
            break

    # --- CSV examples: first 2 rows ---
    if CSV_PATH.exists():
        print("\n--- Example CSV records (first 2 rows) ---\n")
        count = 0
        for rec in extract_csv_records(CSV_PATH):
            print(json.dumps(rec, indent=2, ensure_ascii=False))
            print()
            count += 1
            if count >= 2:
                break


# ---------------------------------------------------------------------------
# Full ingestion
# ---------------------------------------------------------------------------

def run_ingestion(
    include_pdf: bool = True,
    include_csv: bool = True,
    limit: int = 0,
    output_path: Path = OUTPUT_PATH,
) -> list[dict]:
    reset_pdf_counters()
    all_records: list[dict] = []
    type_counter: Counter = Counter()

    t0 = time.time()

    # --- PDFs ---
    if include_pdf:
        print("\n[PDF] Extracting PDF records...")
        for rec in extract_all_pdfs(PDF_DIR):
            all_records.append(rec)
            type_counter[rec["source_type"]] += 1
            if limit and type_counter.get("pdf_total_tmp", 0) >= limit:
                break

    pdf_count = sum(v for k, v in type_counter.items() if k.startswith("pdf_"))
    print(f"  -> {pdf_count:,} PDF records extracted")

    # --- CSV ---
    if include_csv and CSV_PATH.exists():
        print("\n[CSV] Extracting CSV records...")
        csv_count = 0
        for rec in extract_csv_records(CSV_PATH):
            all_records.append(rec)
            type_counter[rec["source_type"]] += 1
            csv_count += 1
            if limit and csv_count >= limit:
                print(f"  -> CSV limit reached at {limit:,} rows")
                break
        print(f"  -> {csv_count:,} CSV records extracted")
    elif include_csv:
        print(f"  [WARN] CSV not found: {CSV_PATH}")

    # --- Deduplicate ---
    print(f"\n[DEDUP] Deduplicating {len(all_records):,} records...")
    before = len(all_records)
    all_records = deduplicate(all_records)
    after = len(all_records)
    print(f"  -> {dedup_stats(before, after)}")

    # --- Write output ---
    print(f"\n[WRITE] Saving to {output_path} ...")
    with open(str(output_path), "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    size_mb = output_path.stat().st_size / (1024 * 1024)
    elapsed = time.time() - t0

    # --- Final report ---
    print("\n" + "=" * 60)
    print("INGESTION COMPLETE")
    print("=" * 60)
    print(f"  Total records   : {len(all_records):,}")
    for stype, cnt in sorted(type_counter.items()):
        print(f"    {stype:<20}: {cnt:,}")
    print(f"  Output file     : {output_path}")
    print(f"  Output size     : {size_mb:.2f} MB")
    print(f"  Time elapsed    : {elapsed:.1f}s")
    print("=" * 60)

    return all_records


# ---------------------------------------------------------------------------
# Verification helpers
# ---------------------------------------------------------------------------

def verify_output(records: list[dict]) -> bool:
    """
    Verify that the output records are structurally sound.
    Returns True if all checks pass.
    """
    required_fields = {
        "report_id", "date", "year", "country", "region",
        "function", "activity", "cause", "life_saving_rules",
        "narrative", "what_went_wrong", "corrective_actions",
        "causal_factors", "source_file", "source_type",
        "source_year", "source_page",
    }
    print("\n[VERIFY] Checking output schema...")
    errors = 0
    for i, rec in enumerate(records[:200]):  # sample first 200
        missing = required_fields - set(rec.keys())
        if missing:
            print(f"  [!] Record {i} missing fields: {missing}")
            errors += 1
        if not isinstance(rec.get("life_saving_rules"), list):
            print(f"  [!] Record {i}: life_saving_rules not a list")
            errors += 1
        if not isinstance(rec.get("causal_factors"), list):
            print(f"  [!] Record {i}: causal_factors not a list")
            errors += 1

    if errors == 0:
        print("  -> All schema checks passed.")
        return True
    else:
        print(f"  -> {errors} schema issues found.")
        return False


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SIF Intelligence — Historical Data Ingestion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m ingestion.ingest                  Full ingestion (PDF + CSV)
  python -m ingestion.ingest --dry-run        Show example records only
  python -m ingestion.ingest --pdf-only       PDFs only
  python -m ingestion.ingest --csv-only       CSV only
  python -m ingestion.ingest --limit 100      Cap per source (debug)
        """,
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show example records only; do not write output")
    parser.add_argument("--pdf-only", action="store_true",
                        help="Process PDF files only (skip CSV)")
    parser.add_argument("--csv-only", action="store_true",
                        help="Process CSV only (skip PDFs)")
    parser.add_argument("--limit", type=int, default=0, metavar="N",
                        help="Limit records per source (0 = no limit; useful for testing)")
    parser.add_argument("--output", type=str, default=str(OUTPUT_PATH),
                        help=f"Output path (default: {OUTPUT_PATH})")
    args = parser.parse_args()

    print_source_summary()

    if args.dry_run:
        print_dry_run_examples()
        print("\n[DRY RUN] No output written.")
        return

    include_pdf = not args.csv_only
    include_csv = not args.pdf_only
    output_path = Path(args.output)

    records = run_ingestion(
        include_pdf=include_pdf,
        include_csv=include_csv,
        limit=args.limit,
        output_path=output_path,
    )

    verify_output(records)


if __name__ == "__main__":
    main()
