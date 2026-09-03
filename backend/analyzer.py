"""
Analyzer Pipeline for SIF Intelligence.

Defines Pydantic data models for structured safety intelligence and orchestrates
the end-to-end analysis pipeline:
Input Validation -> LLM Extraction -> Structured JSON -> Validation -> Risk Engine -> Output.

The analysis_source field indicates whether the output came from the real LLM ("llm")
or the heuristic fallback engine ("fallback").
"""
import uuid
import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from llm import analyze_with_llm
from risk_engine import calculate_safety_priority_score
from rules import (
    clean_and_deduplicate_list,
    validate_life_saving_rules,
    validate_sif_precursors,
    validate_confidence,
    normalize_string,
)

logger = logging.getLogger("sif_intelligence.analyzer")


class RiskFactors(BaseModel):
    """Boolean precursor risk factors used to compute the Safety Priority Score."""
    critical_control_failure: bool = Field(default=False, description="Failure or absence of a critical barrier/control")
    direct_human_exposure: bool = Field(default=False, description="Direct personnel exposure to hazard line of fire")
    high_energy_hazard: bool = Field(default=False, description="Presence of high energy (mechanical, electrical, gravity, pressure)")
    serious_or_fatal_consequence: bool = Field(default=False, description="Potential or realized serious/fatal consequence")
    life_saving_rule_violation: bool = Field(default=False, description="Non-conformance with a Life-Saving Rule")
    recurring_pattern: bool = Field(default=False, description="Historical recurrence of similar precursor event")


class SafetyReportAnalysis(BaseModel):
    """Complete structured SIF intelligence analysis output."""
    report_id: str = Field(description="Unique identifier for the safety analysis report")
    report_type: str = Field(default="Incident/Near Miss", description="Classification of the report")
    date: str = Field(default="", description="Date of the report/incident")
    country: str = Field(default="", description="Country where the event occurred")
    region: str = Field(default="", description="Operational region or division")
    function: str = Field(default="", description="Business function or department")
    activity: str = Field(default="", description="Activity/operation being performed")
    location: str = Field(default="", description="Specific site or physical location")
    equipment: List[str] = Field(default_factory=list, description="Equipment or machinery involved")
    hazards: List[str] = Field(default_factory=list, description="Identified hazards")
    barriers: List[str] = Field(default_factory=list, description="Safety barriers or controls present/absent")
    exposure: List[str] = Field(default_factory=list, description="Exposed personnel or targets")
    consequences: List[str] = Field(default_factory=list, description="Realized or potential consequences")
    people_involved: List[str] = Field(default_factory=list, description="Roles or personnel involved")
    life_saving_rules: List[str] = Field(default_factory=list, description="Applicable Life-Saving Rules")
    sif_precursors: List[str] = Field(default_factory=list, description="SIF precursor indicators detected")
    evidence: List[str] = Field(default_factory=list, description="Supporting text evidence excerpts")
    risk_factors: RiskFactors = Field(default_factory=RiskFactors, description="Precursor boolean risk factors")
    risk_score: int = Field(default=0, description="Deterministic Safety Priority Score (0-100)")
    risk_priority: str = Field(default="Low", description="Risk priority tier: Critical, High, Medium, or Low")
    similar_reports: List[str] = Field(default_factory=list, description="IDs of similar historical reports")
    recurring_patterns: List[str] = Field(default_factory=list, description="Identified recurring precursor patterns")
    recommended_action: str = Field(default="", description="Recommended preventative or corrective action")
    confidence: float = Field(default=0.85, description="Model extraction confidence score (0.0 - 1.0), NOT accident probability")
    human_verified: bool = Field(default=False, description="Verification status by human safety officer")
    analysis_source: str = Field(default="fallback", description="Source of the analysis: 'llm' for real LLM, 'fallback' for heuristic engine")
    llm_model: Optional[str] = Field(default=None, description="Model identifier used if analysis_source is 'llm'")


def _generate_recommended_action(risk_factors: RiskFactors, existing_action: str) -> str:
    """
    Generates or validates a recommended action based on risk factors.
    Uses LLM-provided action if present and non-empty, otherwise generates from risk factors.
    """
    if existing_action and existing_action.strip():
        return existing_action.strip()

    # Generate based on risk factors
    if risk_factors.critical_control_failure or risk_factors.life_saving_rule_violation:
        return ("Immediately suspend work, re-establish verified critical controls, "
                "and conduct mandatory stand-down & verification of Life-Saving Rules.")
    elif risk_factors.high_energy_hazard:
        return ("Verify isolation barriers and establish a positive physical "
                "exclusion zone around the high-energy hazard area.")
    elif risk_factors.direct_human_exposure:
        return ("Remove personnel from the hazard zone, conduct hazard re-assessment, "
                "and implement physical barriers before resuming work.")
    elif risk_factors.serious_or_fatal_consequence:
        return ("Conduct a thorough incident investigation, implement corrective actions, "
                "and share lessons learned across the organization.")
    else:
        return ("Review task risk assessment (JSA) and reinforce worker hazard awareness "
                "during pre-job safety briefings.")


def analyze_report(report_text: str, report_id: Optional[str] = None) -> SafetyReportAnalysis:
    """
    Executes the complete SIF intelligence analysis pipeline:
    1. Input validation
    2. LLM extraction (real LLM or fallback)
    3. Structured JSON / dict parsing
    4. Validation & normalization (taxonomy checks)
    5. Determine risk factors
    6. Deterministic Safety Priority Score calculation via risk engine
    7. Assign priority
    8. Generate/validate recommended action
    9. Return SafetyReportAnalysis with analysis_source
    """
    # 1. Input Validation
    if not report_text or not isinstance(report_text, str) or not report_text.strip():
        raise ValueError("Report text cannot be empty.")

    cleaned_text = report_text.strip()
    analysis_id = report_id if report_id else f"REP-{uuid.uuid4().hex[:8].upper()}"

    # 2. LLM Extraction Interface (returns dict with analysis_source)
    raw_extraction = analyze_with_llm(cleaned_text)

    # Track which engine produced the analysis
    analysis_source = raw_extraction.get("analysis_source", "fallback")
    logger.info(f"Analysis source: {analysis_source}")

    # 3. Structured Parsing & 4. Validation / Normalization
    raw_factors = raw_extraction.get("risk_factors", {})
    risk_factors = RiskFactors(
        critical_control_failure=bool(raw_factors.get("critical_control_failure", False)),
        direct_human_exposure=bool(raw_factors.get("direct_human_exposure", False)),
        high_energy_hazard=bool(raw_factors.get("high_energy_hazard", False)),
        serious_or_fatal_consequence=bool(raw_factors.get("serious_or_fatal_consequence", False)),
        life_saving_rule_violation=bool(raw_factors.get("life_saving_rule_violation", False)),
        recurring_pattern=bool(raw_factors.get("recurring_pattern", False)),
    )

    # 5 & 6. Deterministic Safety Priority Score Calculation
    safety_priority_score, risk_priority = calculate_safety_priority_score(risk_factors)

    # Validate taxonomy fields
    cleaned_lsrs = validate_life_saving_rules(raw_extraction.get("life_saving_rules", []))
    cleaned_precursors = validate_sif_precursors(raw_extraction.get("sif_precursors", []))
    cleaned_confidence = validate_confidence(raw_extraction.get("confidence", 0.85))

    # Update LSR violation flag if LSRs were dropped during validation
    if risk_factors.life_saving_rule_violation and not cleaned_lsrs:
        risk_factors.life_saving_rule_violation = False

    # 5. Multi-Dimensional Safety Recurrence Analysis
    evidence_list = clean_and_deduplicate_list(raw_extraction.get("evidence", []))
    similar_reports_list = clean_and_deduplicate_list(raw_extraction.get("similar_reports", []))
    recurring_patterns_list = clean_and_deduplicate_list(raw_extraction.get("recurring_patterns", []))

    try:
        from recurrence import analyze_recurrence_for_report
        recurrence_eval = analyze_recurrence_for_report(
            report_data={
                "report_id": analysis_id,
                "narrative": cleaned_text,
                "life_saving_rules": cleaned_lsrs,
                "sif_precursors": cleaned_precursors,
                "hazards": clean_and_deduplicate_list(raw_extraction.get("hazards", [])),
                "barriers": clean_and_deduplicate_list(raw_extraction.get("barriers", [])),
                "exposure": clean_and_deduplicate_list(raw_extraction.get("exposure", [])),
                "consequences": clean_and_deduplicate_list(raw_extraction.get("consequences", [])),
                "activity": normalize_string(raw_extraction.get("activity"), default=""),
                "equipment": clean_and_deduplicate_list(raw_extraction.get("equipment", [])),
                "country": normalize_string(raw_extraction.get("country"), default=""),
            },
            top_k=5,
            min_similarity=0.40,
        )

        # Merge discovered similar reports & recurring patterns
        if recurrence_eval.get("similar_reports"):
            similar_reports_list = recurrence_eval["similar_reports"]

        if recurrence_eval.get("recurring_patterns"):
            recurring_patterns_list = recurrence_eval["recurring_patterns"]

        # Activate recurring pattern risk factor if recurrence engine proves recurrence
        if recurrence_eval.get("is_recurring_pattern", False):
            risk_factors.recurring_pattern = True
            for note in recurrence_eval.get("evidence_notes", []):
                if note not in evidence_list:
                    evidence_list.append(note)

    except Exception as e:
        logger.warning(f"Recurrence analysis skipped/failed: {e}")

    # 6. Deterministic Safety Priority Score Calculation via Risk Engine
    safety_priority_score, risk_priority = calculate_safety_priority_score(risk_factors)

    # 8. Generate/validate recommended action
    raw_action = normalize_string(raw_extraction.get("recommended_action"), default="")
    recommended_action = _generate_recommended_action(risk_factors, raw_action)

    # 9. Final Result Assembly
    result = SafetyReportAnalysis(
        report_id=analysis_id,
        report_type=normalize_string(raw_extraction.get("report_type"), default="Incident/Near Miss"),
        date=normalize_string(raw_extraction.get("date"), default=""),
        country=normalize_string(raw_extraction.get("country"), default=""),
        region=normalize_string(raw_extraction.get("region"), default=""),
        function=normalize_string(raw_extraction.get("function"), default=""),
        activity=normalize_string(raw_extraction.get("activity"), default=""),
        location=normalize_string(raw_extraction.get("location"), default=""),
        equipment=clean_and_deduplicate_list(raw_extraction.get("equipment", [])),
        hazards=clean_and_deduplicate_list(raw_extraction.get("hazards", [])),
        barriers=clean_and_deduplicate_list(raw_extraction.get("barriers", [])),
        exposure=clean_and_deduplicate_list(raw_extraction.get("exposure", [])),
        consequences=clean_and_deduplicate_list(raw_extraction.get("consequences", [])),
        people_involved=clean_and_deduplicate_list(raw_extraction.get("people_involved", [])),
        life_saving_rules=cleaned_lsrs,
        sif_precursors=cleaned_precursors,
        evidence=evidence_list,
        risk_factors=risk_factors,
        risk_score=safety_priority_score,
        risk_priority=risk_priority,
        similar_reports=similar_reports_list,
        recurring_patterns=recurring_patterns_list,
        recommended_action=recommended_action,
        confidence=cleaned_confidence,
        human_verified=bool(raw_extraction.get("human_verified", False)),
        analysis_source=analysis_source,
        llm_model=raw_extraction.get("llm_model"),
    )

    return result