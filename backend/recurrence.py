"""
SIF Intelligence — Semantic Search & Multi-Dimensional Safety Recurrence Layer
=============================================================================

Architecture:
1. Sentence Embeddings: Lightweight all-MiniLM-L6-v2 model (384-dim).
2. Persistent Vector Index: FAISS IndexFlatIP (Cosine Similarity via L2 normalization).
3. Fast Metadata Lookup: Direct integer vector-ID -> Report metadata mapping.
4. Semantic Search: find_similar_reports() with cosine similarity thresholding.
5. Multi-Dimensional Safety Recurrence: Transparent scoring across 11 safety dimensions:
   - Life-Saving Rules
   - SIF Precursors
   - Hazards
   - Barriers / Failed Controls
   - Activities & Functions
   - Equipment
   - Exposures & People Involved
   - Consequences & Causes
   - Locations & Geography
   - Semantic Similarity
6. Pattern Discovery: discover_global_patterns() over historical incident clusters.
7. Safety Insights: get_safety_insights() aggregated dashboard intelligence.
8. Deterministic Risk Engine Integration: feeds risk_factors.recurring_pattern.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# Load .env BEFORE any HuggingFace/torch imports so HF_HOME and
# TRANSFORMERS_OFFLINE are applied before sentence-transformers resolves caches.
from dotenv import load_dotenv
load_dotenv()

import numpy as np

# Configure logging
logger = logging.getLogger("sif_intelligence.recurrence")

# Base directories
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
REPORTS_FILE = DATA_DIR / "reports.json"
TAXONOMY_FILE = DATA_DIR / "taxonomy.json"
INDEX_DIR = DATA_DIR / "index"
INDEX_FILE = INDEX_DIR / "faiss.index"
METADATA_FILE = INDEX_DIR / "metadata.json"
INDEX_INFO_FILE = INDEX_DIR / "index_info.json"
GLOBAL_PATTERNS_CACHE_FILE = INDEX_DIR / "global_patterns.json"
INSIGHTS_CACHE_FILE = INDEX_DIR / "insights.json"

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

# ---------------------------------------------------------------------------
# Keyword Taxonomy for Entity Extraction from Free Text
# ---------------------------------------------------------------------------
# Equipment keywords to detect from narrative/causal_factors text
_EQUIPMENT_KEYWORDS: List[Tuple[str, str]] = [
    ("electrical panel", "Electrical Panel"),
    ("circuit breaker", "Circuit Breaker"),
    ("lockout", "LOTO Locks"),
    ("tagout", "LOTO Tags"),
    ("scaffold", "Scaffold / Work Platform"),
    ("crane", "Crane / Hoist"),
    ("forklift", "Forklift"),
    ("excavator", "Excavator"),
    ("ladder", "Ladder"),
    ("harness", "Safety Harness"),
    ("sling", "Lifting Sling"),
    ("rigging", "Rigging Equipment"),
    ("valve", "Valve"),
    ("pressure vessel", "Pressure Vessel"),
    ("pipe", "Piping"),
    ("flange", "Flange"),
    ("vehicle", "Vehicle"),
    ("truck", "Truck"),
    ("pump", "Pump"),
    ("compressor", "Compressor"),
    ("grinder", "Grinder"),
    ("welder", "Welding Equipment"),
    ("torch", "Cutting Torch"),
    ("conveyor", "Conveyor"),
    ("tank", "Storage Tank"),
    ("drill", "Drill"),
    ("saw", "Saw"),
    ("generator", "Generator"),
    ("power tool", "Power Tool"),
    ("hand tool", "Hand Tool"),
]

# Hazard/exposure keywords to detect from causal_factors/narrative text
_HAZARD_KEYWORDS: List[Tuple[str, str]] = [
    ("fall", "Fall from Height"),
    ("struck", "Struck-By Object"),
    ("caught in", "Caught-In / Pinch Point"),
    ("electric", "Electrical Energy"),
    ("arc flash", "Arc Flash"),
    ("loto", "LOTO / Energy Isolation Failure"),
    ("lockout", "LOTO / Energy Isolation Failure"),
    ("energized", "Energized Equipment"),
    ("chemical", "Chemical Exposure"),
    ("toxic", "Toxic Substance"),
    ("flammable", "Flammable Atmosphere"),
    ("fire", "Fire / Flash Fire"),
    ("explosion", "Explosion"),
    ("pressure", "Pressure Release"),
    ("confined space", "Confined Space / Oxygen Deficiency"),
    ("asphyxia", "Asphyxiation"),
    ("oxygen", "Oxygen Deficiency"),
    ("drop", "Dropped Object"),
    ("overhead", "Overhead Hazard"),
    ("crush", "Crush Injury"),
    ("pinch", "Pinch Point"),
    ("heat", "Heat Stress"),
    ("burn", "Burn / Thermal Injury"),
    ("rollover", "Vehicle Rollover"),
    ("collision", "Vehicle Collision"),
    ("slip", "Slip / Trip"),
    ("noise", "Noise Exposure"),
    ("vibration", "Vibration Exposure"),
]

# Exposure keyword patterns (personnel roles)
_EXPOSURE_KEYWORDS: List[Tuple[str, str]] = [
    ("worker", "Worker"),
    ("employee", "Employee"),
    ("contractor", "Contractor"),
    ("technician", "Technician"),
    ("operator", "Operator"),
    ("electrician", "Electrician"),
    ("rigger", "Rigger"),
    ("driver", "Driver"),
    ("welder", "Welder"),
    ("mechanic", "Mechanic"),
    ("maintenance", "Maintenance Personnel"),
    ("supervisor", "Supervisor"),
    ("bystander", "Bystander"),
]


def _extract_keywords_from_text(text: str, keyword_map: List[Tuple[str, str]], max_results: int = 5) -> List[str]:
    """
    Extracts canonical terms from free-form text using keyword matching.
    Returns a list of matched canonical labels (deduplicated, preserving order).
    """
    if not text:
        return []
    text_lower = text.lower()
    results: List[str] = []
    seen: Set[str] = set()
    for kw, label in keyword_map:
        if kw in text_lower and label not in seen:
            results.append(label)
            seen.add(label)
        if len(results) >= max_results:
            break
    return results


def _clean_activity_string(activity: str, max_length: int = 60) -> str:
    """
    Truncates and cleans activity strings to remove excessively long OSHA-formatted entries
    that contain concatenated field data (e.g. 'PRIMARY LIFE-SAVING RULE: ...').
    """
    if not activity:
        return activity
    # Strip known contaminated suffixes from OSHA ingestion artifacts
    for marker in [" PRIMARY LIFE-SAVING RULE:", " SECONARY", " SECONDARY", " SIF PRECURSOR:"]:
        if marker in activity:
            activity = activity[:activity.index(marker)]
    return activity.strip()[:max_length] if len(activity) > max_length else activity.strip()

# Module-level singletons
_EMBEDDING_MODEL = None
_FAISS_INDEX = None
_INDEXED_METADATA: Optional[List[Dict[str, Any]]] = None
_REPORT_ID_TO_METADATA: Optional[Dict[str, Dict[str, Any]]] = None
_INDEX_INFO: Optional[Dict[str, Any]] = None
_GLOBAL_PATTERNS_CACHE: Optional[List[Dict[str, Any]]] = None
_INSIGHTS_CACHE: Optional[Dict[str, Any]] = None


# ============================================================================
# 1. Embedding Model Loader
# ============================================================================

def get_embedding_model(model_name: str = DEFAULT_MODEL_NAME):
    """
    Loads and caches the SentenceTransformer embedding model.
    Lightweight, fast for local CPU/GPU inference.
    """
    global _EMBEDDING_MODEL
    if _EMBEDDING_MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {model_name}...")
            _EMBEDDING_MODEL = SentenceTransformer(model_name)
            logger.info(f"Embedding model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load SentenceTransformer model '{model_name}': {e}")
            raise RuntimeError(f"SentenceTransformer embedding model error: {e}")
    return _EMBEDDING_MODEL


def build_report_embedding_text(report: Dict[str, Any]) -> str:
    """
    Constructs an informative text representation of a safety report for embedding:
    narrative + what_went_wrong + cause + activity + life_saving_rules.
    Handles missing fields safely without error.
    """
    parts = []

    narrative = report.get("narrative")
    if narrative and isinstance(narrative, str) and narrative.strip():
        parts.append(f"Narrative: {narrative.strip()}")

    what_went_wrong = report.get("what_went_wrong")
    if what_went_wrong and isinstance(what_went_wrong, str) and what_went_wrong.strip():
        parts.append(f"What went wrong: {what_went_wrong.strip()}")

    cause = report.get("cause")
    if cause and isinstance(cause, str) and cause.strip():
        parts.append(f"Cause: {cause.strip()}")

    activity = report.get("activity")
    if activity and isinstance(activity, str) and activity.strip():
        parts.append(f"Activity: {activity.strip()}")

    lsrs = report.get("life_saving_rules")
    if lsrs and isinstance(lsrs, list) and len(lsrs) > 0:
        valid_lsrs = [str(r).strip() for r in lsrs if r and str(r).strip()]
        if valid_lsrs:
            parts.append(f"Life-Saving Rules: {', '.join(valid_lsrs)}")

    causal = report.get("causal_factors")
    if causal and isinstance(causal, list) and len(causal) > 0:
        valid_causal = [str(c).strip() for c in causal if c and str(c).strip()]
        if valid_causal:
            parts.append(f"Causal factors: {'; '.join(valid_causal[:3])}")

    if not parts:
        return "Unspecified safety incident or near miss"

    return " | ".join(parts)


# ============================================================================
# 2. Persistent Vector Index Management (FAISS)
# ============================================================================

def _compute_file_fingerprint(filepath: Path) -> Dict[str, Any]:
    """Computes quick size and mtime fingerprint for change detection."""
    if not filepath.exists():
        return {"exists": False, "size": 0, "mtime": 0}
    stat = filepath.stat()
    return {
        "exists": True,
        "size": stat.st_size,
        "mtime": stat.st_mtime,
    }


def is_index_up_to_date(index_dir: Path = INDEX_DIR, reports_file: Path = REPORTS_FILE) -> bool:
    """Checks whether the persistent index exists and matches current reports.json."""
    if not (index_dir / "faiss.index").exists():
        return False
    if not (index_dir / "metadata.json").exists():
        return False
    if not (index_dir / "index_info.json").exists():
        return False

    try:
        with open(index_dir / "index_info.json", "r", encoding="utf-8") as f:
            info = json.load(f)
        current_fp = _compute_file_fingerprint(reports_file)
        saved_fp = info.get("dataset_fingerprint", {})

        if current_fp.get("size") != saved_fp.get("size"):
            return False
        if abs(current_fp.get("mtime", 0) - saved_fp.get("mtime", 0)) > 1.0:
            return False
        return True
    except Exception:
        return False


def build_index(
    reports_file: Path = REPORTS_FILE,
    index_dir: Path = INDEX_DIR,
    batch_size: int = 512,
    force_rebuild: bool = False,
    model_name: str = DEFAULT_MODEL_NAME,
) -> Dict[str, Any]:
    """
    Builds a persistent FAISS vector index for all reports in reports.json.
    - Processes embeddings in batches with progress logging.
    - Uses FAISS IndexFlatIP with L2 normalized vectors for exact Cosine Similarity.
    - Saves index, metadata, and index info to disk.
    """
    import faiss

    index_dir.mkdir(parents=True, exist_ok=True)

    if not force_rebuild and is_index_up_to_date(index_dir, reports_file):
        logger.info(f"Vector index is already up to date at: {index_dir}")
        return load_index(index_dir)

    if not reports_file.exists():
        raise FileNotFoundError(f"Reports file not found: {reports_file}")

    t0 = time.time()
    logger.info(f"Starting vector index build from {reports_file}...")

    # 1. Load reports
    with open(reports_file, "r", encoding="utf-8") as f:
        reports = json.load(f)

    if not isinstance(reports, list):
        raise ValueError(f"Expected list of reports in {reports_file}, got {type(reports)}")

    total_records = len(reports)
    logger.info(f"Loaded {total_records:,} safety records from {reports_file.name}")

    # 2. Build text representations and compact metadata
    metadata_list: List[Dict[str, Any]] = []
    text_corpus: List[str] = []

    for idx, r in enumerate(reports):
        text = build_report_embedding_text(r)
        text_corpus.append(text)

        # Keep a compact, memory-efficient metadata copy
        metadata_list.append({
            "report_id": r.get("report_id", f"REP-{idx:06d}"),
            "date": r.get("date"),
            "year": r.get("year"),
            "country": r.get("country"),
            "region": r.get("region"),
            "function": r.get("function"),
            "activity": r.get("activity"),
            "cause": r.get("cause"),
            "life_saving_rules": r.get("life_saving_rules", []),
            "narrative": r.get("narrative"),
            "what_went_wrong": r.get("what_went_wrong"),
            "corrective_actions": r.get("corrective_actions"),
            "causal_factors": r.get("causal_factors", []),
            "source_file": r.get("source_file", ""),
            "source_type": r.get("source_type", ""),
            "source_year": r.get("source_year"),
            "source_page": r.get("source_page"),
        })

    # Release original large JSON list
    del reports

    # 3. Batch Embeddings Generation
    import torch
    torch.set_num_threads(os.cpu_count() or 8)
    model = get_embedding_model(model_name)
    print(f"Generating embeddings for {total_records:,} records (threads={torch.get_num_threads()})...", flush=True)

    with torch.inference_mode():
        embeddings = model.encode(
            text_corpus,
            batch_size=128,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True,  # L2 normalize -> inner product = cosine similarity
        )

    matrix = embeddings.astype(np.float32)
    dim = matrix.shape[1]
    print(f"Creating FAISS IndexFlatIP with dimension {dim}...", flush=True)

    index = faiss.IndexFlatIP(dim)
    index.add(matrix)
    print(f"FAISS index populated: {index.ntotal:,} vectors.", flush=True)

    # 5. Save persistent files
    index_info = {
        "model_name": model_name,
        "dimension": dim,
        "total_vectors": index.ntotal,
        "dataset_fingerprint": _compute_file_fingerprint(reports_file),
        "build_time_seconds": round(time.time() - t0, 2),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    save_index(index, metadata_list, index_info, index_dir)

    # 6. Invalidate precomputed pattern & insights caches so they re-generate
    if GLOBAL_PATTERNS_CACHE_FILE.exists():
        GLOBAL_PATTERNS_CACHE_FILE.unlink(missing_ok=True)
    if INSIGHTS_CACHE_FILE.exists():
        INSIGHTS_CACHE_FILE.unlink(missing_ok=True)

    # 7. Update memory singletons
    global _FAISS_INDEX, _INDEXED_METADATA, _REPORT_ID_TO_METADATA, _INDEX_INFO
    _FAISS_INDEX = index
    _INDEXED_METADATA = metadata_list
    _REPORT_ID_TO_METADATA = {m["report_id"]: m for m in metadata_list}
    _INDEX_INFO = index_info

    logger.info(f"Vector index built and persisted in {index_info['build_time_seconds']}s")
    return index_status()


def save_index(index, metadata: List[Dict[str, Any]], index_info: Dict[str, Any], index_dir: Path = INDEX_DIR):
    """Saves FAISS index, metadata, and index info to disk."""
    import faiss
    index_dir.mkdir(parents=True, exist_ok=True)

    faiss_path = index_dir / "faiss.index"
    meta_path = index_dir / "metadata.json"
    info_path = index_dir / "index_info.json"

    logger.info(f"Saving FAISS index to {faiss_path}...")
    faiss.write_index(index, str(faiss_path))

    logger.info(f"Saving index metadata to {meta_path}...")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    logger.info(f"Saving index info to {info_path}...")
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(index_info, f, indent=2, ensure_ascii=False)


def load_index(index_dir: Path = INDEX_DIR) -> Dict[str, Any]:
    """
    Loads the persistent FAISS vector index and metadata into memory.
    Reuses existing in-memory singletons if already loaded.
    """
    import faiss
    global _FAISS_INDEX, _INDEXED_METADATA, _REPORT_ID_TO_METADATA, _INDEX_INFO

    if _FAISS_INDEX is not None and _INDEXED_METADATA is not None:
        return index_status()

    faiss_path = index_dir / "faiss.index"
    meta_path = index_dir / "metadata.json"
    info_path = index_dir / "index_info.json"

    if not (faiss_path.exists() and meta_path.exists()):
        logger.warning(f"Index files not found at {index_dir}. Auto-building index...")
        return build_index(index_dir=index_dir)

    logger.info(f"Loading persistent FAISS index from {faiss_path}...")
    _FAISS_INDEX = faiss.read_index(str(faiss_path))

    logger.info(f"Loading metadata from {meta_path}...")
    with open(meta_path, "r", encoding="utf-8") as f:
        _INDEXED_METADATA = json.load(f)

    _REPORT_ID_TO_METADATA = {m["report_id"]: m for m in _INDEXED_METADATA}

    if info_path.exists():
        with open(info_path, "r", encoding="utf-8") as f:
            _INDEX_INFO = json.load(f)
    else:
        _INDEX_INFO = {
            "model_name": DEFAULT_MODEL_NAME,
            "dimension": _FAISS_INDEX.d,
            "total_vectors": _FAISS_INDEX.ntotal,
        }

    # Also preload embedding model
    get_embedding_model(_INDEX_INFO.get("model_name", DEFAULT_MODEL_NAME))

    logger.info(f"Index loaded: {_FAISS_INDEX.ntotal:,} vectors.")
    return index_status()


def index_status(index_dir: Path = INDEX_DIR) -> Dict[str, Any]:
    """Returns current status and metadata of the vector index."""
    global _FAISS_INDEX, _INDEXED_METADATA, _INDEX_INFO
    is_built = (index_dir / "faiss.index").exists() and (index_dir / "metadata.json").exists()
    is_loaded = _FAISS_INDEX is not None and _INDEXED_METADATA is not None
    up_to_date = is_index_up_to_date(index_dir)

    total_records = _FAISS_INDEX.ntotal if is_loaded else (_INDEX_INFO.get("total_vectors", 0) if _INDEX_INFO else 0)
    dim = _FAISS_INDEX.d if is_loaded else (_INDEX_INFO.get("dimension", EMBEDDING_DIM) if _INDEX_INFO else EMBEDDING_DIM)
    model = _INDEX_INFO.get("model_name", DEFAULT_MODEL_NAME) if _INDEX_INFO else DEFAULT_MODEL_NAME

    return {
        "status": "ready" if (is_built and up_to_date) else ("needs_rebuild" if is_built else "not_built"),
        "is_built": is_built,
        "is_loaded": is_loaded,
        "is_up_to_date": up_to_date,
        "total_records": total_records,
        "dimension": dim,
        "model_name": model,
        "index_dir": str(index_dir),
        "build_time_seconds": _INDEX_INFO.get("build_time_seconds") if _INDEX_INFO else None,
        "created_at": _INDEX_INFO.get("created_at") if _INDEX_INFO else None,
    }


def get_report_by_id(report_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves normalized metadata for a report by its ID in O(1) time."""
    global _REPORT_ID_TO_METADATA
    if _REPORT_ID_TO_METADATA is None:
        load_index()
    return _REPORT_ID_TO_METADATA.get(report_id) if _REPORT_ID_TO_METADATA else None


# ============================================================================
# 3. Similar Report Search
# ============================================================================

def find_similar_reports(
    query: Union[str, Dict[str, Any], Any],
    top_k: int = 5,
    min_similarity: float = 0.35,
    filter_source_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Finds top_k semantically similar safety reports from the indexed dataset.

    Args:
        query: Raw narrative text string, report dict, or SafetyReportAnalysis object.
        top_k: Number of similar reports to return.
        min_similarity: Minimum cosine similarity threshold (0.0 - 1.0).
        filter_source_type: Optional filter (e.g., 'pdf_fatal', 'pdf_hipot', 'csv_osha').

    Returns:
        List of similar report dictionaries with similarity_score and provenance.
    """
    global _FAISS_INDEX, _INDEXED_METADATA
    if _FAISS_INDEX is None or _INDEXED_METADATA is None:
        load_index()

    if _FAISS_INDEX is None or _INDEXED_METADATA is None or _FAISS_INDEX.ntotal == 0:
        logger.warning("FAISS index is empty or not initialized.")
        return []

    # Extract query text
    if isinstance(query, str):
        query_text = query.strip()
    elif isinstance(query, dict):
        query_text = build_report_embedding_text(query)
    elif hasattr(query, "model_dump"):
        query_text = build_report_embedding_text(query.model_dump())
    else:
        query_text = str(query)

    if not query_text:
        return []

    model = get_embedding_model(_INDEX_INFO.get("model_name", DEFAULT_MODEL_NAME) if _INDEX_INFO else DEFAULT_MODEL_NAME)
    query_vector = model.encode([query_text], normalize_embeddings=True, convert_to_numpy=True).astype(np.float32)

    # Search for more candidates if filtering is requested
    search_k = min(top_k * 4 if filter_source_type else top_k + 5, _FAISS_INDEX.ntotal)
    scores, indices = _FAISS_INDEX.search(query_vector, search_k)

    results: List[Dict[str, Any]] = []
    matched_scores = scores[0]
    matched_indices = indices[0]

    for score, idx in zip(matched_scores, matched_indices):
        if idx < 0 or idx >= len(_INDEXED_METADATA):
            continue

        sim_score = float(score)
        if sim_score < min_similarity:
            continue

        meta = _INDEXED_METADATA[idx]
        if filter_source_type and meta.get("source_type") != filter_source_type:
            continue

        item = {
            "report_id": meta.get("report_id"),
            "similarity_score": round(sim_score, 4),
            "date": meta.get("date"),
            "year": meta.get("year"),
            "country": meta.get("country"),
            "region": meta.get("region"),
            "function": meta.get("function"),
            "activity": meta.get("activity"),
            "cause": meta.get("cause"),
            "life_saving_rules": meta.get("life_saving_rules", []),
            "narrative": meta.get("narrative"),
            "what_went_wrong": meta.get("what_went_wrong"),
            "corrective_actions": meta.get("corrective_actions"),
            "causal_factors": meta.get("causal_factors", []),
            "source_file": meta.get("source_file"),
            "source_type": meta.get("source_type"),
            "source_year": meta.get("source_year"),
            "source_page": meta.get("source_page"),
        }
        results.append(item)

        if len(results) >= top_k:
            break

    return results


# ============================================================================
# 4. Multi-Dimensional Safety Recurrence Engine
# ============================================================================

def _token_set(text_or_list: Any) -> Set[str]:
    """Helper to convert text or list of strings into a set of lowercased tokens."""
    if not text_or_list:
        return set()
    if isinstance(text_or_list, list):
        combined = " ".join(str(item) for item in text_or_list)
    else:
        combined = str(text_or_list)
    tokens = re.findall(r"\b[a-zA-Z]{3,}\b", combined.lower())
    # Exclude common stop words
    stops = {"the", "and", "for", "with", "from", "was", "were", "been", "that", "this", "during", "after", "into", "over"}
    return {t for t in tokens if t not in stops}


def _list_overlap(list_a: Any, list_b: Any) -> List[str]:
    """Finds matching elements (case-insensitive substring/equality) between two lists."""
    if not list_a or not list_b:
        return []
    items_a = [str(x).strip() for x in list_a if str(x).strip()]
    items_b = [str(y).strip() for y in list_b if str(y).strip()]

    matched = []
    for a in items_a:
        a_low = a.lower()
        for b in items_b:
            b_low = b.lower()
            if a_low == b_low or a_low in b_low or b_low in a_low:
                matched.append(a)
                break
    return matched


def calculate_recurrence_strength(
    current: Dict[str, Any],
    candidate: Dict[str, Any],
    semantic_similarity: float,
) -> Dict[str, Any]:
    """
    Computes a transparent multi-dimensional recurrence score comparing
    a target incident against a historical candidate incident.

    Dimensions Evaluated:
    1. Life-Saving Rules overlap (+0.25)
    2. SIF Precursors / Hazards overlap (+0.20)
    3. Failed Barriers / Critical Controls overlap (+0.15)
    4. Activity / Function overlap (+0.15)
    5. Equipment / Machinery overlap (+0.10)
    6. Exposure / Consequence / Cause overlap (+0.10)
    7. Semantic similarity baseline (+0.05 * similarity)

    Returns:
        Dict with total recurrence 'strength' (0.0 - 1.0), 'matched_dimensions',
        and a detailed breakdown.
    """
    matched_dimensions: List[str] = []
    dimension_scores: Dict[str, float] = {}

    # 1. Life-Saving Rules
    cur_lsrs = current.get("life_saving_rules", []) or []
    cand_lsrs = candidate.get("life_saving_rules", []) or []
    matched_lsrs = _list_overlap(cur_lsrs, cand_lsrs)
    if matched_lsrs:
        dimension_scores["life_saving_rules"] = 0.25
        matched_dimensions.append(f"Life-Saving Rules: {', '.join(matched_lsrs)}")
    else:
        dimension_scores["life_saving_rules"] = 0.0

    # 2. Hazards & SIF Precursors
    cur_hazards = (current.get("hazards", []) or []) + (current.get("sif_precursors", []) or [])
    cand_hazards = candidate.get("causal_factors", []) or []
    if candidate.get("cause"):
        cand_hazards.append(str(candidate.get("cause")))
    matched_haz = _list_overlap(cur_hazards, cand_hazards)
    if matched_haz or (_token_set(cur_hazards) & _token_set(cand_hazards)):
        dimension_scores["hazards_precursors"] = 0.20
        matched_dimensions.append(f"Hazards/Precursors: {', '.join(matched_haz[:2]) if matched_haz else 'Pattern match'}")
    else:
        dimension_scores["hazards_precursors"] = 0.0

    # 3. Barriers / Failed Controls
    cur_barriers = current.get("barriers", []) or []
    cand_barriers = (candidate.get("causal_factors", []) or [])
    if candidate.get("what_went_wrong"):
        cand_barriers.append(str(candidate.get("what_went_wrong")))
    matched_barriers = _list_overlap(cur_barriers, cand_barriers)
    if matched_barriers or (_token_set(cur_barriers) & _token_set(cand_barriers)):
        dimension_scores["barriers"] = 0.15
        matched_dimensions.append("Failed Barriers / Controls")
    else:
        dimension_scores["barriers"] = 0.0

    # 4. Activity & Function
    cur_activity = f"{current.get('activity', '')} {current.get('function', '')}".strip()
    cand_activity = f"{candidate.get('activity', '')} {candidate.get('function', '')}".strip()
    act_tokens = _token_set(cur_activity) & _token_set(cand_activity)
    if act_tokens:
        dimension_scores["activity"] = 0.15
        matched_dimensions.append(f"Activity/Function: {', '.join(list(act_tokens)[:2])}")
    else:
        dimension_scores["activity"] = 0.0

    # 5. Equipment
    cur_equipment = current.get("equipment", []) or []
    cand_equipment = candidate.get("narrative", "")
    eq_tokens = _token_set(cur_equipment) & _token_set(cand_equipment)
    if eq_tokens:
        dimension_scores["equipment"] = 0.10
        matched_dimensions.append(f"Equipment: {', '.join(list(eq_tokens)[:2])}")
    else:
        dimension_scores["equipment"] = 0.0

    # 6. Exposure / Consequence / Cause
    cur_conseq = (current.get("consequences", []) or []) + (current.get("exposure", []) or [])
    cand_cause = f"{candidate.get('cause', '')} {candidate.get('narrative', '')}"
    conseq_tokens = _token_set(cur_conseq) & _token_set(cand_cause)
    if conseq_tokens:
        dimension_scores["exposure_consequences"] = 0.10
        matched_dimensions.append(f"Exposure/Consequences: {', '.join(list(conseq_tokens)[:2])}")
    else:
        dimension_scores["exposure_consequences"] = 0.0

    # 7. Semantic Similarity Component (scaled contribution)
    sim_component = max(0.0, min(0.10, semantic_similarity * 0.10))
    dimension_scores["semantic_similarity"] = sim_component

    # Raw sum
    raw_strength = sum(dimension_scores.values())

    # Boost strength if multiple structured dimensions match
    num_dimensions_matched = len([k for k, v in dimension_scores.items() if v > 0 and k != "semantic_similarity"])
    if num_dimensions_matched >= 3:
        raw_strength = min(1.0, raw_strength + 0.10)
    if num_dimensions_matched >= 4:
        raw_strength = min(1.0, raw_strength + 0.08)

    strength = round(max(0.0, min(1.0, raw_strength)), 4)

    return {
        "recurrence_strength": strength,
        "dimension_scores": dimension_scores,
        "matched_dimensions": matched_dimensions,
        "dimensions_matched_count": num_dimensions_matched,
    }


def analyze_recurrence_for_report(
    report_data: Union[Dict[str, Any], Any],
    top_k: int = 10,
    min_similarity: float = 0.40,
    strong_recurrence_threshold: float = 0.55,
) -> Dict[str, Any]:
    """
    Performs comprehensive safety recurrence intelligence analysis for a safety report:
    1. Retrieves top similar historical reports.
    2. Runs multi-dimensional recurrence scoring across safety dimensions.
    3. Synthesizes recurring pattern summaries.
    4. Determines if risk_factors.recurring_pattern should be activated.
    """
    if hasattr(report_data, "model_dump"):
        report_dict = report_data.model_dump()
    elif isinstance(report_data, dict):
        report_dict = report_data
    else:
        report_dict = {"narrative": str(report_data)}

    similar_candidates = find_similar_reports(
        query=report_dict,
        top_k=top_k,
        min_similarity=min_similarity,
    )

    if not similar_candidates:
        return {
            "similar_reports": [],
            "recurring_patterns": [],
            "max_recurrence_strength": 0.0,
            "is_recurring_pattern": False,
            "evidence_notes": [],
            "similar_report_ids": [],
        }

    scored_candidates = []
    pattern_clusters: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    max_strength = 0.0

    for cand in similar_candidates:
        # Don't compare a report with its own ID if present in DB
        if report_dict.get("report_id") and cand.get("report_id") == report_dict.get("report_id"):
            continue

        sim = cand.get("similarity_score", 0.0)
        rec_eval = calculate_recurrence_strength(report_dict, cand, sim)
        strength = rec_eval["recurrence_strength"]

        cand_augmented = {
            **cand,
            "recurrence_strength": strength,
            "matched_dimensions": rec_eval["matched_dimensions"],
            "dimension_scores": rec_eval["dimension_scores"],
        }
        scored_candidates.append(cand_augmented)

        if strength > max_strength:
            max_strength = strength

        # Cluster by prominent safety pattern
        pattern_name = _infer_pattern_name(cand, report_dict)
        pattern_clusters[pattern_name].append(cand_augmented)

    # Sort candidates by recurrence strength descending
    scored_candidates.sort(key=lambda x: x["recurrence_strength"], reverse=True)

    # Format recurring pattern output objects
    recurring_patterns_out: List[Dict[str, Any]] = []
    pattern_titles: List[str] = []

    for pattern_name, members in pattern_clusters.items():
        if not members:
            continue
        cluster_strengths = [m["recurrence_strength"] for m in members]
        avg_strength = round(sum(cluster_strengths) / len(cluster_strengths), 3)
        top_cluster_strength = max(cluster_strengths)

        # Only include patterns with meaningful recurrence
        if top_cluster_strength >= 0.45 or len(members) >= 2:
            locations = list({m.get("country") or m.get("region") for m in members if m.get("country") or m.get("region")})[:3]
            activities = list({m.get("activity") for m in members if m.get("activity")})[:3]
            lsrs = list({lsr for m in members for lsr in m.get("life_saving_rules", [])})[:3]
            report_ids = [m.get("report_id") for m in members if m.get("report_id")][:5]

            p_obj = {
                "pattern": f"Recurring safety pattern detected: {pattern_name}",
                "occurrences": len(members),
                "strength": top_cluster_strength,
                "common_locations": locations,
                "common_equipment": [],
                "common_hazards": [],
                "common_failed_barriers": [],
                "common_exposures": [],
                "common_consequences": [],
                "associated_life_saving_rules": lsrs,
                "associated_activities": activities,
                "report_ids": report_ids,
            }
            recurring_patterns_out.append(p_obj)
            pattern_titles.append(f"{pattern_name} ({len(members)} occurrences, strength {top_cluster_strength:.2f})")

    # Flag for deterministic risk engine
    is_recurring = (max_strength >= strong_recurrence_threshold) or (len(scored_candidates) >= 3 and max_strength >= 0.50)

    # Evidence notes for transparency
    evidence_notes = []
    if is_recurring:
        evidence_notes.append(f"Recurring safety pattern detected across {len(scored_candidates)} historical records (max multi-dimensional strength: {max_strength:.2f}).")
        for p in recurring_patterns_out[:2]:
            evidence_notes.append(f"{p['pattern']} (observed in {p['occurrences']} related reports).")

    return {
        "similar_reports": [
            f"{c['report_id']} ({c.get('date', 'date unknown')} - {c.get('country', '') or c.get('region', '')} - similarity: {c['similarity_score']:.2f}, recurrence: {c['recurrence_strength']:.2f})"
            for c in scored_candidates[:5]
        ],
        "similar_report_details": scored_candidates[:5],
        "recurring_patterns": pattern_titles,
        "recurring_pattern_objects": recurring_patterns_out,
        "max_recurrence_strength": max_strength,
        "is_recurring_pattern": is_recurring,
        "evidence_notes": evidence_notes,
        "similar_report_ids": [c["report_id"] for c in scored_candidates[:5]],
    }


def _infer_pattern_name(candidate: Dict[str, Any], current: Dict[str, Any]) -> str:
    """Infers a canonical pattern name from candidate and current reports."""
    # Check Life-Saving Rules
    common_lsrs = _list_overlap(current.get("life_saving_rules", []), candidate.get("life_saving_rules", []))
    if common_lsrs:
        return f"{common_lsrs[0]} Failure / Violation"

    cand_lsrs = candidate.get("life_saving_rules", [])
    if cand_lsrs:
        return f"{cand_lsrs[0]} Non-Conformance"

    # Check SIF Precursors
    precursors = current.get("sif_precursors", [])
    if precursors:
        return str(precursors[0])

    # Check Cause & Activity
    cause = candidate.get("cause") or current.get("cause")
    activity = candidate.get("activity") or current.get("activity")

    if cause and "burn" in str(cause).lower():
        return "Thermal / Burn Hazard during Operation"
    if cause and "fall" in str(cause).lower():
        return "Fall from Height / Elevation Event"
    if cause and "struck" in str(cause).lower():
        return "Struck-By / Line of Fire Hazard"
    if cause and "caught" in str(cause).lower():
        return "Caught-In / Pinch Point Hazard"
    if activity and "maintenance" in str(activity).lower():
        return "Critical Control Breach during Maintenance"
    if activity and "lifting" in str(activity).lower():
        return "Rigging / Mechanical Lifting Deviation"

    if cause:
        return f"Recurring Hazard: {cause}"
    return "Historical Precursor Recurrence"


# ============================================================================
# 5. Global Pattern Discovery
# ============================================================================

# Seed clusters for global safety patterns
GLOBAL_PATTERN_SEEDS = [
    {
        "id": "energy-isolation-failure",
        "title": "Energy Isolation Failure",
        "query": "lockout tagout electrical isolation failure de-energization live circuit breaker energized panel",
        "lsr": "Energy Isolation",
        "precursor": "Energy Isolation Failure",
    },
    {
        "id": "line-of-fire-dropped-object",
        "title": "Line of Fire / Dropped Object",
        "query": "crane lift suspended load rigging failure dropped object line of fire exclusion zone struck by",
        "lsr": "Line of Fire",
        "precursor": "Dropped Object",
    },
    {
        "id": "working-at-height-scaffolding",
        "title": "Working at Height & Scaffold Fall",
        "query": "scaffold fall platform working at height harness unanchored guardrail ladder elevation",
        "lsr": "Working at Height",
        "precursor": "Falls from Height",
    },
    {
        "id": "confined-space-entry",
        "title": "Confined Space & Hazardous Atmosphere",
        "query": "confined space tank entry atmospheric gas testing oxygen deficiency toxic gas breathing apparatus",
        "lsr": "Confined Space",
        "precursor": "Confined Space",
    },
    {
        "id": "hot-work-fire-explosion",
        "title": "Hot Work / Flammable Atmosphere Flash Fire",
        "query": "welding grinding torch sparks flammable vapor flash fire hot work permit gas test combustible",
        "lsr": "Hot Work",
        "precursor": "Hot Work",
    },
    {
        "id": "bypassing-safety-controls",
        "title": "Bypassing Safety Controls & Interlocks",
        "query": "bypassing safety controls disabled interlock alarm override safety device removed guard defeat",
        "lsr": "Bypassing Safety Controls",
        "precursor": "Bypassed / Inadequate Critical Control",
    },
    {
        "id": "safe-mechanical-lifting",
        "title": "Safe Mechanical Lifting & Rigging Failure",
        "query": "crane rigging sling failure forklift overturned lifting hoist load dropped mechanical lift",
        "lsr": "Safe Mechanical Lifting",
        "precursor": "Lifting / Rigging Failure",
    },
    {
        "id": "toxic-hazardous-release",
        "title": "Toxic / Hazardous Substance Loss of Containment",
        "query": "chemical release acid leak toxic hazardous substance loss of primary containment piping flange leak",
        "lsr": "Toxic / Hazardous Substances",
        "precursor": "Process Safety / Loss of Primary Containment",
    },
    {
        "id": "vehicle-driving-transport",
        "title": "Vehicle / Mobile Equipment & Driving Incidents",
        "query": "vehicle rollover truck collision driving transport heavy equipment mobile machinery road safety",
        "lsr": "Driving",
        "precursor": "Vehicle / Mobile Equipment Interaction",
    },
    {
        "id": "pressurized-systems-release",
        "title": "Pressurized System & Pressure Release",
        "query": "high pressure line release hydraulic blowout flange unbolting pressure energy pressurized vessel",
        "lsr": "Energy Isolation",
        "precursor": "Pressure Release",
    },
]


def discover_global_patterns(
    top_n: int = 10,
    min_occurrences: int = 3,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    """
    Discovers recurring safety patterns across the 106,878 historical dataset.
    Uses vector retrieval and structured aggregation without expensive all-to-all comparisons.
    Caches results to disk for instantaneous retrieval.
    """
    global _GLOBAL_PATTERNS_CACHE
    if not force_refresh and _GLOBAL_PATTERNS_CACHE is not None:
        return _GLOBAL_PATTERNS_CACHE

    if not force_refresh and GLOBAL_PATTERNS_CACHE_FILE.exists():
        try:
            with open(GLOBAL_PATTERNS_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                _GLOBAL_PATTERNS_CACHE = cached
                return cached
        except Exception:
            pass

    load_index()
    logger.info("Discovering global recurring safety patterns across historical reports...")

    patterns: List[Dict[str, Any]] = []

    for seed in GLOBAL_PATTERN_SEEDS:
        # Retrieve candidate matches for this seed
        matches = find_similar_reports(
            query=seed["query"],
            top_k=25,
            min_similarity=0.42,
        )

        if len(matches) < min_occurrences:
            continue

        # Extract structured dimensions from matching cohort
        locations = Counter()
        equipment: Counter = Counter()
        hazards: Counter = Counter()
        barriers = Counter()
        exposures: Counter = Counter()
        consequences = Counter()
        activities = Counter()
        lsrs = Counter()

        strengths = []

        for m in matches:
            sim = m.get("similarity_score", 0.0)
            rec = calculate_recurrence_strength(
                {"life_saving_rules": [seed["lsr"]], "activity": seed["title"]},
                m,
                sim,
            )
            strengths.append(rec["recurrence_strength"])

            # Geography
            if m.get("country"):
                locations[m["country"]] += 1
            elif m.get("region"):
                locations[m["region"]] += 1

            # Activities — clean artifact strings before counting
            raw_activity = m.get("activity", "")
            if raw_activity:
                cleaned_act = _clean_activity_string(str(raw_activity))
                if cleaned_act:
                    activities[cleaned_act] += 1

            # Life-Saving Rules
            for lsr in m.get("life_saving_rules", []):
                if lsr:
                    lsrs[lsr] += 1

            # Consequences from cause field
            if m.get("cause"):
                consequences[str(m["cause"])[:60]] += 1

            # Extract barriers from what_went_wrong
            if m.get("what_went_wrong"):
                barriers[str(m["what_went_wrong"])[:60]] += 1

            # Aggregate free text for keyword extraction
            combined_text = " ".join(filter(None, [
                m.get("narrative", "") or "",
                m.get("what_went_wrong", "") or "",
                " ".join(m.get("causal_factors", []) or []),
                m.get("cause", "") or "",
            ]))

            # Equipment extraction from narrative and causal_factors
            for eq_label in _extract_keywords_from_text(combined_text, _EQUIPMENT_KEYWORDS, max_results=3):
                equipment[eq_label] += 1

            # Hazard extraction from causal_factors
            for hz_label in _extract_keywords_from_text(combined_text, _HAZARD_KEYWORDS, max_results=3):
                hazards[hz_label] += 1

            # Exposure (personnel) extraction from narrative
            for exp_label in _extract_keywords_from_text(combined_text, _EXPOSURE_KEYWORDS, max_results=3):
                exposures[exp_label] += 1

        avg_strength = round(float(np.mean(strengths)), 2) if strengths else 0.75
        max_strength = round(float(np.max(strengths)), 2) if strengths else 0.85

        pattern_entry = {
            "pattern_id": seed["id"],
            "pattern": f"Recurring safety pattern detected: {seed['title']}",
            "title": seed["title"],
            "occurrences": len(matches),
            "strength": max_strength,
            "average_strength": avg_strength,
            "primary_life_saving_rule": seed["lsr"],
            "primary_sif_precursor": seed["precursor"],
            "common_locations": [loc for loc, _ in locations.most_common(4)],
            "common_equipment": [eq for eq, _ in equipment.most_common(5)],
            "common_hazards": [hz for hz, _ in hazards.most_common(5)],
            "common_failed_barriers": [b for b, _ in barriers.most_common(3)],
            "common_exposures": [exp for exp, _ in exposures.most_common(4)],
            "common_consequences": [c for c, _ in consequences.most_common(4)],
            "associated_life_saving_rules": [r for r, _ in lsrs.most_common(3)],
            "associated_activities": [_clean_activity_string(act) for act, _ in activities.most_common(6)][:4],
            "report_ids": [m["report_id"] for m in matches[:10]],
            "sample_reports": [
                {
                    "report_id": m["report_id"],
                    "date": m.get("date"),
                    "location": m.get("country") or m.get("region"),
                    "activity": _clean_activity_string(m.get("activity") or ""),
                    "cause": m.get("cause"),
                    "similarity": m.get("similarity_score"),
                    "source_file": m.get("source_file"),
                }
                for m in matches[:3]
            ],
        }
        patterns.append(pattern_entry)

    # Sort by occurrences & strength descending
    patterns.sort(key=lambda p: (p["occurrences"], p["strength"]), reverse=True)
    patterns = patterns[:top_n]

    # Cache to disk
    try:
        GLOBAL_PATTERNS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(GLOBAL_PATTERNS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(patterns, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not write global patterns cache: {e}")

    _GLOBAL_PATTERNS_CACHE = patterns
    return patterns


# ============================================================================
# 6. Safety Insights (Aggregated Dashboard Analytics)
# ============================================================================

def get_safety_insights(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Computes comprehensive aggregated safety insights across the 106,878 reports.
    Caches results for high-performance dashboard retrieval.
    """
    global _INSIGHTS_CACHE
    if not force_refresh and _INSIGHTS_CACHE is not None:
        return _INSIGHTS_CACHE

    if not force_refresh and INSIGHTS_CACHE_FILE.exists():
        try:
            with open(INSIGHTS_CACHE_FILE, "r", encoding="utf-8") as f:
                cached = json.load(f)
                _INSIGHTS_CACHE = cached
                return cached
        except Exception:
            pass

    load_index()
    logger.info("Computing safety intelligence insights across historical dataset...")

    metadata = _INDEXED_METADATA or []
    total_reports = len(metadata)

    years_counter = Counter()
    sources_counter = Counter()
    lsr_counter = Counter()
    activities_counter = Counter()
    causes_counter = Counter()
    countries_counter = Counter()
    regions_counter = Counter()
    fatalities_count = 0

    for m in metadata:
        # Years
        yr = m.get("year") or m.get("source_year")
        if yr and isinstance(yr, int) and 2000 <= yr <= 2030:
            years_counter[str(yr)] += 1
        elif yr:
            years_counter[str(yr)[:4]] += 1

        # Sources
        stype = m.get("source_type") or "unknown"
        sources_counter[stype] += 1
        if stype == "pdf_fatal":
            fatalities_count += 1

        # Life Saving Rules
        for lsr in m.get("life_saving_rules", []):
            if lsr and str(lsr).strip():
                lsr_counter[str(lsr).strip()] += 1

        # Activities
        act = m.get("activity")
        if act and str(act).strip():
            activities_counter[str(act).strip()] += 1

        # Causes
        c = m.get("cause")
        if c and str(c).strip():
            causes_counter[str(c).strip()] += 1

        # Geography
        country = m.get("country")
        if country and str(country).strip():
            countries_counter[str(country).strip()] += 1

        region = m.get("region")
        if region and str(region).strip():
            regions_counter[str(region).strip()] += 1

    # Get global recurring patterns summary
    global_patterns = discover_global_patterns()

    insights = {
        "summary": {
            "total_reports": total_reports,
            "fatal_incidents_recorded": fatalities_count,
            "pdf_iogp_reports": sources_counter.get("pdf_fatal", 0) + sources_counter.get("pdf_hipot", 0) + sources_counter.get("pdf_pse", 0),
            "osha_severe_injuries": sources_counter.get("csv_osha", 0),
            "active_recurring_patterns_count": len(global_patterns),
            "vector_index_size": total_reports,
            "last_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "reports_by_year": dict(sorted(years_counter.items())),
        "reports_by_source_type": dict(sources_counter),
        "life_saving_rules_frequency": [
            {"rule": rule, "count": count}
            for rule, count in lsr_counter.most_common(12)
        ],
        "top_activities": [
            {"activity": act, "count": count}
            for act, count in activities_counter.most_common(12)
        ],
        "top_causes": [
            {"cause": cause, "count": count}
            for cause, count in causes_counter.most_common(12)
        ],
        "top_recurring_patterns": [
            {
                "pattern_id": p["pattern_id"],
                "title": p["title"],
                "occurrences": p["occurrences"],
                "strength": p["strength"],
                "primary_life_saving_rule": p["primary_life_saving_rule"],
            }
            for p in global_patterns
        ],
        "geographic_distribution": {
            "top_countries": [
                {"country": country, "count": count}
                for country, count in countries_counter.most_common(10)
            ],
            "top_regions_states": [
                {"region": reg, "count": count}
                for reg, count in regions_counter.most_common(12)
            ],
        },
    }

    # Save to disk
    try:
        INSIGHTS_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(INSIGHTS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(insights, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not write insights cache: {e}")

    _INSIGHTS_CACHE = insights
    return insights
