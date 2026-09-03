"""
Validation and Normalization Rules for SIF Intelligence.

Enforces taxonomy validation, deduplication, string normalization,
and constraint checks across extracted safety report entities.
Loads canonical taxonomy from data/taxonomy.json.
"""
import json
import logging
from pathlib import Path
from typing import List, Any, Optional, Union, Dict

logger = logging.getLogger("sif_intelligence.rules")

# ---------------------------------------------------------------------------
# Taxonomy Loading
# ---------------------------------------------------------------------------
_taxonomy_cache: Optional[Dict[str, List[str]]] = None


def load_taxonomy() -> Dict[str, List[str]]:
    """
    Loads and caches the taxonomy from data/taxonomy.json.
    Returns dict with keys: 'life_saving_rules', 'sif_precursors'.
    """
    global _taxonomy_cache
    if _taxonomy_cache is not None:
        return _taxonomy_cache

    taxonomy_path = Path(__file__).resolve().parent / "data" / "taxonomy.json"
    try:
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _taxonomy_cache = {
            "life_saving_rules": data.get("life_saving_rules", STANDARD_LIFE_SAVING_RULES),
            "sif_precursors": data.get("sif_precursors", []),
        }
        logger.info(f"Taxonomy loaded: {len(_taxonomy_cache['life_saving_rules'])} LSRs, "
                     f"{len(_taxonomy_cache['sif_precursors'])} precursors")
    except Exception as e:
        logger.warning(f"Failed to load taxonomy.json: {e}. Using built-in defaults.")
        _taxonomy_cache = {
            "life_saving_rules": list(STANDARD_LIFE_SAVING_RULES),
            "sif_precursors": list(STANDARD_SIF_PRECURSORS),
        }
    return _taxonomy_cache


# Standard Life-Saving Rules (IOGP & Industry benchmark taxonomy)
STANDARD_LIFE_SAVING_RULES: List[str] = [
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
]

# Standard SIF Precursors
STANDARD_SIF_PRECURSORS: List[str] = [
    "Falls from Height",
    "Struck-By",
    "Caught-In / Caught-Between",
    "Line of Fire",
    "Dropped Object",
    "Hazardous Energy",
    "Energy Isolation Failure",
    "Confined Space",
    "Vehicle / Mobile Equipment Interaction",
    "Lifting / Rigging Failure",
    "Hot Work",
    "Pressure Release",
    "Process Safety / Loss of Primary Containment",
    "Bypassed / Inadequate Critical Control",
]


# ---------------------------------------------------------------------------
# Normalization Utilities
# ---------------------------------------------------------------------------
def normalize_string(value: Optional[str], default: str = "") -> str:
    """Normalizes string input by stripping whitespace or returning default."""
    if value is None:
        return default
    cleaned = str(value).strip()
    return cleaned if cleaned else default


def clean_and_deduplicate_list(items: Optional[List[Any]]) -> List[str]:
    """
    Removes empty/whitespace-only items and duplicates while preserving original order.
    """
    if not items:
        return []

    seen = set()
    cleaned_items: List[str] = []
    for item in items:
        if item is None:
            continue
        cleaned = str(item).strip()
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            cleaned_items.append(cleaned)
    return cleaned_items


# ---------------------------------------------------------------------------
# Taxonomy Validation
# ---------------------------------------------------------------------------
def _fuzzy_match_taxonomy(value: str, canonical_list: List[str]) -> Optional[str]:
    """
    Attempts to match a value against a canonical taxonomy list.
    Tries exact match first, then case-insensitive, then substring containment.
    Returns the canonical name if matched, None otherwise.
    """
    value_lower = value.strip().lower()
    SYNONYM_MAP = {
        "lifting": "Safe Mechanical Lifting",
        "crane": "Safe Mechanical Lifting",
        "rigging": "Safe Mechanical Lifting",
        "mechanical lifting": "Safe Mechanical Lifting",
        "crane lifting": "Safe Mechanical Lifting",
        "height": "Working at Height",
        "falls from height": "Working at Height",
        "fall from height": "Working at Height",
        "fall from elevation": "Working at Height",
        "isolation": "Energy Isolation",
        "loto": "Energy Isolation",
        "lockout tagout": "Energy Isolation",
        "lockout/tagout": "Energy Isolation",
        "zero energy": "Energy Isolation",
        "permit to work": "Work Authorization",
        "ptw": "Work Authorization",
        "jsa": "Work Authorization",
        "authorization": "Work Authorization",
        "h2s": "Toxic / Hazardous Substances",
        "toxic gas": "Toxic / Hazardous Substances",
        "chemical": "Toxic / Hazardous Substances",
        "hazardous substances": "Toxic / Hazardous Substances",
        "dropped objects": "Dropped Object",
        "falling object": "Dropped Object",
        "loss of primary containment": "Process Safety / Loss of Primary Containment",
        "lopc": "Process Safety / Loss of Primary Containment",
        "containment loss": "Process Safety / Loss of Primary Containment",
        "vehicle interaction": "Vehicle / Mobile Equipment Interaction",
        "vehicle": "Driving",
    }

    # Check direct synonym lookup
    if value_lower in SYNONYM_MAP:
        target = SYNONYM_MAP[value_lower]
        if target in canonical_list:
            return target

    # Exact case-insensitive match
    for canonical in canonical_list:
        if value_lower == canonical.lower():
            return canonical

    # Substring containment (canonical in value or value in canonical)
    for canonical in canonical_list:
        canonical_lower = canonical.lower()
        if canonical_lower in value_lower or value_lower in canonical_lower:
            return canonical

    return None


def validate_life_saving_rules(rules: Optional[List[str]]) -> List[str]:
    """
    Validates and canonicalizes Life-Saving Rules against the taxonomy.
    Non-matching rules are dropped (not invented by the system).
    """
    taxonomy = load_taxonomy()
    canonical_lsr_list = taxonomy["life_saving_rules"]
    cleaned_rules = clean_and_deduplicate_list(rules)
    canonical_rules: List[str] = []

    for rule in cleaned_rules:
        match = _fuzzy_match_taxonomy(rule, canonical_lsr_list)
        if match and match not in canonical_rules:
            canonical_rules.append(match)
        else:
            # Log but drop non-matching rules to avoid hallucination
            if not match:
                logger.info(f"Dropping non-canonical Life-Saving Rule: '{rule}'")

    return canonical_rules


def validate_sif_precursors(precursors: Optional[List[str]]) -> List[str]:
    """
    Validates and canonicalizes SIF precursors against the taxonomy.
    Non-matching precursors are dropped.
    """
    taxonomy = load_taxonomy()
    canonical_precursor_list = taxonomy["sif_precursors"]
    cleaned_precursors = clean_and_deduplicate_list(precursors)
    canonical_precursors: List[str] = []

    for precursor in cleaned_precursors:
        match = _fuzzy_match_taxonomy(precursor, canonical_precursor_list)
        if match and match not in canonical_precursors:
            canonical_precursors.append(match)
        else:
            if not match:
                logger.info(f"Dropping non-canonical SIF precursor: '{precursor}'")

    return canonical_precursors


# ---------------------------------------------------------------------------
# Score / Confidence Validation
# ---------------------------------------------------------------------------
def validate_risk_score(score: Union[int, float]) -> int:
    """Validates and clamps risk score to integer between 0 and 100."""
    try:
        val = int(round(float(score)))
        return max(0, min(100, val))
    except (ValueError, TypeError):
        return 0


def validate_confidence(confidence: Union[int, float], default: float = 0.85) -> float:
    """Validates and clamps confidence score between 0.0 and 1.0."""
    try:
        val = float(confidence)
        val = max(0.0, min(1.0, val))
        return round(val, 2)
    except (ValueError, TypeError):
        return default