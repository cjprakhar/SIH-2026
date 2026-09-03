"""
LLM Abstraction Layer for SIF Intelligence.

Provides a unified interface for extracting structured safety intelligence from raw reports.
Reads configuration from environment variables (.env) without hardcoding API keys.

Supports:
- Any OpenAI-compatible API endpoint (Qwen, Ollama, vLLM, HuggingFace, OpenAI, OpenRouter, LM Studio, etc.)
- Robust heuristic fallback when LLM is unavailable or fails.

IMPORTANT:
- The LLM is used ONLY for structured extraction, NOT for risk scoring.
- The final Safety Priority Score is always computed deterministically by risk_engine.py.
"""
import os
import re
import json
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

logger = logging.getLogger("sif_intelligence.llm")


# ---------------------------------------------------------------------------
# Dynamic Configuration Helper
# ---------------------------------------------------------------------------
def get_llm_config() -> Dict[str, Any]:
    """
    Reads LLM configuration dynamically from environment variables.
    Allows runtime reconfiguration via .env without server restart.
    """
    load_dotenv(override=True)
    return {
        "provider": os.getenv("LLM_PROVIDER", "openai_compatible").strip().lower(),
        "model": os.getenv("LLM_MODEL", "qwen/qwen3-8b").strip(),
        "api_key": (os.getenv("LLM_API_KEY", "").strip() or os.getenv("OPENROUTER_API_KEY", "").strip()),
        "base_url": os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").strip(),
        "timeout": int(os.getenv("LLM_TIMEOUT", "60")),
    }


# ---------------------------------------------------------------------------
# Structured Extraction System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are an expert occupational safety intelligence analyst. Your task is to analyze incident, near-miss, and hazard observation reports to extract structured safety intelligence.

You MUST return ONLY a valid JSON object. No markdown formatting outside the JSON, no explanations, no preamble, no commentary — ONLY the raw JSON object.

CRITICAL RULES:
1. FACTUAL GROUNDING: Extract ONLY facts that are explicitly stated or directly supported by the text. NEVER invent, assume, extrapolate, or hallucinate missing information.
2. MISSING VALUES: Return null for missing string/date fields and [] for missing list fields. If country, location, equipment, people, or consequences are not mentioned, return null or [].
3. DO NOT PREDICT: Do NOT predict future accidents, do NOT estimate probability of injury or death.
4. DO NOT SCORE: Do NOT calculate or output any risk score or risk priority tier. Risk scoring is performed deterministically by the backend.
5. MULTIPLE ENTITIES: Allow multiple hazards, multiple SIF precursors, and multiple Life-Saving Rules when supported by the narrative.
6. EVIDENCE REQUIRED: For every detected safety signal (Life-Saving Rule, SIF precursor, control failure, hazard), you MUST provide the exact or near-exact quote from the report as supporting evidence showing WHY it was detected.
7. CONFIDENCE SCORE: The "confidence" field (0.0 to 1.0) represents your confidence in the EXTRACTION ACCURACY, NOT accident or injury probability.

CANONICAL LIFE-SAVING RULES & OPERATIONAL CRITERIA:
Assign a Life-Saving Rule ONLY when the report text provides direct evidence of the activity, failure, or hazard:
- Energy Isolation: Apply when isolating electrical (480V, 10kV), hydraulic, mechanical, or pipeline energy; LOTO; zero-energy verification.
- Safe Mechanical Lifting: Apply when crane operations, rigging, lifting slings, hoists, casing lifts, or suspended load movements are involved.
- Line of Fire: Apply when personnel are positioned in the path of moving machinery, pinch points, suspended loads, high-pressure fluid surges, or falling objects.
- Working at Height: Apply when work is performed on scaffolds, elevated platforms, roofs, ladders (>=1.8m), or whenever falls from elevation occur.
- Confined Space: Apply when entering vessels, tanks, pits, underground trenches, or poorly ventilated enclosed spaces.
- Hot Work: Apply when welding, torch cutting, open flame heating, or spark-producing tools are used near flammable/hydrocarbon atmospheres.
- Toxic / Hazardous Substances: Apply when dealing with H2S gas, carbon monoxide, sour fluids, chemical leaks, or toxic atmospheric releases.
- Driving: Apply when operating motor vehicles, transport trucks, field driving, or vehicle rollover/accidents occur.
- Work Authorization: Apply when work proceeds without required Permit to Work (PTW), bypassed Job Safety Analysis (JSA), or lack of formal work permit.
- Bypassing Safety Controls: Apply when safety interlocks, gas alarms, relief valves, or emergency shutdown (ESD) systems are bypassed, disabled, or ignored.

CANONICAL SIF PRECURSORS:
- Falls from Height: Falls from scaffolds, ladders, roofs, structures, or elevation.
- Struck-By: Struck by moving vehicles, machinery, swinging equipment, or tools.
- Caught-In / Caught-Between: Caught in pinch points, rotating shafts, crushing between objects.
- Line of Fire: Exposure in trajectory of energy, fluids, loads, or projectiles.
- Dropped Object: Falling tools, scaffold boards, structural beams, or lifted loads dropped from height.
- Hazardous Energy: Exposure to high voltage, pressurized lines (>10 bar), steam, high temperature, or chemical energy.
- Energy Isolation Failure: LOTO not applied, failed lock, inadequate isolation mechanism, unverified zero energy.
- Confined Space: Entry into oxygen-deficient or hazardous atmosphere enclosures.
- Vehicle / Mobile Equipment Interaction: Forklifts, trucks, cranes, or mobile plant interaction with pedestrians/infrastructure.
- Lifting / Rigging Failure: Broken sling, failed shackle, dropped crane load, overloaded hoist.
- Hot Work: Flash fires, ignition of residual vapors during welding/cutting.
- Pressure Release: Sudden rupture, burst pipe, blown gasket, or high-velocity fluid/gas surge.
- Process Safety / Loss of Primary Containment: Uncontrolled release of hydrocarbons, crude oil, gas leaks from process piping/tanks.
- Bypassed / Inadequate Critical Control: Missing safety guard, ignored gas monitor alarm, missing barrier.

RECURRENCE DIMENSIONS TO EXTRACT:
- location: specific site/location if explicitly mentioned (null otherwise)
- equipment: list of specific equipment/machinery involved ([] if none)
- hazards: list of specific physical/operational hazards identified
- barriers: list of safety barriers/controls present, missing, or failed
- exposure: list of exposed personnel, roles, or targets
- consequences: list of realized or direct potential consequences stated in report
- people_involved: list of roles or personnel mentioned in narrative

RISK FACTORS (Boolean evaluation based strictly on report evidence):
- critical_control_failure: true if a critical barrier/control failed, was missing, was bypassed, or was inadequate
- direct_human_exposure: true if personnel were directly exposed in the hazard zone or line of fire
- high_energy_hazard: true if high energy was present (high voltage, heavy machinery, suspended load, pressure, chemicals, height >= 1.8m)
- serious_or_fatal_consequence: true if report describes a realized or immediate potential serious injury, fatality, or catastrophic event
- life_saving_rule_violation: true if one or more canonical Life-Saving Rules were violated or non-conformed

OUTPUT JSON SCHEMA:
{
  "report_type": "<Incident | Near Miss | Hazard Observation | Safety Alert | null>",
  "date": "<date mentioned in report or null>",
  "country": "<country if explicitly mentioned in report or null>",
  "region": "<region/area if explicitly mentioned in report or null>",
  "function": "<business function/department if mentioned or null>",
  "activity": "<activity being performed or null>",
  "location": "<specific location/site if mentioned or null>",
  "equipment": ["<equipment 1>", "<equipment 2>"],
  "hazards": ["<hazard 1>", "<hazard 2>"],
  "barriers": ["<barrier 1>", "<barrier 2>"],
  "exposure": ["<exposure 1>", "<exposure 2>"],
  "consequences": ["<consequence 1>", "<consequence 2>"],
  "people_involved": ["<role 1>", "<role 2>"],
  "life_saving_rules": ["<Canonical Life-Saving Rule>"],
  "sif_precursors": ["<Canonical SIF Precursor>"],
  "evidence": [
    {"signal": "<Canonical Rule or Precursor Name>", "evidence": "<Verbatim sentence or clause from the report text>"}
  ],
  "recommended_action": "<Targeted, evidence-based corrective or preventive recommendation>",
  "confidence": <float between 0.0 and 1.0 representing extraction confidence>,
  "critical_control_failure": <true/false>,
  "direct_human_exposure": <true/false>,
  "high_energy_hazard": <true/false>,
  "serious_or_fatal_consequence": <true/false>,
  "life_saving_rule_violation": <true/false>
}"""


USER_PROMPT_TEMPLATE = """Analyze the following occupational safety narrative and extract structured safety intelligence according to the specified JSON schema.

SAFETY REPORT TEXT:
\"\"\"
{report_text}
\"\"\"

Return ONLY the JSON object. Do NOT enclose in explanations or markdown outside the JSON."""


# ---------------------------------------------------------------------------
# Real LLM Client (OpenAI-compatible API)
# ---------------------------------------------------------------------------
def _call_llm_api(report_text: str) -> Dict[str, Any]:
    """
    Calls a real LLM via OpenAI-compatible chat completions API.
    Returns the parsed dict from the LLM's JSON response.

    Raises:
        RuntimeError: On API failure, timeout, malformed JSON, or missing credentials.
    """
    config = get_llm_config()
    provider = config["provider"]
    model = config["model"]
    api_key = config["api_key"]
    base_url = config["base_url"]
    timeout = config["timeout"]

    # Validate credentials
    if not api_key and not base_url:
        raise RuntimeError(
            "LLM credentials not configured. Set LLM_API_KEY and/or LLM_BASE_URL in .env"
        )

    # Import openai library
    try:
        from openai import OpenAI, APIError, APITimeoutError, APIConnectionError, RateLimitError
    except ImportError:
        raise RuntimeError(
            "openai package is not installed. Run: pip install openai>=1.30.0"
        )

    # Build client
    client_kwargs: Dict[str, Any] = {
        "timeout": float(timeout),
    }
    if api_key:
        client_kwargs["api_key"] = api_key
    else:
        # Local endpoints like Ollama don't require an API key
        client_kwargs["api_key"] = "not-needed"

    if base_url:
        client_kwargs["base_url"] = base_url
        if "openrouter.ai" in base_url:
            client_kwargs["default_headers"] = {
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "SIF Intelligence",
            }

    client = OpenAI(**client_kwargs)
    user_prompt = USER_PROMPT_TEMPLATE.format(report_text=report_text)

    logger.info(f"Calling LLM: provider={provider}, model={model}, base_url={base_url or 'default'}")

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=4096,
        )
    except APITimeoutError:
        raise RuntimeError(f"LLM API request timed out after {timeout}s")
    except APIConnectionError as e:
        raise RuntimeError(f"LLM API connection failed: {e}")
    except RateLimitError as e:
        raise RuntimeError(f"LLM API rate limit exceeded: {e}")
    except APIError as e:
        raise RuntimeError(f"LLM API error: {e}")
    except Exception as e:
        raise RuntimeError(f"Unexpected LLM error ({type(e).__name__}): {e}")

    # Extract response text
    if not response.choices:
        raise RuntimeError("LLM returned empty response (no choices returned)")

    raw_content = response.choices[0].message.content
    if not raw_content or not raw_content.strip():
        raise RuntimeError("LLM returned empty message content")

    # Clean response text
    json_text = raw_content.strip()

    # Strip thinking blocks from reasoning models (e.g., DeepSeek-R1 / Qwen-QwQ)
    json_text = re.sub(r'<think>.*?</think>', '', json_text, flags=re.DOTALL).strip()

    # Strip markdown code fences if present
    if "```" in json_text:
        json_text = re.sub(r'^```(?:json)?\s*\n?', '', json_text)
        json_text = re.sub(r'\n?```\s*$', '', json_text)
        json_text = json_text.strip()

    # Attempt JSON parse
    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        # Fallback: extract the outermost JSON object with regex
        match = re.search(r'\{[\s\S]*\}', json_text)
        if match:
            try:
                parsed = json.loads(match.group())
            except json.JSONDecodeError as e2:
                raise RuntimeError(
                    f"LLM returned malformed JSON: {e2}. Raw snippet: {raw_content[:300]}"
                )
        else:
            raise RuntimeError(
                f"LLM response does not contain valid JSON. Raw snippet: {raw_content[:300]}"
            )

    if not isinstance(parsed, dict):
        raise RuntimeError(f"LLM returned {type(parsed).__name__} instead of a JSON dictionary")

    logger.info(f"LLM structured extraction succeeded with {len(parsed)} keys")
    return parsed


def _normalize_llm_output(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes the raw LLM output into the structured dictionary format expected
    by the analyzer pipeline. Converts evidence pairs to clean formatted strings
    and maps risk factors.
    """
    result = dict(raw)

    # Normalize evidence: LLM returns list of {"signal": "...", "evidence": "..."} dicts
    # Flatten to formatted strings "[Signal]: Evidence" while preserving schema compatibility
    raw_evidence = result.get("evidence", [])
    normalized_evidence = []

    if isinstance(raw_evidence, list):
        for item in raw_evidence:
            if isinstance(item, dict):
                signal = str(item.get("signal", "")).strip()
                ev = str(item.get("evidence", "")).strip()
                if signal and ev:
                    normalized_evidence.append(f"{signal}: {ev}")
                elif ev:
                    normalized_evidence.append(ev)
                elif signal:
                    normalized_evidence.append(signal)
            elif isinstance(item, str) and item.strip():
                normalized_evidence.append(item.strip())
    elif isinstance(raw_evidence, str) and raw_evidence.strip():
        normalized_evidence.append(raw_evidence.strip())

    result["evidence"] = normalized_evidence

    # Structure risk_factors from top-level booleans
    result["risk_factors"] = {
        "critical_control_failure": bool(result.pop("critical_control_failure", False)),
        "direct_human_exposure": bool(result.pop("direct_human_exposure", False)),
        "high_energy_hazard": bool(result.pop("high_energy_hazard", False)),
        "serious_or_fatal_consequence": bool(result.pop("serious_or_fatal_consequence", False)),
        "life_saving_rule_violation": bool(result.pop("life_saving_rule_violation", False)),
        "recurring_pattern": bool(result.pop("recurring_pattern", False)),
    }

    # Ensure list fields are lists
    list_fields = [
        "equipment", "hazards", "barriers", "exposure", "consequences",
        "people_involved", "life_saving_rules", "sif_precursors"
    ]
    for field in list_fields:
        val = result.get(field)
        if val is None:
            result[field] = []
        elif not isinstance(val, list):
            result[field] = [str(val)] if str(val).strip() else []

    # Tag source and model
    result["analysis_source"] = "llm"
    result["llm_model"] = get_llm_config()["model"]

    return result


# ---------------------------------------------------------------------------
# Heuristic Fallback Engine (Deterministic Keyword / Rule NLP)
# ---------------------------------------------------------------------------
def _heuristic_safety_extract(report_text: str) -> Dict[str, Any]:
    """
    Deterministic rule-assisted NLP fallback extractor that extracts safety precursors,
    hazards, controls, and risk indicators directly from raw report text when
    the real LLM is unavailable or fails.
    """
    text_lower = report_text.lower()

    # Precursor & Risk Factor detection patterns
    high_energy_keywords = [
        "high voltage", "480v", "voltage", "crane", "suspended load", "pressurized", "pressure",
        "steam", "heavy machinery", "forklift", "excavator", "explosive", "flash fire",
        "scaffold", "height", "12 meters", "chemical", "radiation", "falling object", "rotating equipment"
    ]
    direct_exposure_keywords = [
        "worker", "technician", "operator", "crew", "personnel", "standing under",
        "struck by", "caught in", "pinch point", "near", "hands", "finger", "body", "breathing",
        "bare hands", "dive out of the way", "swing radius", "inspectors entered"
    ]
    control_failure_keywords = [
        "guard missing", "unlocked", "no permit", "bypassed", "failure", "failed",
        "malfunction", "damaged", "broken", "inadequate", "not wearing", "missing ppe",
        "interlock disabled", "no barricade", "unsecured", "isolated improperly",
        "lockout-tagout procedure was not performed", "skipped", "expired", "missing",
        "without testing", "violated"
    ]
    serious_consequence_keywords = [
        "fatal", "death", "amputation", "fracture", "crush", "hospitalization",
        "loss of containment", "explosion", "severe burn", "disability", "head injury",
        "deep laceration", "oxygen-deficient", "dizzy and short of breath", "flash fire"
    ]
    life_saving_rule_keywords = {
        "Energy Isolation": ["loto", "lockout", "tagout", "isolation", "energized", "breaker", "480v", "live components"],
        "Line of Fire": ["line of fire", "suspended load", "pinch point", "struck by", "swing radius", "rebound", "beam was being lifted"],
        "Working at Height": ["fall", "height", "scaffold", "ladder", "harness", "elevated", "12 meters"],
        "Confined Space": ["confined space", "tank", "vessel", "entry permit", "oxygen", "manhole", "storage tank"],
        "Hot Work": ["hot work", "welding", "grinding", "spark", "cutting", "flash fire"],
        "Safe Mechanical Lifting": ["lifting", "rigging", "crane", "hoist", "sling", "overload", "suspended load"],
        "Bypassing Safety Controls": ["bypass", "tampered", "override", "disabled interlock", "shortcut", "skipped"],
        "Driving": ["vehicle", "speeding", "collision", "seatbelt", "forklift rollover"],
        "Toxic / Hazardous Substances": ["toxic", "chemical spill", "asphyxiation", "h2s", "acid", "gas leak", "hydrocarbon vapors"],
        "Work Authorization": ["permit", "ptw", "unauthorized", "work plan", "jsa", "entry permit", "hot work permit"]
    }

    # Identify matching factors
    has_high_energy = any(kw in text_lower for kw in high_energy_keywords)
    has_direct_exposure = any(kw in text_lower for kw in direct_exposure_keywords)
    has_control_failure = any(kw in text_lower for kw in control_failure_keywords)
    has_serious_consequence = any(kw in text_lower for kw in serious_consequence_keywords)

    identified_lsrs = []
    for lsr_name, patterns in life_saving_rule_keywords.items():
        if any(p in text_lower for p in patterns):
            identified_lsrs.append(lsr_name)

    has_lsr_violation = len(identified_lsrs) > 0
    has_recurring = any(kw in text_lower for kw in ["recurring", "repeated", "previous incident", "again"])

    # SIF Precursor mapping
    sif_precursors = []
    if "fall" in text_lower or "height" in text_lower or "scaffold" in text_lower:
        sif_precursors.append("Falls from Height")
    if "suspended load" in text_lower or "sling" in text_lower or "crane" in text_lower or "rigging" in text_lower:
        sif_precursors.append("Lifting / Rigging Failure")
        sif_precursors.append("Line of Fire")
    if "480v" in text_lower or "energized" in text_lower or "lockout" in text_lower or "isolation" in text_lower:
        sif_precursors.append("Energy Isolation Failure")
        sif_precursors.append("Hazardous Energy")
    if "confined space" in text_lower or "storage tank" in text_lower or "oxygen" in text_lower:
        sif_precursors.append("Confined Space")
    if "welding" in text_lower or "hot work" in text_lower or "flash fire" in text_lower or "process line" in text_lower:
        sif_precursors.append("Hot Work")
        sif_precursors.append("Process Safety / Loss of Primary Containment")
    if has_control_failure:
        sif_precursors.append("Bypassed / Inadequate Critical Control")

    # Deduplicate precursors
    seen_prec = set()
    dedup_precursors = []
    for p in sif_precursors:
        if p not in seen_prec:
            seen_prec.add(p)
            dedup_precursors.append(p)

    # Extract hazards
    hazards = []
    if "480v" in text_lower or "energized" in text_lower or "electrical" in text_lower:
        hazards.append("Live electrical energy (480V)")
    if "suspended" in text_lower or "crane" in text_lower or "lifting" in text_lower:
        hazards.append("Suspended load / Rigging failure hazard")
    if "height" in text_lower or "scaffold" in text_lower:
        hazards.append("Work at height (fall hazard)")
    if "tank" in text_lower or "oxygen" in text_lower or "confined" in text_lower:
        hazards.append("Hazardous/oxygen-deficient atmosphere in enclosed vessel")
    if "welding" in text_lower or "process line" in text_lower or "sparks" in text_lower:
        hazards.append("Flammable atmosphere ignition / Hot work near process lines")
    if not hazards:
        hazards.append("Operational safety hazard")

    # Extract evidence sentences
    sentences = re.split(r'[.!?\n]+', report_text)
    evidence = []
    for s in sentences:
        s_clean = s.strip()
        if not s_clean or len(s_clean) < 15:
            continue
        s_lower = s_clean.lower()
        if any(k in s_lower for k in [
            "failed", "witnessed", "observed", "struck", "bypassed", "without", "warning",
            "damage", "injured", "dropped", "near", "not performed", "skipped", "energized",
            "slipped", "swing radius", "expired", "missing", "dizzy", "ignited", "violated"
        ]):
            evidence.append(s_clean)
        if len(evidence) >= 4:
            break

    if not evidence:
        evidence = [report_text[:150] + "..."]

    # Recommended action synthesis
    if has_control_failure or has_lsr_violation:
        rec_action = (
            "Immediately suspend work, re-establish verified critical controls, "
            "and conduct mandatory stand-down & verification of Life-Saving Rules."
        )
    elif has_high_energy:
        rec_action = (
            "Verify isolation barriers and establish a positive physical "
            "exclusion zone around the high-energy hazard area."
        )
    else:
        rec_action = (
            "Review task risk assessment (JSA) and reinforce worker hazard awareness "
            "during pre-job safety briefings."
        )

    # Date / Type extraction heuristic
    date_match = re.search(r'\b(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})\b', report_text)
    extracted_date = date_match.group(1) if date_match else None

    report_type = "Near Miss" if "near miss" in text_lower else "Incident"

    return {
        "report_type": report_type,
        "date": extracted_date,
        "country": None,
        "region": None,
        "function": None,
        "activity": None,
        "location": None,
        "equipment": [],
        "hazards": hazards,
        "barriers": [],
        "exposure": ["Field Personnel"] if has_direct_exposure else [],
        "consequences": [],
        "people_involved": [],
        "life_saving_rules": identified_lsrs,
        "sif_precursors": dedup_precursors,
        "evidence": evidence,
        "risk_factors": {
            "critical_control_failure": has_control_failure,
            "direct_human_exposure": has_direct_exposure,
            "high_energy_hazard": has_high_energy,
            "serious_or_fatal_consequence": has_serious_consequence,
            "life_saving_rule_violation": has_lsr_violation,
            "recurring_pattern": has_recurring,
        },
        "similar_reports": [],
        "recurring_patterns": [],
        "recommended_action": rec_action,
        "confidence": 0.70,
        "analysis_source": "fallback",
        "llm_model": None,
    }


# ---------------------------------------------------------------------------
# Public Extraction Interface
# ---------------------------------------------------------------------------
def analyze_with_llm(report_text: str) -> Dict[str, Any]:
    """
    LLM Abstraction interface.
    Extracts structured precursor intelligence from raw safety report text.

    Execution Strategy:
    1. If LLM_PROVIDER is "heuristic" → directly execute heuristic fallback engine.
    2. If LLM_PROVIDER is an OpenAI-compatible provider and credentials/URL exist → call real LLM.
    3. On any failure (missing key, network error, timeout, malformed JSON) → automatically
       fall back to heuristic engine and mark analysis_source="fallback".

    Returns:
        Dict containing structured safety intelligence fields with 'analysis_source'.
    """
    config = get_llm_config()
    provider = config["provider"]

    # Forced heuristic mode
    if provider == "heuristic":
        logger.info("LLM_PROVIDER='heuristic' configured — executing fallback engine directly")
        return _heuristic_safety_extract(report_text)

    # Check for supported provider types
    supported_providers = [
        "openai_compatible", "openai", "ollama", "vllm", "huggingface", "openrouter", "lmstudio"
    ]
    if provider not in supported_providers:
        logger.warning(
            f"Unsupported LLM_PROVIDER '{provider}'. Supported: {supported_providers}. "
            "Falling back to heuristic engine."
        )
        return _heuristic_safety_extract(report_text)

    # Attempt real LLM extraction
    try:
        raw_llm_output = _call_llm_api(report_text)
        normalized = _normalize_llm_output(raw_llm_output)
        logger.info("Real LLM extraction succeeded (analysis_source='llm')")
        return normalized

    except RuntimeError as e:
        logger.warning(f"LLM extraction failed ({e}). Falling back to heuristic engine.")
        return _heuristic_safety_extract(report_text)

    except Exception as e:
        logger.error(
            f"Unexpected error during LLM extraction: {type(e).__name__}: {e}. "
            "Falling back to heuristic engine."
        )
        return _heuristic_safety_extract(report_text)