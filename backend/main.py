"""
FastAPI Application Entrypoint for SIF Intelligence.

Exposes RESTful endpoints for:
- Safety report ingestion and real-time precursor analysis (POST /analyze)
- Historical safety report retrieval (GET /reports, GET /reports/{id})
- Semantic safety report similarity search (POST /similar)
- Multi-dimensional recurring safety patterns (GET /patterns, POST /patterns/search, GET /patterns/{id})
- Aggregated safety intelligence dashboard insights (GET /insights)
- Vector index status & management (GET /index/status, POST /index/build)
"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from analyzer import SafetyReportAnalysis, analyze_report
from batch import analyze_batch
from recurrence import (
    discover_global_patterns,
    find_similar_reports,
    get_safety_insights,
    index_status,
    build_index,
    get_report_by_id as get_indexed_report_by_id,
)

logger = logging.getLogger("sif_intelligence.api")

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
REPORTS_FILE = DATA_DIR / "reports.json"

# FastAPI Application
app = FastAPI(
    title="SIF Intelligence API",
    description="AI/NLP Precursor Detection & Recurrence Intelligence Engine for Serious Injury & Fatality Prevention",
    version="1.0.0",
)

# CORS Middleware for local development and the deployed frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://sif-intelligence.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Schemas
class AnalyzeRequest(BaseModel):
    """Payload schema for report analysis request."""
    text: str = Field(..., min_length=1, description="Raw narrative text of the safety report to analyze")


class BatchReportItem(BaseModel):
    """Payload item for batch report analysis."""
    text: str = Field(..., min_length=1, description="Raw narrative text of the safety report")
    filename: Optional[str] = Field(default="", description="Original file or record name")
    source_type: Optional[str] = Field(default="user_upload", description="Source classification: user_upload, real_iogp, benchmark_demo")


class BatchAnalyzeRequest(BaseModel):
    """Payload schema for batch report analysis."""
    reports: List[BatchReportItem] = Field(..., min_items=1, max_items=20, description="List of report items to analyze (max 20)")


class SimilarSearchRequest(BaseModel):
    """Payload schema for finding similar historical reports."""
    query: str = Field(..., min_length=1, description="Report text, narrative, or hazard description")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of matches to return")
    min_similarity: float = Field(default=0.35, ge=0.0, le=1.0, description="Minimum cosine similarity threshold")
    source_type: Optional[str] = Field(default=None, description="Optional filter by source type: pdf_fatal, pdf_hipot, pdf_pse, csv_osha")


class PatternSearchRequest(BaseModel):
    """Payload schema for searching recurring safety patterns."""
    query: str = Field(..., min_length=1, description="Keyword, precursor, Life-Saving Rule, or incident description")
    top_k: int = Field(default=5, ge=1, le=20, description="Max patterns to return")


class BuildIndexRequest(BaseModel):
    """Payload schema for triggering vector index rebuild."""
    force_rebuild: bool = Field(default=False, description="Whether to force rebuild even if index is up-to-date")
    batch_size: int = Field(default=512, ge=64, le=2048, description="Embedding batch size")


# ============================================================================
# System Endpoints
# ============================================================================

@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint to verify API service status."""
    return {
        "status": "healthy",
        "service": "SIF Intelligence API",
        "version": "1.0.0",
    }


@app.get("/index/status", tags=["System"])
def get_vector_index_status():
    """Returns the current vector index status and statistics."""
    try:
        return index_status()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/index/build", tags=["System"])
def trigger_index_build(request: BuildIndexRequest = BuildIndexRequest()):
    """Triggers building or reloading the persistent FAISS vector index."""
    try:
        result = build_index(
            reports_file=REPORTS_FILE,
            batch_size=request.batch_size,
            force_rebuild=request.force_rebuild,
        )
        return {"message": "Vector index built successfully", "status": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Core Analysis Endpoint
# ============================================================================

@app.post(
    "/analyze",
    response_model=SafetyReportAnalysis,
    status_code=status.HTTP_200_OK,
    tags=["Analysis"],
)
def analyze_safety_report(request: AnalyzeRequest):
    """
    Analyzes an unstructured safety report narrative:
    1. Extracts precursor entities & Life-Saving Rules via real LLM or heuristic fallback.
    2. Retrieves semantically similar historical records from the 106,878 reports database.
    3. Runs multi-dimensional safety recurrence intelligence.
    4. Deterministically calculates the Safety Priority Score.
    """
    try:
        analysis_result = analyze_report(request.text)
        return analysis_result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis pipeline error: {str(e)}"
        )


@app.post(
    "/analyze/batch",
    status_code=status.HTTP_200_OK,
    tags=["Analysis"],
)
def analyze_batch_safety_reports(request: BatchAnalyzeRequest):
    """
    Analyzes multiple unstructured safety reports in a batch:
    1. Runs individual reports through Qwen3-8B -> Validation -> FAISS -> Recurrence -> Deterministic Risk Engine.
    2. Handles per-report exceptions gracefully without aborting the entire batch.
    3. Calculates deterministic priority rankings (priority_rank 1..N).
    4. Computes cross-report insights (repeated LSRs, SIF precursors, failed barriers, hazards, equipment, exposure).
    5. Derives evidence-grounded action prioritization.
    """
    try:
        report_dicts = [r.model_dump() for r in request.reports]
        batch_output = analyze_batch(report_dicts)
        return batch_output
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Batch analysis error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch analysis pipeline error: {str(e)}"
        )


# ============================================================================
# Semantic Search Endpoints
# ============================================================================

@app.post("/similar", tags=["Semantic Search"])
def search_similar_reports(request: SimilarSearchRequest):
    """
    Finds semantically similar historical safety reports using the persistent FAISS index.
    Returns structured incident matches with similarity scores and source provenance.
    """
    try:
        results = find_similar_reports(
            query=request.query,
            top_k=request.top_k,
            min_similarity=request.min_similarity,
            filter_source_type=request.source_type,
        )
        return {
            "query": request.query,
            "total_matches": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Recurrence Intelligence & Patterns Endpoints
# ============================================================================

@app.get("/patterns", tags=["Recurrence Intelligence"])
def get_global_patterns(top_n: int = Query(default=15, ge=1, le=50)):
    """
    Retrieves discovered global recurring safety patterns across the 106,878 reports.
    Identifies systemic multi-dimensional clusters across Life-Saving Rules, SIF precursors,
    hazards, and failed controls.
    """
    try:
        patterns = discover_global_patterns(top_n=top_n)
        return {
            "total_patterns": len(patterns),
            "patterns": patterns,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/patterns/search", tags=["Recurrence Intelligence"])
def search_recurring_patterns(request: PatternSearchRequest):
    """
    Searches for recurring safety patterns matching a specific query or report narrative.
    """
    try:
        all_patterns = discover_global_patterns()
        q = request.query.lower()
        matched = []
        for p in all_patterns:
            title = p.get("title", "").lower()
            lsr = p.get("primary_life_saving_rule", "").lower()
            precursor = p.get("primary_sif_precursor", "").lower()
            if q in title or q in lsr or q in precursor or any(q in str(c).lower() for c in p.get("common_hazards", [])):
                matched.append(p)

        # If no strict substring matches, return top patterns sorted by strength
        if not matched:
            matched = all_patterns[:request.top_k]
        else:
            matched = matched[:request.top_k]

        return {
            "query": request.query,
            "total_matched": len(matched),
            "patterns": matched,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/patterns/{pattern_id}", tags=["Recurrence Intelligence"])
def get_pattern_by_id(pattern_id: str):
    """
    Retrieves detailed multi-dimensional recurrence information for a specific safety pattern.
    """
    try:
        all_patterns = discover_global_patterns()
        for p in all_patterns:
            if p.get("pattern_id") == pattern_id or p.get("pattern_id") == pattern_id.lower():
                return p
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recurring safety pattern '{pattern_id}' not found."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Dashboard Safety Insights Endpoint
# ============================================================================

@app.get("/insights", tags=["Safety Insights"])
def get_aggregated_safety_insights(refresh: bool = Query(default=False, description="Force refresh aggregated metrics")):
    """
    Retrieves aggregated backend safety intelligence analytics across 106,878 historical reports.
    Provides analytics on temporal distributions, source breakdowns, Life-Saving Rules frequency,
    top hazards, activities, causes, and geographic hotspots.
    """
    try:
        insights = get_safety_insights(force_refresh=refresh)
        return insights
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# Historical Reports Endpoints
# ============================================================================

@app.get(
    "/reports",
    tags=["Reports"],
)
def get_reports(
    limit: int = Query(default=50, ge=1, le=500, description="Max reports to return"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    source_type: Optional[str] = Query(default=None, description="Filter by source_type (e.g. pdf_fatal, pdf_hipot, csv_osha)"),
):
    """Retrieves paginated historical safety reports from storage."""
    try:
        from recurrence import _INDEXED_METADATA, load_index
        if _INDEXED_METADATA is None:
            load_index()
        records = _INDEXED_METADATA or []

        if source_type:
            records = [r for r in records if r.get("source_type") == source_type]

        total = len(records)
        page = records[offset : offset + limit]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "reports": page,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get(
    "/reports/{report_id}",
    tags=["Reports"],
)
def get_report(report_id: str):
    """Retrieves a single historical safety report by its report_id."""
    report = get_indexed_report_by_id(report_id)
    if report:
        return report

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Safety report with ID '{report_id}' not found."
    )