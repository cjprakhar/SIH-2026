"""
normalizer.py — Field normalization utilities for SIF Intelligence ingestion.

Handles:
- Date string parsing -> ISO 8601 date string + year integer
- Life-Saving Rule normalization (case, aliases, exclusions)
- Null/empty coercion
- report_id generation
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Known Life-Saving Rule canonical names (from taxonomy.json)
# ---------------------------------------------------------------------------
CANONICAL_LSR = {
    "Bypassing Safety Controls",
    "Confined Space",
    "Driving",
    "Energy Isolation",
    "Hot Work",
    "Line of Fire",
    "Safe Mechanical Lifting",
    "Toxic / Hazardous Substances",
    "Work Authorization",
    "Working at Height",
}

# Lower-cased lookup for fuzzy matching
_LSR_LOWER: dict[str, str] = {lsr.lower(): lsr for lsr in CANONICAL_LSR}

# Values that should be excluded from life_saving_rules output
_EXCLUDE_LSR = {
    "unspecified",
    "other",
    "other issue – no applicable rule",
    "other issue - no applicable rule",
    "not applicable",
    "",
}

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# Patterns encountered in PDFs:
#   "Aug 16 2021", "16 Aug 2021", "01 Aug 2022", "06 Apr 2022"
#   "26 Jun 2023", "02 Jan 2023", "04 Jan 2023", "14 Mar 2025"
# CSV format: "1/1/2015", "11/30/2025"
_DATE_FORMATS = [
    "%d %b %Y",   # 26 Jun 2023
    "%b %d %Y",   # Aug 16 2021
    "%d %B %Y",   # 26 June 2023
    "%B %d %Y",   # August 16 2021
    "%m/%d/%Y",   # 1/1/2015
    "%Y-%m-%d",   # ISO already
]


def parse_date(raw: Optional[str]) -> tuple[Optional[str], Optional[int]]:
    """
    Parse a raw date string into (ISO-8601 date string, year int).
    Returns (None, None) if parsing fails.
    """
    if not raw or not raw.strip():
        return None, None

    s = raw.strip()
    # Remove ordinal suffixes: 1st, 2nd, 3rd, 4th…
    s = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", s)

    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d"), dt.year
        except ValueError:
            continue

    # Last-resort: extract 4-digit year
    m = re.search(r"(\d{4})", s)
    if m:
        return None, int(m.group(1))

    return None, None


# ---------------------------------------------------------------------------
# Life-Saving Rule normalization
# ---------------------------------------------------------------------------

def normalize_lsr(raw_value: str) -> Optional[str]:
    """
    Normalize a single Life-Saving Rule string to its canonical form.
    Returns None if the value should be excluded.
    """
    if not raw_value:
        return None
    cleaned = raw_value.strip()
    # Remove leading bullet, dash, star
    cleaned = re.sub(r"^[\-\*\u2022\u2013\u2014]+\s*", "", cleaned).strip()

    if cleaned.lower() in _EXCLUDE_LSR:
        return None

    # Exact canonical match (case-insensitive)
    lower = cleaned.lower()
    if lower in _LSR_LOWER:
        return _LSR_LOWER[lower]

    # Partial/alias matching for known aliases
    aliases = {
        "energy isolation": "Energy Isolation",
        "work authorization": "Work Authorization",
        "working at height": "Working at Height",
        "work at height": "Working at Height",
        "work-at-height": "Working at Height",
        "hot work": "Hot Work",
        "driving": "Driving",
        "confined space": "Confined Space",
        "line of fire": "Line of Fire",
        "safe mechanical lifting": "Safe Mechanical Lifting",
        "mechanical lifting": "Safe Mechanical Lifting",
        "bypassing safety controls": "Bypassing Safety Controls",
        "bypassing safety control": "Bypassing Safety Controls",
        "bypass safety": "Bypassing Safety Controls",
        "toxic": "Toxic / Hazardous Substances",
        "hazardous substances": "Toxic / Hazardous Substances",
    }
    for alias, canonical in aliases.items():
        if alias in lower:
            return canonical

    # Return as-is if non-empty and non-excluded (may be novel LSR text)
    return cleaned if cleaned else None


def normalize_lsr_list(raw_list: list[str]) -> list[str]:
    """Normalize a list of raw LSR strings, deduplicating the result."""
    seen: set[str] = set()
    result: list[str] = []
    for raw in raw_list:
        norm = normalize_lsr(raw)
        if norm and norm not in seen:
            seen.add(norm)
            result.append(norm)
    return result


# ---------------------------------------------------------------------------
# String cleaning
# ---------------------------------------------------------------------------

def clean_text(s: Optional[str]) -> Optional[str]:
    """Strip, collapse internal whitespace, return None if empty."""
    if not s:
        return None
    result = re.sub(r"\s+", " ", s.strip())
    return result if result else None


def clean_or_null(s: Optional[str]) -> Optional[str]:
    """Return cleaned string or None."""
    return clean_text(s)


# Placeholder values that should be treated as null
_NULL_PLACEHOLDERS = {"-", "n/a", "none", "not applicable", "unspecified", "unknown"}


def clean_placeholder_null(s: Optional[str]) -> Optional[str]:
    """
    Return cleaned string or None.
    Also returns None for placeholder values like '-', 'N/A', 'Unspecified'.
    """
    cleaned = clean_text(s)
    if cleaned and cleaned.strip("-").strip().lower() in _NULL_PLACEHOLDERS:
        return None
    if cleaned and cleaned.strip() == "-":
        return None
    return cleaned


# ---------------------------------------------------------------------------
# report_id generation
# ---------------------------------------------------------------------------

_pdf_counters: dict[str, int] = {}


def make_pdf_report_id(source_stem: str, region: Optional[str]) -> str:
    """
    Generate a deterministic report_id for a PDF record.
    Format: {stem}-{region_code}-{seq:03d}
    e.g., 2023sf-AF-ON-001
    """
    region_code = _region_to_code(region)
    key = f"{source_stem}-{region_code}"
    _pdf_counters[key] = _pdf_counters.get(key, 0) + 1
    return f"{source_stem}-{region_code}-{_pdf_counters[key]:03d}"


def _region_to_code(region: Optional[str]) -> str:
    """Convert region string to compact code."""
    if not region:
        return "XX"
    tokens = region.upper().split()
    # Africa Onshore -> AF-ON, Middle East Offshore -> ME-OF, etc.
    mapping = {
        "AFRICA": "AF",
        "ASIA": "AS",
        "AUSTRALASIA": "AS",
        "ASIA/AUSTRALASIA": "AS",
        "EUROPE": "EU",
        "MIDDLE": "ME",
        "NORTH": "NA",
        "SOUTH": "SA",
        "CENTRAL": "CA",
        "RUSSIA": "RU",
        "ONSHORE": "ON",
        "OFFSHORE": "OF",
    }
    parts = [mapping.get(t, t[:2]) for t in tokens]
    return "-".join(parts[:3])


def reset_pdf_counters() -> None:
    """Reset per-source counters (call before each ingestion run)."""
    _pdf_counters.clear()


def narrative_hash(narrative: Optional[str]) -> str:
    """Short hash of first 120 chars of narrative for deduplication."""
    if not narrative:
        return ""
    snippet = (narrative or "")[:120].lower().strip()
    return hashlib.md5(snippet.encode("utf-8", errors="replace")).hexdigest()[:12]


# ---------------------------------------------------------------------------
# Canonical empty record
# ---------------------------------------------------------------------------

def empty_record() -> dict:
    return {
        "report_id": "",
        "date": None,
        "year": None,
        "country": None,
        "region": None,
        "function": None,
        "activity": None,
        "cause": None,
        "life_saving_rules": [],
        "narrative": None,
        "what_went_wrong": None,
        "corrective_actions": None,
        "causal_factors": [],
        "source_file": "",
        "source_type": "",
        "source_year": None,
        "source_page": None,
    }
