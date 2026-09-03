"""
pdf_parser.py — Extract individual incident records from IOGP PDF reports.

Handles 3 structural types:
  Type A: Fatal Incident Reports       (*sf.pdf  2021-2025)
  Type B: High Potential Event Reports (*sh.pdf  2021-2023)
  Type C: Process Safety Events        (*pfh.pdf 2020, 2025)

Records span page boundaries. Strategy:
  1. Extract all page texts.
  2. Concatenate into one full-document string, with page-break markers.
  3. Split on DATE: boundaries to isolate individual records.
  4. Parse each record's fields.
  5. Assign source_page = page number where DATE: first appeared.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterator, Optional

import pdfplumber

from .normalizer import (
    clean_or_null,
    clean_placeholder_null,
    empty_record,
    make_pdf_report_id,
    normalize_lsr_list,
    parse_date,
)

# ---------------------------------------------------------------------------
# PDF files to skip (no individual incident records)
# ---------------------------------------------------------------------------
SKIP_PDF_STEMS = {"2024f", "2024fe", "459"}

# ---------------------------------------------------------------------------
# Source-type detection from filename stem
# ---------------------------------------------------------------------------

def _detect_source_type(stem: str) -> str:
    s = stem.lower()
    if s.endswith("sf"):
        return "pdf_fatal"
    if s.endswith("sh"):
        return "pdf_hipot"
    if "pfh" in s or s.endswith("f") or s.endswith("fe"):
        return "pdf_pse"
    return "pdf_unknown"


def _detect_source_year(stem: str) -> Optional[int]:
    m = re.match(r"(\d{4})", stem)
    return int(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# Region header patterns (sticky context)
# ---------------------------------------------------------------------------
_REGION_HEADERS = re.compile(
    r"^(AFRICA(?:\s*/\s*|\s+)(?:ONSHORE|OFFSHORE)"
    r"|ASIA(?:\s*/\s*AUSTRALASIA)?(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|EUROPE(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|MIDDLE\s+EAST(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|NORTH\s+AMERICA(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|RUSSIA\s+(?:&|AND|\\&)\s+CENTRAL\s+ASIA(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|SOUTH\s+(?:&|AND|\\&)\s+CENTRAL\s+AMERICA(?:\s+ONSHORE|\s+OFFSHORE)"
    r"|GLOBAL)$",
    re.IGNORECASE | re.MULTILINE,
)

def _title_case_region(raw: str) -> str:
    """Convert 'AFRICA ONSHORE' -> 'Africa Onshore'."""
    return " ".join(w.capitalize() for w in raw.strip().split())


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------

# A DATE: line starts a new record
_DATE_LINE = re.compile(
    r"DATE\s*:\s*(.+?)(?:\n|$)", re.IGNORECASE
)

# Page-break sentinel injected during text join
_PAGE_BREAK = "\x0c"  # form-feed


def _extract_field(text: str, *labels: str) -> Optional[str]:
    """
    Extract the value after the first matching label from text block.
    Stops at next uppercase label line or page break.
    Handles both 'LABEL: value' (same line) and multi-line values.
    """
    for label in labels:
        # Escape the label for regex; allow : or ; as separator
        escaped = re.escape(label)
        pattern = re.compile(
            rf"(?:^|\n){escaped}\s*[:;]\s*(.*?)(?=\n[A-Z][A-Z\s/\(\)&]*[:;]|\Z)",
            re.IGNORECASE | re.DOTALL,
        )
        m = pattern.search(text)
        if m:
            return m.group(1).strip() or None
    return None


def _extract_list_field(text: str, *labels: str) -> list[str]:
    """
    Extract a bullet-list field. Each non-empty line after the label
    (until next uppercase header) becomes a list item.
    """
    raw = _extract_field(text, *labels)
    if not raw:
        return []
    lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
    # Remove lines that look like a new section header
    items = []
    for ln in lines:
        if re.match(r"^[A-Z][A-Z\s/\(\)&]*[:;]\s*$", ln):
            break
        # Strip leading bullet chars
        item = re.sub(r"^[\-\*\u2022\u2013\u2014\u25cf]+\s*", "", ln).strip()
        if item:
            items.append(item)
    return items


def _extract_lsr(text: str, source_type: str) -> list[str]:
    """
    Extract Life-Saving Rules from record text.
    Handles: RULE: / PRIMARY LIFE-SAVING RULE: / SECONDARY LIFE-SAVING RULE:
    Also handles typo: SECONARY LIFE-SAVING RULE:
    PSE records use PROCESS SAFETY FUNDAMENTAL: (not LSR).
    """
    raw_lsrs: list[str] = []

    # Single RULE: field (2021-2022 sf/sh)
    rule_val = _extract_field(text, "RULE")
    if rule_val:
        raw_lsrs.append(rule_val)

    # Primary / Secondary (2023+ sf)
    primary = _extract_field(
        text,
        "PRIMARY LIFE-SAVING RULE",
        "PRIMARY LIFE SAVING RULE",
    )
    if primary:
        raw_lsrs.append(primary)

    secondary = _extract_field(
        text,
        "SECONDARY LIFE-SAVING RULE",
        "SECONARY LIFE-SAVING RULE",
        "SECONDARY LIFE SAVING RULE",
    )
    if secondary:
        raw_lsrs.append(secondary)

    return normalize_lsr_list(raw_lsrs)


# ---------------------------------------------------------------------------
# Page-level region tracking
# ---------------------------------------------------------------------------

def _find_region_in_text(text: str) -> Optional[str]:
    """Find the last region header in a page's text."""
    matches = list(_REGION_HEADERS.finditer(text))
    if matches:
        return _title_case_region(matches[-1].group(0))
    return None


# ---------------------------------------------------------------------------
# Core parsing: full document -> records
# ---------------------------------------------------------------------------

def _split_into_record_blocks(full_text: str) -> list[tuple[str, int]]:
    """
    Split the full concatenated document text into per-record blocks.
    Returns list of (block_text, approx_start_char_offset).

    Strategy: find all DATE: positions, slice between them.
    """
    # Find all DATE: anchors
    date_positions = [m.start() for m in re.finditer(
        r"(?:^|\n)DATE\s*:\s*", full_text, re.IGNORECASE
    )]

    if not date_positions:
        return []

    blocks = []
    for i, start in enumerate(date_positions):
        end = date_positions[i + 1] if i + 1 < len(date_positions) else len(full_text)
        # Include some preceding context (region header etc.) — go back up to 300 chars
        context_start = max(0, start - 300)
        # But don't overlap with previous block's DATE:
        if i > 0:
            context_start = max(context_start, date_positions[i - 1] + 10)
        blocks.append((full_text[context_start:end], start))
    return blocks


def _build_page_offset_map(page_texts: list[str]) -> list[int]:
    """
    Build a list of character offsets where each page starts in the
    concatenated document string.
    """
    offsets = []
    pos = 0
    for text in page_texts:
        offsets.append(pos)
        pos += len(text) + 1  # +1 for newline separator
    return offsets


def _char_offset_to_page(offset: int, page_offsets: list[int]) -> int:
    """Convert character offset to 1-indexed page number."""
    for i in range(len(page_offsets) - 1, -1, -1):
        if offset >= page_offsets[i]:
            return i + 1
    return 1


# ---------------------------------------------------------------------------
# Record parser
# ---------------------------------------------------------------------------

def _parse_record_block(
    block: str,
    current_region: Optional[str],
    source_file: str,
    source_type: str,
    source_year: Optional[int],
    source_page: int,
    stem: str,
) -> Optional[dict]:
    """Parse a single record block into a normalized dict."""
    rec = empty_record()
    rec["source_file"] = source_file
    rec["source_type"] = source_type
    rec["source_year"] = source_year
    rec["source_page"] = source_page

    # --- Region: check block text first, fall back to sticky context ---
    block_region = _find_region_in_text(block)
    region = block_region or current_region
    rec["region"] = region

    # --- DATE ---
    date_raw = _extract_field(block, "DATE")
    date_str, year = parse_date(date_raw)
    rec["date"] = date_str
    rec["year"] = year or source_year

    # --- COUNTRY ---
    rec["country"] = clean_or_null(_extract_field(block, "COUNTRY"))

    # --- FUNCTION (handles both : and ; separator via _extract_field) ---
    func_val = _extract_field(block, "FUNCTION")
    rec["function"] = clean_or_null(func_val)

    # --- ACTIVITY ---
    rec["activity"] = clean_or_null(_extract_field(block, "ACTIVITY"))

    # --- CAUSE ---
    rec["cause"] = clean_or_null(_extract_field(block, "CAUSE"))

    # --- LIFE-SAVING RULES ---
    rec["life_saving_rules"] = _extract_lsr(block, source_type)

    # --- NARRATIVE / INCIDENT DESCRIPTION ---
    # For PSE records (2020pfh), WHAT WENT WRONG? is often embedded inline
    # inside the narrative. Strip it so it doesn't pollute the narrative field.
    narrative = _extract_field(block, "NARRATIVE") or _extract_field(
        block, "INCIDENT DESCRIPTION", "INCIDENT DESCRIPTI"
    )
    if narrative:
        # Remove embedded 'WHAT WENT WRONG?:' tail from narrative
        narrative = re.split(
            r"WHAT WENT WRONG\??\s*[:\-]", narrative, maxsplit=1, flags=re.IGNORECASE
        )[0].strip()
        # Strip page-header contamination (e.g., '5 2021 safety data ...')
        narrative = re.sub(r"\d+\s+\d{4}\s+safety data[^\n]*", "", narrative, flags=re.IGNORECASE).strip()
    rec["narrative"] = clean_or_null(narrative)

    # --- WHAT WENT WRONG ---
    # For PSE records (2020pfh), this field is sometimes embedded inline
    # inside the narrative text as 'WHAT WENT WRONG?: ...'
    wwwong_raw = _extract_field(block, "WHAT WENT WRONG", "WHAT WENT WRONG?")
    if wwwong_raw:
        # Strip page-header contamination that can bleed in
        wwwong_raw = re.sub(
            r"\d+\s+(?:Tier\s+\d+\s+PSE|Safety\s+performance)[^\n]*",
            "",
            wwwong_raw,
            flags=re.IGNORECASE,
        ).strip()
    rec["what_went_wrong"] = clean_placeholder_null(wwwong_raw)

    # --- CORRECTIVE ACTIONS ---
    ca_raw = _extract_field(
        block,
        "CORRECTIVE ACTIONS AND RECOMMENDATIONS",
        "CORRECTIVE ACTIONS & RECOMMENDATIONS",
        "CORRECTIVE ACTIONS AND RECOMMENDA",
    )
    rec["corrective_actions"] = clean_placeholder_null(ca_raw)

    # --- CAUSAL FACTORS ---
    causal_raw = _extract_field(block, "CAUSAL FACTORS")
    if causal_raw:
        # Join wrapped lines: a continuation line starts lowercase or with a
        # known prefix (PEOPLE/PROCESS) – merge non-header lines into the prev
        raw_lines = causal_raw.splitlines()
        merged: list[str] = []
        for ln in raw_lines:
            s = ln.strip()
            if not s:
                continue
            if s.upper().startswith("NO CAUSAL"):
                continue
            # If line starts with uppercase taxonomy keyword it's a new item
            if re.match(r"^(PEOPLE|PROCESS|ORGANIZATION|MANAGEMENT)", s, re.IGNORECASE):
                merged.append(s)
            elif merged:
                # Continuation of previous line
                merged[-1] = merged[-1].rstrip("/").rstrip() + s
            else:
                merged.append(s)
        rec["causal_factors"] = [i for i in merged if i]
    else:
        rec["causal_factors"] = []

    # --- Skip records with no meaningful content ---
    if not rec["country"] and not rec["narrative"] and not rec["date"]:
        return None

    # --- report_id ---
    rec["report_id"] = make_pdf_report_id(stem, region)

    return rec


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_pdf_records(pdf_path: str | Path) -> Iterator[dict]:
    """
    Extract all normalized incident records from a single IOGP PDF file.
    Yields dicts conforming to the canonical schema.
    Skips non-incident PDFs silently (with a print warning).
    """
    pdf_path = Path(pdf_path)
    stem = pdf_path.stem  # e.g., "2023sf"

    if stem in SKIP_PDF_STEMS:
        print(f"  [SKIP] {pdf_path.name} — no individual incident records")
        return

    source_file = pdf_path.name
    source_type = _detect_source_type(stem)
    source_year = _detect_source_year(stem)

    print(f"  [PDF ] {source_file}  type={source_type}  year={source_year}")

    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            page_texts: list[str] = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                page_texts.append(text)
    except Exception as exc:
        print(f"  [ERROR] Failed to read {source_file}: {exc}")
        return

    page_offsets = _build_page_offset_map(page_texts)
    full_text = "\n".join(page_texts)

    # Sticky region context
    current_region: Optional[str] = None
    # Update region from each page header before splitting
    for text in page_texts:
        r = _find_region_in_text(text)
        if r:
            current_region = r

    blocks = _split_into_record_blocks(full_text)

    if not blocks:
        print(f"  [WARN] No DATE: anchors found in {source_file}")
        return

    # Reset sticky region to scan again during record parsing
    current_region = None

    for block_text, char_offset in blocks:
        # Determine which page this record starts on
        source_page = _char_offset_to_page(char_offset, page_offsets)

        # Update sticky region from block context
        r = _find_region_in_text(block_text)
        if r:
            current_region = r

        record = _parse_record_block(
            block=block_text,
            current_region=current_region,
            source_file=source_file,
            source_type=source_type,
            source_year=source_year,
            source_page=source_page,
            stem=stem,
        )
        if record:
            yield record


def extract_all_pdfs(pdf_dir: str | Path) -> Iterator[dict]:
    """
    Iterate over all PDF files in pdf_dir and yield normalized records.
    Skips reference PDFs and aggregate-only PDFs automatically.
    """
    pdf_dir = Path(pdf_dir)
    pdf_files = sorted(pdf_dir.glob("*.pdf"))

    if not pdf_files:
        print(f"  [WARN] No PDF files found in {pdf_dir}")
        return

    for pdf_file in pdf_files:
        yield from extract_pdf_records(pdf_file)
