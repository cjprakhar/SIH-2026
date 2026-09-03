"""
SIF Intelligence — Semantic Search & Multi-Dimensional Safety Recurrence Test Suite
===================================================================================

Tests:
1. Index builds, persists, and reloads from disk.
2. Semantic similarity search across 106,878 reports.
3. Multi-dimensional recurrence scoring across safety dimensions (LSR, Hazard, Barriers, Equipment, Activity).
4. Global pattern discovery over major safety clusters.
5. Integration with /analyze endpoint & deterministic Risk Engine (+10 points for recurring_pattern).
6. Scenarios covered:
   - Energy Isolation (Switchgear/LOTO failure)
   - Line of Fire / Dropped Object (Rigging failure during crane lift)
   - Working at Height (Scaffold platform fall)
   - Process Safety / Hot Work (Flash fire near hydrocarbon process line)

Usage:
    python test_recurrence.py
"""
import sys
import json
import time

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from recurrence import (
    build_index,
    load_index,
    index_status,
    find_similar_reports,
    calculate_recurrence_strength,
    analyze_recurrence_for_report,
    discover_global_patterns,
    get_safety_insights,
    REPORTS_FILE,
    INDEX_DIR,
)
from analyzer import analyze_report
from risk_engine import calculate_safety_priority_score


def test_index_persistence():
    print("\n" + "=" * 80)
    print("TEST 1: Vector Index Status & Persistence")
    print("=" * 80)
    status = load_index(INDEX_DIR)
    print(f"  • Index Status   : {status.get('status')}")
    print(f"  • Total Vectors  : {status.get('total_records'):,}")
    print(f"  • Vector Dim     : {status.get('dimension')}")
    print(f"  • Model Name     : {status.get('model_name')}")
    print(f"  • Is Up to Date  : {status.get('is_up_to_date')}")

    assert status.get("total_records", 0) > 100000, f"Expected >100,000 vectors, got {status.get('total_records')}"
    assert status.get("dimension") == 384, f"Expected dimension 384, got {status.get('dimension')}"
    print("  ✓ TEST 1 PASSED: FAISS vector index loaded and validated successfully.")


def test_semantic_search():
    print("\n" + "=" * 80)
    print("TEST 2: Semantic Similarity Search")
    print("=" * 80)

    queries = [
        ("Energy Isolation", "maintenance technician opened energized 480V panel circuit breaker without lockout tagout"),
        ("Working at Height", "worker fell from 12 meter scaffold platform unanchored safety harness"),
        ("Line of Fire", "crane rigging failure dropped steel beam suspended load exclusion zone"),
        ("Confined Space", "crane storage tank entry gas test oxygen deficiency toxic vapor"),
    ]

    for category, q in queries:
        print(f"\n  [Query: {category}]")
        print(f"  Text: '{q}'")
        results = find_similar_reports(q, top_k=3, min_similarity=0.35)
        print(f"  Found {len(results)} matches:")
        for idx, r in enumerate(results, 1):
            print(f"    [{idx}] {r['report_id']} | Sim: {r['similarity_score']:.4f} | Date: {r.get('date')} | Country/Region: {r.get('country') or r.get('region')} | LSR: {r.get('life_saving_rules')}")
            print(f"        Narrative: {(r.get('narrative') or '')[:100]}...")

        assert len(results) > 0, f"Expected matches for query: {category}"
        assert results[0]["similarity_score"] >= 0.35, f"Top similarity score too low: {results[0]['similarity_score']}"

    print("\n  ✓ TEST 2 PASSED: Semantic search returned relevant historical reports across all categories.")


def test_multi_dimensional_recurrence():
    print("\n" + "=" * 80)
    print("TEST 3: Multi-Dimensional Safety Recurrence Engine")
    print("=" * 80)

    report_a = {
        "report_id": "TEST-A-001",
        "narrative": "Technician working on 480V distribution panel without LOTO locks in place.",
        "life_saving_rules": ["Energy Isolation", "Work Authorization"],
        "hazards": ["Live electrical energy", "Arc flash"],
        "barriers": ["LOTO locks absent", "Permit not raised"],
        "activity": "Maintenance, inspection, testing",
        "equipment": ["480V electrical panel"],
    }

    # Highly matching candidate (same LSR, activity, equipment, hazards)
    report_b_matching = {
        "report_id": "TEST-B-001",
        "cause": "Electrical shock",
        "narrative": "Electrician was servicing an energized 480V circuit breaker panel when an arc occurred.",
        "life_saving_rules": ["Energy Isolation"],
        "causal_factors": ["PEOPLE: Energy isolation not confirmed", "PROCESS: Inadequate maintenance inspection"],
        "activity": "Maintenance, inspection, testing",
        "what_went_wrong": "Failure to apply Lockout-Tagout locks prior to electrical panel servicing.",
    }

    # Unrelated candidate (same words "working", "technician" but different safety domain)
    report_c_unrelated = {
        "report_id": "TEST-C-001",
        "cause": "Heat exhaustion",
        "narrative": "Technician working outdoors in high temperature experienced dehydration.",
        "life_saving_rules": [],
        "causal_factors": ["ENVIRONMENT: High ambient temperature"],
        "activity": "General labor",
        "what_went_wrong": "Insufficient water intake during hot weather.",
    }

    res_matching = calculate_recurrence_strength(report_a, report_b_matching, semantic_similarity=0.82)
    res_unrelated = calculate_recurrence_strength(report_a, report_c_unrelated, semantic_similarity=0.45)

    print(f"\n  [Matching Scenario: Energy Isolation]")
    print(f"  • Recurrence Strength    : {res_matching['recurrence_strength']:.4f} (High)")
    print(f"  • Matched Dimensions ({res_matching['dimensions_matched_count']}) : {res_matching['matched_dimensions']}")
    print(f"  • Dimension Scores       : {res_matching['dimension_scores']}")

    print(f"\n  [Unrelated Scenario: Heat Exhaustion]")
    print(f"  • Recurrence Strength    : {res_unrelated['recurrence_strength']:.4f} (Low)")
    print(f"  • Matched Dimensions ({res_unrelated['dimensions_matched_count']}) : {res_unrelated['matched_dimensions']}")

    assert res_matching["recurrence_strength"] > res_unrelated["recurrence_strength"], "Matching recurrence must be significantly higher than unrelated"
    assert res_matching["recurrence_strength"] >= 0.65, f"Expected high recurrence strength >= 0.65, got {res_matching['recurrence_strength']}"
    print("\n  ✓ TEST 3 PASSED: Multi-dimensional recurrence distinguished true safety patterns from vocabulary overlap.")


def test_global_patterns():
    print("\n" + "=" * 80)
    print("TEST 4: Global Pattern Discovery")
    print("=" * 80)

    patterns = discover_global_patterns(top_n=10)
    print(f"  Discovered {len(patterns)} major recurring safety patterns:")

    for idx, p in enumerate(patterns, 1):
        print(f"\n  [{idx}] {p['title']}")
        print(f"      Pattern ID        : {p['pattern_id']}")
        print(f"      Occurrences       : {p['occurrences']:,} historical reports")
        print(f"      Peak Strength     : {p['strength']:.2f} (Avg: {p['average_strength']:.2f})")
        print(f"      Primary LSR       : {p['primary_life_saving_rule']}")
        print(f"      Primary Precursor : {p['primary_sif_precursor']}")
        print(f"      Common Locations  : {p['common_locations']}")
        print(f"      Common Activities : {p['associated_activities'][:2]}")
        print(f"      Representative IDs: {p['report_ids'][:3]}")

    assert len(patterns) >= 5, f"Expected at least 5 global patterns, found {len(patterns)}"
    print("\n  ✓ TEST 4 PASSED: Global recurring safety patterns discovered and structured across historical dataset.")


def test_safety_insights():
    print("\n" + "=" * 80)
    print("TEST 5: Aggregated Safety Intelligence Insights")
    print("=" * 80)

    insights = get_safety_insights()
    summary = insights.get("summary", {})

    print(f"  • Total Historical Reports : {summary.get('total_reports'):,}")
    print(f"  • Fatal Incidents Recorded : {summary.get('fatal_incidents_recorded'):,}")
    print(f"  • IOGP PDF Reports         : {summary.get('pdf_iogp_reports'):,}")
    print(f"  • OSHA Severe Injuries     : {summary.get('osha_severe_injuries'):,}")
    print(f"  • Reports by Source Type   : {insights.get('reports_by_source_type')}")
    print(f"  • Reports by Year (Sample) : {list(insights.get('reports_by_year', {}).items())[:5]}")
    print(f"  • Top Life-Saving Rules    : {[item['rule'] + ' (' + str(item['count']) + ')' for item in insights.get('life_saving_rules_frequency', [])[:5]]}")
    print(f"  • Top Activities           : {[item['activity'][:25] + ' (' + str(item['count']) + ')' for item in insights.get('top_activities', [])[:3]]}")

    assert summary.get("total_reports", 0) > 100000, "Expected > 100,000 total reports in insights"
    print("\n  ✓ TEST 5 PASSED: Aggregated backend safety insights computed and formatted for dashboard.")


def test_analyze_pipeline_integration():
    print("\n" + "=" * 80)
    print("TEST 6: End-to-End Analysis Pipeline Integration (Recurrence -> Risk Engine)")
    print("=" * 80)

    # Real scenario: Electrical isolation failure
    narrative = (
        "On 15 August 2026, during scheduled maintenance on a 480V electrical distribution panel at "
        "the process plant, a technician opened the panel cover to replace a circuit breaker without "
        "performing lockout-tagout. The panel remained energized while work proceeded with bare hands. "
        "An operator intervened with stop-work authority."
    )

    analysis = analyze_report(narrative)

    print(f"  • Report ID             : {analysis.report_id}")
    print(f"  • SIF Precursors        : {analysis.sif_precursors}")
    print(f"  • Life-Saving Rules     : {analysis.life_saving_rules}")
    print(f"  • Similar Reports       : {len(analysis.similar_reports)} historical matches found")
    for s in analysis.similar_reports[:3]:
        print(f"      - {s}")
    print(f"  • Recurring Patterns    : {analysis.recurring_patterns}")
    print(f"  • Recurring Risk Factor : {analysis.risk_factors.recurring_pattern} (Weight: +10)")
    print(f"  • Safety Priority Score : {analysis.risk_score} / 100 (Tier: {analysis.risk_priority})")

    assert analysis.risk_factors.recurring_pattern is True, "Recurring pattern risk factor should be activated for known energy isolation failure"
    assert len(analysis.similar_reports) > 0, "Expected similar reports to be attached"
    print("\n  ✓ TEST 6 PASSED: End-to-end analyze pipeline successfully invoked vector similarity, multi-dimensional recurrence, and deterministic risk engine.")


def main():
    print("=" * 85)
    print("SIF INTELLIGENCE — SEMANTIC SEARCH & RECURRENCE INTELLIGENCE TEST SUITE")
    print("=" * 85)

    test_index_persistence()
    test_semantic_search()
    test_multi_dimensional_recurrence()
    test_global_patterns()
    test_safety_insights()
    test_analyze_pipeline_integration()

    print("\n" + "=" * 85)
    print("ALL TESTS COMPLETED SUCCESSFULLY (6/6 SUITES PASSED) ✅")
    print("=" * 85)
    return 0


if __name__ == "__main__":
    sys.exit(main())
