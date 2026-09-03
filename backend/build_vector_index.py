"""
build_vector_index.py — CLI tool to generate sentence embeddings and build persistent FAISS vector index.
"""
import sys
import time
from pathlib import Path

# Ensure UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from recurrence import build_index, index_status, REPORTS_FILE, INDEX_DIR

def main():
    print("=" * 70)
    print("SIF INTELLIGENCE — VECTOR INDEX BUILDER")
    print("=" * 70)
    print(f"Reports file : {REPORTS_FILE}")
    print(f"Index dir    : {INDEX_DIR}")
    print()

    t0 = time.time()
    result = build_index(
        reports_file=REPORTS_FILE,
        index_dir=INDEX_DIR,
        batch_size=512,
        force_rebuild=True,
    )

    elapsed = time.time() - t0
    print("\n" + "=" * 70)
    print("VECTOR INDEX BUILD COMPLETE")
    print("=" * 70)
    print(f"Status        : {result.get('status')}")
    print(f"Total records : {result.get('total_records'):,}")
    print(f"Dimensions    : {result.get('dimension')}")
    print(f"Model name    : {result.get('model_name')}")
    print(f"Total time    : {elapsed:.1f}s")
    print("=" * 70)

if __name__ == "__main__":
    main()
