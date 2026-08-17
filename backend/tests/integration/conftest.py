"""Integration test fixtures — loads real AWS configuration."""
import os
from pathlib import Path

import boto3
import pytest
from dotenv import load_dotenv

# Load environment from .env.integration
env_path = Path(__file__).parent.parent.parent / ".env.integration"
load_dotenv(env_path)

# S3 Vectors config (Path A)
VECTOR_BUCKET = os.environ.get("VECTOR_BUCKET", "corpus-query-vectors-dev")
VECTOR_INDEX = os.environ.get("VECTOR_INDEX", "papers")

# Bedrock KB config (Path B)
KB_ID = os.environ.get("KB_ID")
SOURCE_BUCKET = os.environ.get("SOURCE_BUCKET", "corpus-query-papers-source")

# Common
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
PAPERS_DIR = Path(os.environ.get(
    "PAPERS_DIR",
    "REDACTED"
))

# Test PDFs
AURORA_PDF = PAPERS_DIR / "2023/AURORA.pdf"
PECAR_PDF = PAPERS_DIR / "2023/Pecar_et_al-2023-Breast_Cancer_Research.pdf"
CAMO_PDF = PAPERS_DIR / "2023/CAMO pnas.2202584120.pdf"


@pytest.fixture(scope="session")
def s3vectors_client():
    """Real S3 Vectors client."""
    return boto3.client("s3vectors", region_name=AWS_REGION)


@pytest.fixture(scope="session")
def bedrock_runtime_client():
    """Real Bedrock Runtime client for embeddings."""
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


@pytest.fixture(scope="session")
def bedrock_agent_runtime_client():
    """Real Bedrock Agent Runtime client for KB queries."""
    return boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)
