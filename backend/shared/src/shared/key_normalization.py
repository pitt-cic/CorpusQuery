"""Key normalization utilities for vector storage."""
import re
from pathlib import Path


def normalize_filename(filename: str) -> str:
    """Normalize a filename to a valid vector key prefix.

    'AURORA (final).pdf' -> 'aurora_final'
    'Sayali Nat Cancer.pdf' -> 'sayali_nat_cancer'
    """
    stem = Path(filename).stem
    normalized = re.sub(r"[^a-z0-9]", "_", stem.lower())
    return re.sub(r"_+", "_", normalized).strip("_")


def vector_key(normalized_prefix: str, chunk_idx: int) -> str:
    """Generate a vector key from prefix and chunk index.

    'aurora_final', 3 -> 'aurora_final_0003'
    """
    return f"{normalized_prefix}_{chunk_idx:04d}"
