"""
SIF Intelligence — FastAPI API Integration Test Suite

Tests:
1. GET /health
2. POST /analyze (Valid report)
3. POST /analyze (Empty text error handling)
4. LLM mocking & live test integration (testing analysis_source='llm' vs 'fallback')
5. Schema compliance of API response
"""
import sys
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from main import app
from analyzer import SafetyReportAnalysis

client = TestClient(app)


class TestSIFIntelligenceAPI(unittest.TestCase):

    def test_health_check(self):
        """Verify GET /health endpoint."""
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "SIF Intelligence API")
        print("[PASS] GET /health:", data)

    def test_analyze_fallback(self):
        """Verify POST /analyze returns valid schema with fallback source when no LLM key."""
        payload = {
            "text": (
                "On 15 August 2026, a maintenance technician opened a 480V panel without LOTO. "
                "The panel was energized. A supervisor halted work."
            )
        }
        response = client.post("/analyze", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify schema validity through Pydantic
        analysis = SafetyReportAnalysis(**data)
        self.assertIn(analysis.analysis_source, ["llm", "fallback"])
        self.assertGreaterEqual(analysis.risk_score, 0)
        self.assertLessEqual(analysis.risk_score, 100)
        self.assertIn(analysis.risk_priority, ["Critical", "High", "Medium", "Low"])
        print(f"[PASS] POST /analyze (fallback/live): Score: {analysis.risk_score}, Priority: {analysis.risk_priority}, Source: {analysis.analysis_source}")

    def test_analyze_empty_input(self):
        """Verify POST /analyze rejects empty or whitespace-only input."""
        response = client.post("/analyze", json={"text": "   "})
        self.assertEqual(response.status_code, 400)
        print("[PASS] POST /analyze (empty input validation): HTTP 400")

    def test_analyze_with_mocked_real_llm(self):
        """Verify that when real LLM succeeds, analysis_source is 'llm' and score is computed by risk engine."""
        mock_llm_response = {
            "report_type": "Near Miss",
            "date": "15 August 2026",
            "country": None,
            "region": None,
            "function": "Maintenance",
            "activity": "Circuit breaker replacement",
            "location": "Process Plant Electrical Room",
            "equipment": ["480V electrical distribution panel", "Circuit breaker"],
            "hazards": ["Live 480V electrical energy", "Arc flash"],
            "barriers": ["LOTO locks absent", "Permit to work skipped"],
            "exposure": ["Maintenance technician with bare hands"],
            "consequences": ["Potential electrocution or fatal shock"],
            "people_involved": ["Maintenance technician", "Operator"],
            "life_saving_rules": ["Energy Isolation", "Work Authorization"],
            "sif_precursors": ["Energy Isolation Failure", "Hazardous Energy", "Bypassed / Inadequate Critical Control"],
            "evidence": [
                {"signal": "Energy Isolation Failure", "evidence": "lockout-tagout procedure was not performed prior to commencing work"},
                {"signal": "Critical Control Failure", "evidence": "permit to work had not been raised and isolation verification step was skipped"}
            ],
            "recommended_action": "Enforce mandatory LOTO verification and permit-to-work compliance before opening electrical enclosures.",
            "confidence": 0.95,
            "critical_control_failure": True,
            "direct_human_exposure": True,
            "high_energy_hazard": True,
            "serious_or_fatal_consequence": True,
            "life_saving_rule_violation": True,
        }

        with patch("llm._call_llm_api", return_value=mock_llm_response):
            payload = {
                "text": "On 15 August 2026, during maintenance on a 480V panel, technician worked without LOTO."
            }
            response = client.post("/analyze", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Verify source
            self.assertEqual(data["analysis_source"], "llm")
            # Verify deterministic score: 25 (control) + 20 (exposure) + 20 (energy) + 15 (consequence) + 10 (LSR) + 10 (recurring_pattern) = 100 (Critical)
            self.assertEqual(data["risk_score"], 100)
            self.assertEqual(data["risk_priority"], "Critical")
            self.assertEqual(data["confidence"], 0.95)
            self.assertEqual(len(data["life_saving_rules"]), 2)
            self.assertEqual(len(data["sif_precursors"]), 3)
            self.assertIn("Energy Isolation Failure: lockout-tagout procedure was not performed prior to commencing work", data["evidence"])
            print(f"[PASS] POST /analyze (Real LLM flow): Score: {data['risk_score']}, Priority: {data['risk_priority']}, Source: {data['analysis_source']}")

    def test_llm_failure_graceful_fallback(self):
        """Verify that on LLM API timeout or error, the pipeline gracefully falls back to heuristic."""
        with patch("llm._call_llm_api", side_effect=RuntimeError("Connection timeout")):
            payload = {
                "text": "Technician fell from 12 meter scaffold without connected harness."
            }
            response = client.post("/analyze", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["analysis_source"], "fallback")
            self.assertGreater(data["risk_score"], 0)
            print(f"[PASS] POST /analyze (LLM failure graceful fallback): Source: {data['analysis_source']}, Score: {data['risk_score']}")


if __name__ == "__main__":
    unittest.main()

