"""Tests for key normalization utilities."""
import pytest

from shared.key_normalization import normalize_filename, vector_key


def test_normalize_aurora():
    assert normalize_filename("AURORA (final).pdf") == "aurora_final"


def test_normalize_sayali():
    assert normalize_filename("Sayali Nat Cancer.pdf") == "sayali_nat_cancer"


def test_normalize_camo():
    assert normalize_filename("CAMO pnas.2202584120.pdf") == "camo_pnas_2202584120"


def test_normalize_strips_leading_trailing_underscores():
    assert normalize_filename("_leading trailing_.pdf") == "leading_trailing"


def test_normalize_collapses_consecutive_separators():
    assert normalize_filename("two  spaces.pdf") == "two_spaces"


def test_normalize_all_uppercase():
    assert normalize_filename("UPPERCASE.pdf") == "uppercase"


def test_vector_key_zero_padded():
    assert vector_key("aurora_final", 3) == "aurora_final_0003"


def test_vector_key_large_index():
    assert vector_key("aurora_final", 1234) == "aurora_final_1234"
