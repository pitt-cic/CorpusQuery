# Default settings
# Used as fallback if user settings are missing
DEFAULT_MODEL = {"provider": "bedrock", "model_id": "us.anthropic.claude-sonnet-4-6"}
DEFAULT_EMBEDDING = {"provider": "bedrock", "model_id": "amazon.titan-embed-text-v2:0"}
DEFAULT_RETRIEVAL = {
    "evidence_k": 20,
    "max_sources": 10,
    "mmr_lambda": 0.7,
    "evidence_summary_length": 100,
    "answer_length": 400,
}

TITLE_MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"