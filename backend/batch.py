"""
Batch Safety Triage Module for SIF Intelligence.

Provides batch analysis, ranking, cross-report insight aggregation,
and action prioritization for multiple safety reports.

Uses the existing single-report analyzer pipeline (Qwen3-8B → validation →
risk engine → FAISS → recurrence) for each report individually, then
aggregates results across the batch.
"""
import logging
from typing import Any, Dict, List, Optional
from collections import Counter

from analyzer import SafetyReportAnalysis, analyze_report

logger = logging.getLogger("sif_intelligence.batch")

# Priority tier ordering for sorting
_PRIORITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def analyze_batch(
    reports: List[Dict[str, str]],
    max_reports: int = 20,
) -> Dict[str, Any]:
    """
    Analyzes a batch of safety reports through the full SIF pipeline.

    Each report is processed independently. If one report fails, the batch
    continues — failures are collected separately.

    Args:
        reports: List of dicts with keys: text, filename (optional), source_type (optional)
        max_reports: Maximum number of reports to process (default 20)

    Returns:
        Dict with ranked_results, summary, cross_report_insights,
        action_priorities, and failures.
    """
    if not reports:
        raise ValueError("No reports provided for batch analysis.")

    if len(reports) > max_reports:
        raise ValueError(f"Batch size {len(reports)} exceeds maximum of {max_reports}.")

    successful: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []

    for idx, report_item in enumerate(reports):
        text = report_item.get("text", "").strip()
        filename = report_item.get("filename", f"report_{idx + 1}")
        source_type = report_item.get("source_type", "user_upload")

        if not text:
            failures.append({
                "index": idx,
                "filename": filename,
                "error": "Empty report text",
            })
            continue

        try:
            # Use the existing single-report analyzer pipeline
            result = analyze_report(text)
            # Convert to dict for manipulation
            result_dict = result.model_dump()
            result_dict["_batch_index"] = idx
            result_dict["_batch_filename"] = filename
            result_dict["_batch_source_type"] = source_type

            # Enrich with plain-English explanation fields
            result_dict["plain_english_what_happened"] = _generate_plain_english_what_happened(result_dict, text)
            result_dict["plain_english_why_dangerous"] = _generate_plain_english_why_dangerous(result_dict)
            result_dict["plain_english_what_went_wrong"] = _generate_plain_english_what_went_wrong(result_dict)
            result_dict["plain_english_why_prioritized"] = _generate_plain_english_why_prioritized(result_dict)

            successful.append(result_dict)
            logger.info(
                f"Batch [{idx + 1}/{len(reports)}] '{filename}': "
                f"score={result_dict['risk_score']}, priority={result_dict['risk_priority']}, "
                f"source={result_dict.get('analysis_source', 'unknown')}"
            )
        except Exception as e:
            logger.error(f"Batch [{idx + 1}/{len(reports)}] '{filename}' failed: {e}")
            failures.append({
                "index": idx,
                "filename": filename,
                "error": str(e),
            })

    # Rank successful results
    ranked = rank_results(successful)

    # Compute cross-report insights first so summary findings can reference them
    cross_insights = compute_cross_report_insights(successful)

    # Compute summary with dynamic plain-English findings
    summary = compute_batch_summary(successful, failures, cross_insights)

    # Generate action priorities
    actions = generate_action_priorities(cross_insights, successful)

    return {
        "ranked_results": ranked,
        "summary": summary,
        "cross_report_insights": cross_insights,
        "action_priorities": actions,
        "failures": failures,
    }


def rank_results(analyses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ranks analyzed reports by safety priority.

    Sort order:
    1. risk_priority tier (Critical > High > Medium > Low)
    2. risk_score descending
    3. Count of active risk factors descending
    4. Recurrence pattern count descending
    """
    def sort_key(item):
        priority_order = _PRIORITY_ORDER.get(item.get("risk_priority", "Low"), 3)
        score = -(item.get("risk_score", 0))
        rf = item.get("risk_factors", {})
        if isinstance(rf, dict):
            active_factors = -sum(1 for v in rf.values() if v is True)
        else:
            active_factors = 0
        recurrence = -(len(item.get("recurring_patterns", [])))
        return (priority_order, score, active_factors, recurrence)

    sorted_results = sorted(analyses, key=sort_key)

    # Assign priority_rank
    for rank, item in enumerate(sorted_results, start=1):
        item["priority_rank"] = rank

    return sorted_results


def _generate_plain_english_what_happened(report_dict: Dict[str, Any], original_text: str) -> str:
    """Produces a concise, plain-English summary of what happened."""
    narrative = original_text.strip()
    # If narrative is short (under 180 chars), use it directly as the clear statement
    if len(narrative) <= 220:
        return narrative
    
    # Otherwise summarize from activity, equipment, hazards
    activity = report_dict.get("activity") or "operational activity"
    equipment = ", ".join(report_dict.get("equipment", [])[:2])
    hazards = ", ".join(report_dict.get("hazards", [])[:2])
    
    # Split first sentence if clean
    first_sentence = narrative.split(". ")[0].strip()
    if len(first_sentence) > 20 and len(first_sentence) < 180:
        return first_sentence + "."
    
    if equipment and hazards:
        return f"During {activity}, an incident occurred involving {equipment} and {hazards}."
    return narrative[:180].rsplit(" ", 1)[0] + "..."


def _generate_plain_english_why_dangerous(report_dict: Dict[str, Any]) -> str:
    """Explains in simple human language why the condition is hazardous."""
    rf = report_dict.get("risk_factors", {})
    hazards = report_dict.get("hazards", [])
    hazard_str = f" ({', '.join(hazards[:2])})" if hazards else ""
    
    if rf.get("high_energy_hazard") and rf.get("direct_human_exposure"):
        return f"Workers were directly exposed to high-energy hazards{hazard_str} without verified barrier isolation, creating immediate risk of serious or fatal injury."
    elif rf.get("direct_human_exposure"):
        return f"Personnel were positioned directly in the line of fire or danger zone{hazard_str}."
    elif rf.get("high_energy_hazard"):
        return f"High-energy hazard present{hazard_str} with potential for uncontrolled release."
    elif rf.get("serious_or_fatal_consequence"):
        return "The operational conditions had the potential to result in severe or fatal consequences."
    elif rf.get("critical_control_failure"):
        return "A critical safety barrier was absent or bypassed during live operations."
    return "Standard operational safety safeguards were compromised during the task."


def _generate_plain_english_what_went_wrong(report_dict: Dict[str, Any]) -> str:
    """Explains in simple terms what safety control or procedure failed."""
    barriers = report_dict.get("barriers", [])
    lsrs = report_dict.get("life_saving_rules", [])
    
    if barriers and len(barriers) > 0:
        return f"The required barrier ({barriers[0]}) was failed, absent, or not verified before work commenced."
    elif lsrs and len(lsrs) > 0:
        return f"The mandatory {lsrs[0]} Life-Saving Rule procedure was not fully followed."
    return "Required safety controls existed in procedure but were not verified prior to task execution."


def _generate_plain_english_why_prioritized(report_dict: Dict[str, Any]) -> str:
    """Generates an evidence-grounded natural language explanation of why the report is ranked."""
    rf = report_dict.get("risk_factors", {})
    priority = report_dict.get("risk_priority", "Low")
    score = report_dict.get("risk_score", 0)
    
    reasons = []
    if rf.get("critical_control_failure"):
        reasons.append("a critical safety control failure")
    if rf.get("direct_human_exposure"):
        reasons.append("direct worker exposure in the line of fire")
    if rf.get("high_energy_hazard"):
        reasons.append("unisolated high-energy hazards")
    if rf.get("serious_or_fatal_consequence"):
        reasons.append("potential for serious consequences")
    if rf.get("life_saving_rule_violation"):
        reasons.append("a Life-Saving Rule non-conformance")
    if rf.get("recurring_pattern"):
        reasons.append("a recurring historical safety pattern")
        
    if not reasons:
        reasons.append("procedural safety observations")
        
    reasons_text = ", ".join(reasons[:-1]) + f" and {reasons[-1]}" if len(reasons) > 1 else reasons[0]
    
    if priority == "Critical":
        return f"Ranked for Immediate Attention ({score}/100) because it contains {reasons_text}."
    elif priority == "High":
        return f"Ranked as High Risk ({score}/100) because it involves {reasons_text}."
    elif priority == "Medium":
        return f"Ranked as Medium Priority ({score}/100) due to {reasons_text}."
    return f"Ranked as Standard Observation ({score}/100) with low energy exposure."


def _generate_batch_findings(
    analyses: List[Dict[str, Any]],
    cross_insights: Optional[Dict[str, Any]] = None,
) -> List[str]:
    """Generates 2-4 dynamic plain-English findings from the analyzed batch."""
    findings = []
    total = len(analyses)
    if total == 0:
        return findings

    # 1. Check repeated Life-Saving Rules
    if cross_insights and cross_insights.get("repeated_life_saving_rules"):
        top_lsr = cross_insights["repeated_life_saving_rules"][0]
        findings.append(
            f"{top_lsr['name']} controls were unverified or non-conforming across {top_lsr['count']} of {top_lsr['out_of']} reports ({top_lsr['percentage']}%)."
        )

    # 2. Check direct worker exposure / line of fire
    exposure_count = sum(1 for a in analyses if a.get("risk_factors", {}).get("direct_human_exposure"))
    if exposure_count > 0:
        findings.append(
            f"Workers were directly exposed to hazardous energy or equipment line-of-fire in {exposure_count} of {total} analyzed reports."
        )

    # 3. Check critical control failures
    control_fail_count = sum(1 for a in analyses if a.get("risk_factors", {}).get("critical_control_failure"))
    if control_fail_count > 0:
        findings.append(
            f"Required critical barrier controls existed in procedure but failed or were not verified prior to work in {control_fail_count} reports."
        )

    # 4. Check recurring patterns
    recurring_count = sum(1 for a in analyses if a.get("risk_factors", {}).get("recurring_pattern") or a.get("recurring_patterns"))
    if recurring_count >= 2:
        findings.append(
            f"Similar safety failures appear repeatedly across {recurring_count} reports, indicating a potential systemic process weakness."
        )
    elif len(findings) < 2 and total > 0:
        findings.append(
            f"Triage completed across {total} reports, establishing deterministic operational priorities and barrier verification requirements."
        )

    return findings[:4]


def compute_batch_summary(
    analyses: List[Dict[str, Any]],
    failures: List[Dict[str, Any]],
    cross_insights: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Computes batch-level summary statistics including plain-English findings.
    """
    total = len(analyses) + len(failures)
    priorities = Counter(a.get("risk_priority", "Low") for a in analyses)

    sif_signal_count = sum(
        1 for a in analyses
        if a.get("sif_precursors") and len(a["sif_precursors"]) > 0
    )

    recurring_count = sum(
        1 for a in analyses
        if a.get("recurring_patterns") and len(a["recurring_patterns"]) > 0
    )

    # Build top priority reports (top 10)
    sorted_by_score = sorted(analyses, key=lambda x: x.get("risk_score", 0), reverse=True)
    top_priority = []
    for rank_idx, a in enumerate(sorted_by_score[:10], start=1):
        top_priority.append({
            "rank": rank_idx,
            "report_id": a.get("report_id", ""),
            "priority": a.get("risk_priority", "Low"),
            "risk_score": a.get("risk_score", 0),
            "primary_sif_precursor": (a.get("sif_precursors") or ["—"])[0],
            "primary_life_saving_rule": (a.get("life_saving_rules") or ["—"])[0],
            "main_failed_barrier": (a.get("barriers") or ["—"])[0],
            "main_exposure": (a.get("exposure") or ["—"])[0],
            "filename": a.get("_batch_filename", ""),
            "analysis_source": a.get("analysis_source", "unknown"),
            "plain_english_what_happened": a.get("plain_english_what_happened", ""),
            "plain_english_why_dangerous": a.get("plain_english_why_dangerous", ""),
            "plain_english_why_prioritized": a.get("plain_english_why_prioritized", ""),
        })

    # Generate dynamic plain-English findings
    batch_findings = _generate_batch_findings(analyses, cross_insights)

    return {
        "total_reports": total,
        "analyzed_count": len(analyses),
        "failed_count": len(failures),
        "critical_count": priorities.get("Critical", 0),
        "high_count": priorities.get("High", 0),
        "medium_count": priorities.get("Medium", 0),
        "low_count": priorities.get("Low", 0),
        "sif_signal_count": sif_signal_count,
        "recurring_pattern_count": recurring_count,
        "top_priority_reports": top_priority,
        "batch_findings": batch_findings,
    }


def compute_cross_report_insights(analyses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregates cross-report intelligence to identify systemic patterns
    within the uploaded batch.

    Counts frequency of:
    - Life-Saving Rules
    - SIF precursors
    - Hazards
    - Failed barriers
    - Equipment
    - Activities
    - Exposure patterns
    """
    total = len(analyses)
    if total == 0:
        return {"total_reports": 0}

    lsr_counter = Counter()
    precursor_counter = Counter()
    hazard_counter = Counter()
    barrier_counter = Counter()
    equipment_counter = Counter()
    activity_counter = Counter()
    exposure_counter = Counter()

    for a in analyses:
        for lsr in (a.get("life_saving_rules") or []):
            lsr_counter[lsr] += 1
        for p in (a.get("sif_precursors") or []):
            precursor_counter[p] += 1
        for h in (a.get("hazards") or []):
            hazard_counter[h] += 1
        for b in (a.get("barriers") or []):
            barrier_counter[b] += 1
        for eq in (a.get("equipment") or []):
            equipment_counter[eq] += 1
        activity = a.get("activity", "")
        if activity:
            activity_counter[activity] += 1
        for exp in (a.get("exposure") or []):
            exposure_counter[exp] += 1

    def to_sorted_list(counter: Counter, label: str) -> List[Dict[str, Any]]:
        """Convert counter to sorted list of {name, count, percentage}."""
        items = []
        for name, count in counter.most_common():
            items.append({
                "name": name,
                "count": count,
                "percentage": round(count / total * 100, 1),
                "out_of": total,
            })
        return items

    # Identify clusters: items appearing in 2+ reports
    repeated_lsrs = [item for item in to_sorted_list(lsr_counter, "LSR") if item["count"] >= 2]
    repeated_precursors = [item for item in to_sorted_list(precursor_counter, "Precursor") if item["count"] >= 2]
    repeated_hazards = [item for item in to_sorted_list(hazard_counter, "Hazard") if item["count"] >= 2]
    repeated_barriers = [item for item in to_sorted_list(barrier_counter, "Barrier") if item["count"] >= 2]
    repeated_equipment = [item for item in to_sorted_list(equipment_counter, "Equipment") if item["count"] >= 2]
    repeated_activities = [item for item in to_sorted_list(activity_counter, "Activity") if item["count"] >= 2]
    repeated_exposure = [item for item in to_sorted_list(exposure_counter, "Exposure") if item["count"] >= 2]

    return {
        "total_reports": total,
        "life_saving_rules": to_sorted_list(lsr_counter, "LSR"),
        "sif_precursors": to_sorted_list(precursor_counter, "Precursor"),
        "hazards": to_sorted_list(hazard_counter, "Hazard"),
        "barriers": to_sorted_list(barrier_counter, "Barrier"),
        "equipment": to_sorted_list(equipment_counter, "Equipment"),
        "activities": to_sorted_list(activity_counter, "Activity"),
        "exposure": to_sorted_list(exposure_counter, "Exposure"),
        "repeated_life_saving_rules": repeated_lsrs,
        "repeated_sif_precursors": repeated_precursors,
        "repeated_hazards": repeated_hazards,
        "repeated_barriers": repeated_barriers,
        "repeated_equipment": repeated_equipment,
        "repeated_activities": repeated_activities,
        "repeated_exposure": repeated_exposure,
    }


def generate_action_priorities(
    cross_insights: Dict[str, Any],
    analyses: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Generates ranked recommended actions based on cross-report intelligence.

    Actions are derived ONLY from detected failed barriers, repeated LSR violations,
    and repeated hazards. No fabricated or unsupported actions.
    """
    actions = []
    seen = set()

    # 1. Actions from repeated failed barriers (highest priority)
    for item in cross_insights.get("repeated_barriers", []):
        barrier = item["name"]
        key = f"barrier:{barrier.lower()}"
        if key not in seen:
            seen.add(key)
            actions.append({
                "priority": len(actions) + 1,
                "action": f"Verify and strengthen: {barrier}",
                "basis": "failed_barrier",
                "frequency": f"{item['count']} of {item['out_of']} reports",
                "severity": "high" if item["count"] >= 3 else "medium",
            })

    # 2. Actions from repeated LSR violations
    for item in cross_insights.get("repeated_life_saving_rules", []):
        lsr = item["name"]
        key = f"lsr:{lsr.lower()}"
        if key not in seen:
            seen.add(key)
            actions.append({
                "priority": len(actions) + 1,
                "action": f"Reinforce Life-Saving Rule compliance: {lsr}",
                "basis": "life_saving_rule",
                "frequency": f"{item['count']} of {item['out_of']} reports",
                "severity": "high" if item["count"] >= 3 else "medium",
            })

    # 3. Actions from repeated hazards
    for item in cross_insights.get("repeated_hazards", [])[:5]:
        hazard = item["name"]
        key = f"hazard:{hazard.lower()}"
        if key not in seen:
            seen.add(key)
            actions.append({
                "priority": len(actions) + 1,
                "action": f"Address recurring hazard: {hazard}",
                "basis": "hazard",
                "frequency": f"{item['count']} of {item['out_of']} reports",
                "severity": "medium",
            })

    # Re-number priorities
    for i, act in enumerate(actions):
        act["priority"] = i + 1

    return actions
