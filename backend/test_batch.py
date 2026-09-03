"""
SIF Intelligence — Batch Safety Triage Integration & Unit Test Suite

Tests:
1. Batch of 3 reports: execution, ranking, summary counts, cross-report insights.
2. Batch of 5 reports: multi-dimensional recurrence aggregation.
3. Batch of 10 reports: scale and sorting precision.
4. Partial failure handling: 1 invalid empty report does NOT crash batch.
5. Deterministic priority ranking logic (Tier > Score > Risk Factors > Recurrence).
6. Cross-report insight aggregation & action prioritization.
7. POST /analyze/batch API endpoint integration via TestClient.
"""
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Add current directory to path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import app
from batch import analyze_batch, rank_results, compute_cross_report_insights, generate_action_priorities


class TestBatchSafetyTriage(unittest.TestCase):
    """Test suite for batch safety triage functionality."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

        # 3 Real/Representative test reports
        cls.reports_3 = [
            {
                "filename": "Report 1 - Electrical 480V",
                "source_type": "real_iogp",
                "text": "During maintenance of a 480V electrical panel, a technician began replacing a circuit breaker before lockout-tagout was applied or zero energy verified. The technician was exposed to energized electrical equipment."
            },
            {
                "filename": "Report 2 - Scaffold Fall at Height",
                "source_type": "real_iogp",
                "text": "A worker stepped onto an unanchored scaffold plank at 14m height without attaching a safety harness lanyard to the static lifeline. The plank shifted causing a near-miss fall."
            },
            {
                "filename": "Report 3 - Lifting Near Miss",
                "source_type": "real_iogp",
                "text": "During crane lifting of a 2-ton casing across the deck, the load swung into the exclusion zone where riggers were standing. No spotter was assigned."
            }
        ]

        # 5 reports
        cls.reports_5 = cls.reports_3 + [
            {
                "filename": "Report 4 - Hot Work Flash Fire",
                "source_type": "real_iogp",
                "text": "A welder ignited an open flame torch near a crude tank without a valid hot work permit or combustible gas test. Residual vapors flashed."
            },
            {
                "filename": "Report 5 - Electrical Switchgear",
                "source_type": "real_iogp",
                "text": "An electrician opened an energized 10KV switchgear cabinet without isolation verification. A missing safety interlock allowed direct contact."
            }
        ]

        # 10 reports
        cls.reports_10 = cls.reports_5 + [
            {
                "filename": "Report 6 - Confined Space Sludge",
                "source_type": "benchmark_demo",
                "text": "Operators entered a crude storage tank without continuous atmospheric oxygen monitoring. Oxygen level inside was measured at 17.5%."
            },
            {
                "filename": "Report 7 - High Pressure Flange Leak",
                "source_type": "benchmark_demo",
                "text": "During pipeline startup at 2000 psi, a flange gasket failed releasing high-pressure condensate. Personnel evacuated the perimeter."
            },
            {
                "filename": "Report 8 - Dropped Tubular",
                "source_type": "benchmark_demo",
                "text": "A 5-inch drill pipe slipped from the elevator during hoisting and dropped 8 meters onto the drill floor. Exclusion zone was clear."
            },
            {
                "filename": "Report 9 - Vehicle Rollover",
                "source_type": "benchmark_demo",
                "text": "A pickup truck transporting personnel rolled over on an unpaved access road due to excessive speed and unbuckled seatbelts."
            },
            {
                "filename": "Report 10 - Line of Fire Casing",
                "source_type": "benchmark_demo",
                "text": "An assistant driller was positioned between a moving casing joint and the rotary table. The driller halted the hoist immediately."
            }
        ]

    def test_01_batch_3_reports(self):
        """Test batch analysis with 3 reports."""
        result = analyze_batch(self.reports_3)
        self.assertIn("ranked_results", result)
        self.assertIn("summary", result)
        self.assertIn("cross_report_insights", result)
        self.assertIn("action_priorities", result)

        summary = result["summary"]
        self.assertEqual(summary["total_reports"], 3)
        self.assertEqual(summary["analyzed_count"], 3)
        self.assertEqual(summary["failed_count"], 0)
        self.assertGreaterEqual(summary["sif_signal_count"], 1)

        # Verify ranking order
        ranked = result["ranked_results"]
        self.assertEqual(len(ranked), 3)
        for i, item in enumerate(ranked):
            self.assertEqual(item["priority_rank"], i + 1)
            self.assertIn(item["risk_priority"], ["Critical", "High", "Medium", "Low"])
            self.assertGreater(item["risk_score"], 0)

        print("\n[PASS] Test 1: Batch of 3 reports successfully analyzed & ranked.")

    def test_02_batch_5_reports(self):
        """Test batch analysis with 5 reports and cross-report clustering."""
        result = analyze_batch(self.reports_5)
        summary = result["summary"]
        self.assertEqual(summary["total_reports"], 5)
        self.assertEqual(summary["analyzed_count"], 5)

        insights = result["cross_report_insights"]
        self.assertIn("life_saving_rules", insights)
        self.assertIn("barriers", insights)
        self.assertIn("repeated_life_saving_rules", insights)

        # Check Energy Isolation appears in multiple electrical reports
        lsr_names = [item["name"] for item in insights["life_saving_rules"]]
        self.assertTrue(any("energy" in name.lower() or "isolation" in name.lower() or "electricity" in name.lower() for name in lsr_names))

        print("[PASS] Test 2: Batch of 5 reports analyzed with cross-report clustering.")

    def test_03_batch_10_reports(self):
        """Test batch analysis with 10 reports."""
        result = analyze_batch(self.reports_10)
        summary = result["summary"]
        self.assertEqual(summary["total_reports"], 10)
        self.assertEqual(summary["analyzed_count"], 10)
        self.assertEqual(len(result["ranked_results"]), 10)

        # Verify all ranks from 1 to 10 are present
        ranks = [r["priority_rank"] for r in result["ranked_results"]]
        self.assertEqual(ranks, list(range(1, 11)))

        print("[PASS] Test 3: Batch of 10 reports analyzed and ranked 1..10.")

    def test_04_partial_failure_handling(self):
        """Test that an invalid/empty report does not crash the batch."""
        mixed_batch = [
            {
                "filename": "Valid Report 1",
                "text": "A technician opened a 480V panel with bare hands without lockout-tagout."
            },
            {
                "filename": "Empty Invalid Report",
                "text": "   "  # whitespace only
            },
            {
                "filename": "Valid Report 2",
                "text": "Scaffold plank shifted at 12m height because lanyard was not hooked to lifeline."
            }
        ]

        result = analyze_batch(mixed_batch)
        summary = result["summary"]
        self.assertEqual(summary["total_reports"], 3)
        self.assertEqual(summary["analyzed_count"], 2)
        self.assertEqual(summary["failed_count"], 1)

        # Failures list captured the error
        self.assertEqual(len(result["failures"]), 1)
        self.assertEqual(result["failures"][0]["filename"], "Empty Invalid Report")

        # Successful items are still ranked
        self.assertEqual(len(result["ranked_results"]), 2)
        self.assertEqual(result["ranked_results"][0]["priority_rank"], 1)
        self.assertEqual(result["ranked_results"][1]["priority_rank"], 2)

        print("[PASS] Test 4: Partial failure gracefully isolated, valid reports ranked.")

    def test_05_deterministic_ranking_order(self):
        """Test the deterministic rank_results function specifically."""
        mock_analyses = [
            {
                "report_id": "REP-LOW",
                "risk_priority": "Low",
                "risk_score": 20,
                "risk_factors": {"critical_control_failure": False},
                "recurring_patterns": []
            },
            {
                "report_id": "REP-CRIT-95",
                "risk_priority": "Critical",
                "risk_score": 95,
                "risk_factors": {"critical_control_failure": True, "direct_human_exposure": True},
                "recurring_patterns": ["Recurrence 1"]
            },
            {
                "report_id": "REP-CRIT-85",
                "risk_priority": "Critical",
                "risk_score": 85,
                "risk_factors": {"critical_control_failure": True},
                "recurring_patterns": []
            },
            {
                "report_id": "REP-HIGH",
                "risk_priority": "High",
                "risk_score": 65,
                "risk_factors": {"high_energy_hazard": True},
                "recurring_patterns": []
            }
        ]

        ranked = rank_results(mock_analyses)
        self.assertEqual(ranked[0]["report_id"], "REP-CRIT-95")
        self.assertEqual(ranked[0]["priority_rank"], 1)
        self.assertEqual(ranked[1]["report_id"], "REP-CRIT-85")
        self.assertEqual(ranked[1]["priority_rank"], 2)
        self.assertEqual(ranked[2]["report_id"], "REP-HIGH")
        self.assertEqual(ranked[2]["priority_rank"], 3)
        self.assertEqual(ranked[3]["report_id"], "REP-LOW")
        self.assertEqual(ranked[3]["priority_rank"], 4)

        print("[PASS] Test 5: Deterministic priority ranking orders Critical > High > Medium > Low.")

    def test_06_action_prioritization(self):
        """Test that action priorities are derived from detected cross-report patterns."""
        cross_insights = {
            "repeated_barriers": [
                {"name": "Lockout Tagout Isolation", "count": 3, "out_of": 5, "percentage": 60.0}
            ],
            "repeated_life_saving_rules": [
                {"name": "Energy Isolation", "count": 3, "out_of": 5, "percentage": 60.0}
            ],
            "repeated_hazards": [
                {"name": "Energized High Voltage Terminals", "count": 2, "out_of": 5, "percentage": 40.0}
            ]
        }

        actions = generate_action_priorities(cross_insights, [])
        self.assertEqual(len(actions), 3)
        self.assertEqual(actions[0]["priority"], 1)
        self.assertIn("Lockout Tagout", actions[0]["action"])
        self.assertEqual(actions[0]["basis"], "failed_barrier")

        print("[PASS] Test 6: Action prioritization correctly grounded in failed barriers.")

    def test_07_api_endpoint_batch(self):
        """Test POST /analyze/batch endpoint via FastAPI TestClient."""
        payload = {
            "reports": [
                {
                    "text": "Electrical breaker replaced without LOTO.",
                    "filename": "electrical.txt",
                    "source_type": "user_upload"
                },
                {
                    "text": "Unanchored scaffold fall near miss.",
                    "filename": "scaffold.txt",
                    "source_type": "user_upload"
                }
            ]
        }

        response = self.client.post("/analyze/batch", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("summary", data)
        self.assertEqual(data["summary"]["analyzed_count"], 2)
        self.assertEqual(len(data["ranked_results"]), 2)

        print("[PASS] Test 7: POST /analyze/batch HTTP 200 validated.")


if __name__ == "__main__":
    unittest.main()
