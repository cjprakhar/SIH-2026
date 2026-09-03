"""
deduplicator.py — Deduplicate normalized incident records.

Strategy:
- PDF records: key = (date, country, cause, narrative_hash)
  PDF source files can overlap (e.g., same incident in 2021sf and 2021pfh)
- CSV records: key = report_id (OSHA IDs are inherently unique)
- Cross-source duplicates (PDF vs CSV): unlikely due to different taxonomies;
  not deduplicated to preserve source provenance.
"""

from __future__ import annotations

from typing import Optional

from .normalizer import narrative_hash


def _pdf_dedup_key(rec: dict) -> Optional[tuple]:
    """Generate a deduplication key for a PDF record."""
    date = rec.get("date") or ""
    country = (rec.get("country") or "").lower().strip()
    cause = (rec.get("cause") or "").lower().strip()
    nhash = narrative_hash(rec.get("narrative"))
    return (date, country, cause, nhash)


def deduplicate(records: list[dict]) -> list[dict]:
    """
    Deduplicate a list of normalized records.

    Rules:
    - CSV records (csv_osha): deduplicated by report_id only.
    - PDF records: deduplicated by (date, country, cause, narrative_hash).
    - PDF and CSV records are NOT cross-deduplicated.

    Returns deduplicated list preserving insertion order (first wins).
    """
    seen_csv_ids: set[str] = set()
    seen_pdf_keys: set[tuple] = set()
    result: list[dict] = []

    for rec in records:
        source_type = rec.get("source_type", "")

        if source_type == "csv_osha":
            rid = rec.get("report_id", "")
            if rid in seen_csv_ids:
                continue
            seen_csv_ids.add(rid)
            result.append(rec)

        else:
            # PDF record
            key = _pdf_dedup_key(rec)
            if key and key in seen_pdf_keys:
                continue
            if key:
                seen_pdf_keys.add(key)
            result.append(rec)

    return result


def dedup_stats(before: int, after: int) -> str:
    removed = before - after
    pct = (removed / before * 100) if before else 0
    return f"{before:,} -> {after:,} records ({removed:,} duplicates removed, {pct:.1f}%)"
