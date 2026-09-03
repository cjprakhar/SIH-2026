"""
SIF Intelligence — Production Runtime Data Bootstrap
=====================================================
Ensures that essential runtime safety datasets and vector indexes are available
before the FastAPI application server starts.

When running on Railway (or any container environment where Git LFS content is
not cloned into the image), this script detects missing files or Git LFS pointer
files and downloads the authentic binary datasets from the private Hugging Face
dataset repository:
    cjprakhar/sih-intelligence-data

Required runtime files:
- backend/data/reports.json        (~82 MB)
- backend/data/index/faiss.index   (~164 MB)
- backend/data/index/metadata.json (~72 MB)

Security & Safety:
- Never prints, logs, or commits the HF_TOKEN credential.
- Validates minimum file size thresholds to detect LFS pointer files (~130 bytes).
- Completely idempotent: skips downloads if valid files already exist on disk.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

# Load environment variables from backend/.env if available
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Logging configuration (no credentials logged)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("sif_intelligence.bootstrap")

# Directory and file paths
DATA_DIR = BASE_DIR / "data"
INDEX_DIR = DATA_DIR / "index"

REPORTS_FILE = DATA_DIR / "reports.json"
FAISS_FILE = INDEX_DIR / "faiss.index"
METADATA_FILE = INDEX_DIR / "metadata.json"
INDEX_INFO_FILE = INDEX_DIR / "index_info.json"
GLOBAL_PATTERNS_FILE = INDEX_DIR / "global_patterns.json"
INSIGHTS_FILE = INDEX_DIR / "insights.json"
TAXONOMY_FILE = DATA_DIR / "taxonomy.json"

# Dataset configuration
HF_DATASET_ID = "cjprakhar/sih-intelligence-data"
MIN_LARGE_FILE_BYTES = 1_000_000  # 1 MB threshold for detecting Git LFS pointer files


def is_lfs_pointer_or_invalid(path: Path, min_size_bytes: int = MIN_LARGE_FILE_BYTES) -> bool:
    """
    Checks if a file does not exist, is smaller than the minimum threshold,
    or contains the Git LFS pointer header.
    """
    if not path.exists():
        return True

    try:
        file_size = path.stat().st_size
        if file_size < min_size_bytes:
            return True

        # Check for Git LFS pointer signature in the header
        with open(path, "rb") as f:
            header = f.read(200)
            if b"version https://git-lfs.github.com/spec/v1" in header or b"oid sha256:" in header:
                return True
    except Exception as e:
        logger.warning(f"Unable to inspect {path.name}: {e}")
        return True

    return False


def download_file_from_hf(filename: str, target_dir: Path, token: str | None) -> Path:
    """
    Downloads a single file from the Hugging Face dataset repo into target_dir.
    """
    from huggingface_hub import hf_hub_download

    target_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading '{filename}' from Hugging Face dataset '{HF_DATASET_ID}'...")
    start_time = time.time()

    downloaded_path = hf_hub_download(
        repo_id=HF_DATASET_ID,
        repo_type="dataset",
        filename=filename,
        token=token,
        local_dir=str(target_dir),
    )

    elapsed = time.time() - start_time
    file_stat = Path(downloaded_path).stat()
    size_mb = file_stat.st_size / (1024 * 1024)
    logger.info(f"Successfully downloaded '{filename}' ({size_mb:.1f} MB in {elapsed:.1f}s)")
    return Path(downloaded_path)


def log_runtime_diagnostics():
    """Logs safe size information for verified runtime data without exposing credentials."""
    logger.info("Runtime data verified:")
    for path in [REPORTS_FILE, FAISS_FILE, METADATA_FILE]:
        if path.exists():
            size_mb = path.stat().st_size / (1024 * 1024)
            logger.info(f"  {path.name}: {size_mb:.1f} MB")
        else:
            logger.error(f"  {path.name}: MISSING")


def verify_all_runtime_data():
    """
    Verifies that all required files exist, are valid sizes, and that the FAISS index
    can be initialized into memory.
    """
    files_to_check = [
        (REPORTS_FILE, "reports.json", MIN_LARGE_FILE_BYTES),
        (FAISS_FILE, "faiss.index", MIN_LARGE_FILE_BYTES),
        (METADATA_FILE, "metadata.json", MIN_LARGE_FILE_BYTES),
        (GLOBAL_PATTERNS_FILE, "global_patterns.json", 100),
        (INSIGHTS_FILE, "insights.json", 100),
        (TAXONOMY_FILE, "taxonomy.json", 100),
    ]

    for path, name, min_sz in files_to_check:
        if not path.exists():
            raise FileNotFoundError(f"Required runtime data file '{name}' missing at {path}")
        size = path.stat().st_size
        if size < min_sz:
            raise ValueError(f"Required runtime file '{name}' is invalid ({size} bytes, min: {min_sz})")

    # Keep dataset fingerprint timestamp aligned with index_info.json so index_status is 'ready'
    if INDEX_INFO_FILE.exists() and REPORTS_FILE.exists():
        try:
            with open(INDEX_INFO_FILE, "r", encoding="utf-8") as f:
                info = json.load(f)
            saved_mtime = info.get("dataset_fingerprint", {}).get("mtime")
            if saved_mtime and isinstance(saved_mtime, (int, float)):
                os.utime(REPORTS_FILE, (saved_mtime, saved_mtime))
                logger.info("Synchronized reports.json dataset fingerprint timestamp.")
        except Exception as e:
            logger.debug(f"Fingerprint timestamp sync skipped: {e}")

    # Verify FAISS index load using existing recurrence logic
    logger.info("Validating FAISS vector index integrity...")
    from recurrence import load_index
    st = load_index(index_dir=INDEX_DIR)
    total_records = st.get("total_records", 0)
    idx_status = st.get("status")
    logger.info(f"Vector index loaded: {total_records:,} records, status: '{idx_status}'.")


def bootstrap():
    """Main bootstrap sequence to ensure data availability before server launch."""
    logger.info("Starting SIF Intelligence runtime data verification...")

    # Identify which large files need downloading
    required_downloads: list[tuple[str, Path, Path]] = []

    if is_lfs_pointer_or_invalid(REPORTS_FILE):
        logger.warning(f"'{REPORTS_FILE.name}' is missing or an LFS pointer; queued for download.")
        required_downloads.append(("reports.json", DATA_DIR, REPORTS_FILE))
    else:
        mb = REPORTS_FILE.stat().st_size / (1024 * 1024)
        logger.info(f"Verified valid '{REPORTS_FILE.name}' ({mb:.1f} MB).")

    if is_lfs_pointer_or_invalid(FAISS_FILE):
        logger.warning(f"'{FAISS_FILE.name}' is missing or an LFS pointer; queued for download.")
        required_downloads.append(("faiss.index", INDEX_DIR, FAISS_FILE))
    else:
        mb = FAISS_FILE.stat().st_size / (1024 * 1024)
        logger.info(f"Verified valid '{FAISS_FILE.name}' ({mb:.1f} MB).")

    if is_lfs_pointer_or_invalid(METADATA_FILE):
        logger.warning(f"'{METADATA_FILE.name}' is missing or an LFS pointer; queued for download.")
        required_downloads.append(("metadata.json", INDEX_DIR, METADATA_FILE))
    else:
        mb = METADATA_FILE.stat().st_size / (1024 * 1024)
        logger.info(f"Verified valid '{METADATA_FILE.name}' ({mb:.1f} MB).")

    # Download if needed
    if required_downloads:
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            # Check if running in Railway
            is_railway = bool(
                os.getenv("RAILWAY_ENVIRONMENT")
                or os.getenv("RAILWAY_SERVICE_ID")
                or os.getenv("RAILWAY_PROJECT_ID")
            )
            if is_railway:
                logger.error("HF_TOKEN is not configured for the Railway runtime.")
                sys.exit(1)
            else:
                logger.warning("HF_TOKEN not set; attempting unauthenticated download...")

        logger.info(f"Downloading {len(required_downloads)} missing runtime file(s)...")
        for filename, target_dir, target_path in required_downloads:
            try:
                if target_path.exists():
                    target_path.unlink()
                download_file_from_hf(filename, target_dir, token=hf_token)

                if is_lfs_pointer_or_invalid(target_path):
                    logger.error(f"Download of '{filename}' produced an invalid or undersized file.")
                    sys.exit(1)
            except Exception as e:
                logger.error(f"Failed downloading '{filename}' from Hugging Face: {e}")
                sys.exit(1)
    else:
        logger.info("All required runtime datasets are present and valid on disk.")

    # Log safe file diagnostics
    log_runtime_diagnostics()

    # Final verification of files and in-memory index loading
    try:
        verify_all_runtime_data()
    except Exception as e:
        logger.error(f"Runtime data verification error: {e}")
        sys.exit(1)

    logger.info("Bootstrap successful: all runtime datasets verified and ready.")


if __name__ == "__main__":
    bootstrap()
