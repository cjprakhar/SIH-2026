"""
Risk Engine Module for SIF Intelligence.

Calculates the deterministic Safety Priority Score based on precursor risk factors.
NOTE: This score represents an operational Safety Priority Score and must NOT be
described as probability of injury or fatality.
"""
from typing import Tuple, Dict, Any

# Defined weight coefficients for precursor risk factors
RISK_WEIGHTS: Dict[str, int] = {
    "critical_control_failure": 25,
    "direct_human_exposure": 20,
    "high_energy_hazard": 20,
    "serious_or_fatal_consequence": 15,
    "life_saving_rule_violation": 10,
    "recurring_pattern": 10,
}


def calculate_safety_priority_score(risk_factors: Any) -> Tuple[int, str]:
    """
    Calculates the deterministic Safety Priority Score and assigns a risk priority level.

    Scoring Weights:
    - critical_control_failure: 25
    - direct_human_exposure: 20
    - high_energy_hazard: 20
    - serious_or_fatal_consequence: 15
    - life_saving_rule_violation: 10
    - recurring_pattern: 10

    Priority Bands:
    - 80–100: Critical
    - 60–79: High
    - 35–59: Medium
    - 0–34: Low

    Returns:
        Tuple[int, str]: (safety_priority_score, risk_priority_label)
    """
    if hasattr(risk_factors, "model_dump"):
        factors_dict = risk_factors.model_dump()
    elif isinstance(risk_factors, dict):
        factors_dict = risk_factors
    else:
        factors_dict = getattr(risk_factors, "__dict__", {})

    score = 0
    for factor_name, weight in RISK_WEIGHTS.items():
        if factors_dict.get(factor_name, False):
            score += weight

    # Clamp score to 0..100 range
    score = max(0, min(100, score))

    if score >= 80:
        priority = "Critical"
    elif score >= 60:
        priority = "High"
    elif score >= 35:
        priority = "Medium"
    else:
        priority = "Low"

    return score, priority