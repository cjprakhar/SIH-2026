"""
SIF Intelligence — Historical Data Ingestion Layer
===================================================
Normalizes incident records from:
  - IOGP PDF reports (fatal, high-potential, process safety events)
  - OSHA IMIS CSV (USA severe injury reports)

into a unified schema saved to backend/data/reports.json.

Entry point: ingestion.ingest  (run via `python -m ingestion.ingest`)
"""
