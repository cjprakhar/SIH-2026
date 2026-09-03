# SIF Intelligence — Real AI Core & Safety Intelligence Engine

AI/NLP Precursor Detection Engine to Identify Serious Injury & Fatality (SIF) Precursors in Safety Reports.
Backed by 106,878 normalized historical records, persistent vector indexing, semantic search, and multi-dimensional safety recurrence intelligence.

---

## 1. System Architecture & Pipeline

```
Unstructured Safety Report Narrative
                 │
                 ▼
     FastAPI Ingestion Layer
       (POST /analyze, /health)
                 │
                 ▼
       Real LLM Extraction
     (OpenAI-compatible: Qwen3-8B)
   [Structured JSON + Evidence Quotes]
   [Auto-fallback on API/model failure]
                 │
                 ▼
  Taxonomy Validation & Normalization
(Life-Saving Rules, Precursors, Bounds)
                 │
                 ▼
        Sentence Embedding
   (all-MiniLM-L6-v2 — 384 dim)
                 │
                 ▼
    Persistent FAISS Vector Index
   (106,878 records, IndexFlatIP)
                 │
                 ▼
     Semantic Similarity Search
    (top-k cosine similarity, ≥0.35)
                 │
                 ▼
  Multi-Dimensional Safety Recurrence
 (11 structured safety dimensions scored)
                 │
                 ▼
   Risk Factor Update (if recurring)
   risk_factors.recurring_pattern = True
                 │
                 ▼
       Deterministic Risk Engine
     (Precursor Factor Weight Sum)
                 │
                 ▼
  Safety Priority Score & Priority Tier
    (Critical / High / Medium / Low)
                 │
                 ▼
       Final API Response
(Pydantic SafetyReportAnalysis Schema)
```

---

## 2. Core Architectural Principles

1. **LLM Extracts Facts & Evidence Only**: The LLM extracts entities, canonical Life-Saving Rules, SIF precursors, evidence quotes, and boolean risk factors. **The LLM NEVER computes the risk score or priority tier directly.**
2. **Deterministic Risk Engine**: The final Safety Priority Score is computed strictly by `risk_engine.py` using calibrated precursor weights.
3. **No Hallucination / Zero Speculation**: Missing entities (country, location, equipment, people) return `null` or `[]`. The model never predicts future accidents or fatality probabilities.
4. **Evidence-Based Grounding**: For every detected safety signal, the model extracts direct supporting quotes demonstrating *why* that signal was triggered.
5. **Multi-Provider LLM Agility**: Operates with any OpenAI-compatible API endpoint (Qwen, Ollama, vLLM, HuggingFace, OpenAI, OpenRouter, LM Studio).
6. **Graceful Fallback**: If the LLM is unreachable, unconfigured, or returns invalid output, the system seamlessly uses the heuristic rule/keyword NLP engine, explicitly tagging `analysis_source="fallback"`.

---

## 3. Embedding Model

**Model**: `sentence-transformers/all-MiniLM-L6-v2`

| Property | Value |
| :--- | :--- |
| Vector Dimension | 384 |
| Architecture | 6-layer MiniLM transformer |
| Max Sequence Length | 256 tokens |
| Similarity Metric | Cosine similarity (via L2 normalization + FAISS Inner Product) |
| Inference Mode | Local CPU/GPU (no external API required) |
| Model Cache Location | Local cache (offline mode supported) |

**Embedding Representation Construction** (per report):
```text
Narrative: {narrative}
| What went wrong: {what_went_wrong}
| Cause: {cause}
| Activity: {activity}
| Life-Saving Rules: {life_saving_rules}
| Causal factors: {causal_factors[:3]}
```
Missing fields are skipped safely without throwing errors.

---

## 4. Vector Index Architecture

**Index Type**: FAISS `IndexFlatIP` (Exact Inner Product over L2-normalized unit vectors = Cosine Similarity)

| Property | Value |
| :--- | :--- |
| Total Vectors Indexed | 106,878 records |
| Index File | `backend/data/index/faiss.index` (~157 MB) |
| Metadata File | `backend/data/index/metadata.json` (~69 MB) |
| Index Info File | `backend/data/index/index_info.json` |
| Fast Lookup Map | Direct Vector ID → Metadata & Hash Map `report_id` → Metadata |
| Cache Invalidation | SHA-256 / mtime dataset fingerprinting (no unnecessary rebuilds on start) |

---

## 5. Semantic Similarity vs. Recurring Safety Pattern

> ⚠️ **Critical Distinction**:

* **Semantic Similarity**: Measures textual and vocabulary closeness in 384-dimensional embedding vector space. It answers: *"Do these report descriptions sound linguistically similar?"*
* **Recurring Safety Pattern**: Analyzes multi-dimensional structural convergence across operational safety dimensions. It answers: *"Do these incidents share the exact same underlying mechanism of failure, failed barrier, hazard, and Life-Saving Rule violation?"*

**We explicitly state**:
* Wording used: *"Recurring safety pattern detected"*
* We do **NOT** claim proven root cause, statistical causation, or accident probability prediction.

---

## 6. Multi-Dimensional Recurrence Scoring

When candidate reports are retrieved by semantic search, `calculate_recurrence_strength()` computes transparent dimensional alignment:

| Dimension | Weight | Criteria |
| :--- | :---: | :--- |
| **Life-Saving Rules** | +0.25 | Overlap in validated canonical LSRs |
| **Hazards & SIF Precursors** | +0.20 | Overlap in physical hazards & precursor categories |
| **Barriers / Critical Controls** | +0.15 | Overlap in failed barriers & controls |
| **Activity & Function** | +0.15 | Overlap in work activity & operational department |
| **Equipment** | +0.10 | Overlap in machinery & tools involved |
| **Exposure, Consequence & Cause** | +0.10 | Overlap in personnel exposure & consequence severity |
| **Semantic Similarity** | +0.10× | Normalized baseline cosine similarity contribution |

**Multi-Dimension Convergence Bonus**:
* +0.10 boost if 3 or more structural dimensions match.
* +0.08 additional boost if 4 or more structural dimensions match.

When strong recurrence is detected (strength ≥ 0.55 or multi-case convergence), `risk_factors.recurring_pattern` is automatically activated (`True`), adding **+10 points** to the deterministic Safety Priority Score.

---

## 7. Global Pattern Discovery

`discover_global_patterns()` discovers systemic clusters across all 106,878 reports without expensive $O(N^2)$ pairwise loops:

* Seeded across core IOGP Life-Saving Rules and SIF precursor clusters.
* Aggregates common locations, equipment, hazards, failed barriers, exposures, consequences, and activities.
* Results are persisted to `backend/data/index/global_patterns.json` for immediate API response.

### 10 Core Discovered Global Safety Patterns:
1. **Line of Fire / Dropped Object** (Primary LSR: *Line of Fire*, Precursor: *Dropped Object*)
2. **Working at Height & Scaffold Fall** (Primary LSR: *Working at Height*, Precursor: *Falls from Height*)
3. **Confined Space & Hazardous Atmosphere** (Primary LSR: *Confined Space*, Precursor: *Confined Space*)
4. **Safe Mechanical Lifting & Rigging Failure** (Primary LSR: *Safe Mechanical Lifting*, Precursor: *Lifting / Rigging Failure*)
5. **Vehicle / Mobile Equipment & Driving Incidents** (Primary LSR: *Driving*, Precursor: *Vehicle / Mobile Equipment Interaction*)
6. **Hot Work / Flammable Atmosphere Flash Fire** (Primary LSR: *Hot Work*, Precursor: *Hot Work*)
7. **Toxic / Hazardous Substance Loss of Containment** (Primary LSR: *Toxic / Hazardous Substances*, Precursor: *Loss of Containment*)
8. **Pressurized System & Pressure Release** (Primary LSR: *Energy Isolation*, Precursor: *Pressure Release*)
9. **Energy Isolation Failure** (Primary LSR: *Energy Isolation*, Precursor: *Energy Isolation Failure*)
10. **Bypassing Safety Controls & Interlocks** (Primary LSR: *Bypassing Safety Controls*, Precursor: *Inadequate Critical Control*)

---

## 8. Safety Insights (Aggregated Dashboard Analytics)

`GET /insights` aggregates backend data across all 106,878 records:
* **Total Reports**: 106,878 records
* **Breakdown by Source**: OSHA Severe Injury Reports (105,991), IOGP Process Safety Events (412), IOGP High Potential Incidents (358), IOGP Fatal Incidents (117)
* **Temporal Distribution**: Year-by-year trends from 2015 to 2026
* **Taxonomy Frequency**: Top Life-Saving Rules, Top SIF Precursors, Top Activities, Top Causes
* **Geographic Distribution**: Top countries and regions/states

---

## 9. API Endpoints

### System & Index Management
* `GET /health` — Service health check.
* `GET /index/status` — FAISS vector index status, dimensions, total records, and freshness.
* `POST /index/build` — Trigger vector index build or reload (`force_rebuild: bool`, `batch_size: int`).

### Core Analysis
* `POST /analyze` — Full pipeline: LLM extraction → embedding → similar historical reports → multi-dimensional recurrence → deterministic Safety Priority Score.

### Semantic Search
* `POST /similar` — Semantic similarity search with cosine similarity and optional `source_type` filter.
```json
{
  "query": "technician opened electrical panel without lockout tagout",
  "top_k": 5,
  "min_similarity": 0.35,
  "source_type": null
}
```

### Recurrence Intelligence & Patterns
* `GET /patterns` — Discover global recurring safety patterns across historical dataset (`top_n=15`).
* `POST /patterns/search` — Search recurring patterns by keyword or description.
* `GET /patterns/{pattern_id}` — Retrieve detailed recurring pattern with common equipment, hazards, barriers, exposures, and sample reports.

### Dashboard Insights & Historical Records
* `GET /insights` — Aggregated safety intelligence dashboard metrics.
* `GET /reports` — Paginated historical safety records (`limit`, `offset`, `source_type`).
* `GET /reports/{report_id}` — Retrieve single historical report by ID.

---

## 10. Running & Testing

```bash
cd backend
.venv\Scripts\activate   # Windows (.venv/bin/activate on Linux/Mac)

# Run full recurrence & semantic test suite (6 suites)
python test_recurrence.py

# Run API integration test suite
python test_api.py

# Start FastAPI server
uvicorn main:app --reload --port 8000
```

Interactive Swagger API documentation is available at `http://localhost:8000/docs`.