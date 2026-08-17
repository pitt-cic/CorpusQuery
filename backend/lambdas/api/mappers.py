"""Mappers for HTTP boundary translation (snake_case ↔ camelCase)."""

from datetime import datetime, timezone


def session_to_response(db_item: dict) -> dict:
    """Map internal session to API response."""
    return {
        "sessionId": db_item["session_id"],
        "title": db_item["title"],
        "createdAt": db_item["created_at"],
        "lastActive": db_item["last_active"],
    }


def sessions_to_response(db_items: list[dict]) -> list[dict]:
    """Map list of sessions to API response."""
    return [session_to_response(item) for item in db_items]


def sessions_to_response_paginated(result: dict) -> dict:
    """Convert paginated sessions result to API response."""
    return {
        "sessions": [session_to_response(s) for s in result["sessions"]],
        "nextToken": result.get("next_token"),
    }


def citation_to_response(db_item: dict) -> dict:
    """Map citation to API response."""
    return {
        "docname": db_item["docname"],
        "textName": db_item.get("text_name", db_item["docname"]),
        "quote": db_item["quote"],
        "relevanceScore": float(db_item["relevance_score"]),
    }


def job_to_response(db_item: dict) -> dict:
    """Map internal job to API response."""
    result = {
        "jobId": db_item["job_id"],
        "sessionId": db_item.get("session_id",""),
        "status": db_item["status"],
        "question": db_item["question"],
        "createdAt": db_item.get("created_at",""),
    }
    if db_item.get("answer") is not None:
        result["answer"] = db_item["answer"]
    if db_item.get("citations"):
        result["citations"] = [citation_to_response(c) for c in db_item["citations"]]
    if db_item.get("completed_at"):
        result["completedAt"] = db_item["completed_at"]
    if db_item.get("error"):
        result["error"] = db_item["error"]
    return result


def jobs_to_response(db_items: list[dict]) -> list[dict]:
    """Map list of jobs to API response."""
    return [job_to_response(item) for item in db_items]


def model_selection_to_response(db_item: dict) -> dict:
    """Map model selection to API response (model_id → modelId)."""
    return {
        "provider": db_item["provider"],
        "modelId": db_item["model_id"],
    }


def model_selection_from_request(api_item: dict, existing: dict) -> dict:
    """Map API model selection to SSM format (modelId → model_id)."""
    return {
        "provider": api_item.get("provider", existing["provider"]),
        "model_id": api_item.get("modelId", existing["model_id"]),
    }


def settings_to_response(ssm_data: dict) -> dict:
    """Map SSM settings to API response."""
    rc = ssm_data["retrieval_config"]
    return {
        "modelConfig": {
            "llm": model_selection_to_response(ssm_data["model_config"]["llm"]),
            "summaryLlm": model_selection_to_response(ssm_data["model_config"]["summary_llm"]),
            "agentLlm": model_selection_to_response(ssm_data["model_config"]["agent_llm"]),
            "embedding": model_selection_to_response(ssm_data["model_config"]["embedding"]),
            "createdAt": ssm_data["model_config"]["created_at"],
            "updatedAt": ssm_data["model_config"]["updated_at"],
        },
        "retrievalConfig": {
            "evidenceK": rc["evidence_k"],
            "maxSources": rc["max_sources"],
            "mmrLambda": float(rc["mmr_lambda"]),
            "evidenceSummaryLength": rc.get("evidence_summary_length", 100),
            "answerLength": rc.get("answer_length", 400),
            "createdAt": rc["created_at"],
            "updatedAt": rc["updated_at"],
        },
    }


def settings_from_request(api_data: dict, existing: dict) -> dict:
    """Map API request to SSM format, merging with existing settings."""
    now = datetime.now(timezone.utc).isoformat()
    result = {
        "model_config": existing["model_config"].copy(),
        "retrieval_config": existing["retrieval_config"].copy(),
    }

    if "modelConfig" in api_data:
        mc = api_data["modelConfig"]
        result["model_config"] = {
            "llm": model_selection_from_request(mc.get("llm", {}), existing["model_config"]["llm"]),
            "summary_llm": model_selection_from_request(mc.get("summaryLlm", {}), existing["model_config"]["summary_llm"]),
            "agent_llm": model_selection_from_request(mc.get("agentLlm", {}), existing["model_config"]["agent_llm"]),
            "embedding": model_selection_from_request(mc.get("embedding", {}), existing["model_config"]["embedding"]),
            "created_at": existing["model_config"]["created_at"],
            "updated_at": now,
        }

    if "retrievalConfig" in api_data:
        rc = api_data["retrievalConfig"]
        existing_rc = existing["retrieval_config"]
        result["retrieval_config"] = {
            "evidence_k": rc.get("evidenceK", existing_rc["evidence_k"]),
            "max_sources": rc.get("maxSources", existing_rc["max_sources"]),
            "mmr_lambda": rc.get("mmrLambda", existing_rc["mmr_lambda"]),
            "evidence_summary_length": rc.get("evidenceSummaryLength", existing_rc.get("evidence_summary_length", 100)),
            "answer_length": rc.get("answerLength", existing_rc.get("answer_length", 400)),
            "created_at": existing_rc["created_at"],
            "updated_at": now,
        }

    return result


def secrets_from_request(api_data: dict) -> dict:
    """Map API request to Secrets Manager format."""
    result = {}
    if "anthropicApiKey" in api_data:
        result["ANTHROPIC_API_KEY"] = api_data["anthropicApiKey"]
    if "openaiApiKey" in api_data:
        result["OPENAI_API_KEY"] = api_data["openaiApiKey"]
    if "openalexApiKey" in api_data:
        result["OPENALEX_API_KEY"] = api_data["openalexApiKey"]
    if "ncbiApiKey" in api_data:
        result["NCBI_API_KEY"] = api_data["ncbiApiKey"]
    return result


def secrets_status_to_response(status: dict) -> dict:
    """Map secrets status to API response."""
    return {
        "anthropicApiKey": status.get("ANTHROPIC_API_KEY", False),
        "openaiApiKey": status.get("OPENAI_API_KEY", False),
        "openalexApiKey": status.get("OPENALEX_API_KEY", False),
        "ncbiApiKey": status.get("NCBI_API_KEY", False),
    }


def upload_urls_to_response(uploads: list[dict], skipped: list[dict]) -> dict:
    """Map upload URLs response."""
    return {
        "uploads": uploads,
        "skipped": skipped,
    }


def sync_to_response(sync_result: dict) -> dict:
    """Map sync response."""
    return {
        "ingestionJobId": sync_result["ingestionJobId"],
        "status": sync_result["status"],
    }


def documents_to_response(result: dict) -> dict:
    """Map documents list response."""
    return {
        "documents": [
            {
                "filename": doc["filename"],
                "status": doc["status"],
                "updatedAt": doc["updatedAt"],
                "orcid": doc.get("orcid"),
            }
            for doc in result["documents"]
        ],
        "nextToken": result.get("nextToken"),
        "lastSyncedAt": result.get("lastSyncedAt"),
        "syncStatus": result.get("syncStatus"),
    }


def sync_job_to_response(job: dict) -> dict:
    """Map ingestion job to API response format."""
    stats = job.get("statistics", {})
    return {
        "ingestionJobId": job["ingestionJobId"],
        "status": job["status"],
        "startedAt": job.get("startedAt"),
        "updatedAt": job.get("updatedAt"),
        "statistics": {
            "numberOfDocumentsScanned": stats.get("numberOfDocumentsScanned", 0),
            "numberOfDocumentsFailed": stats.get("numberOfDocumentsFailed", 0),
            "numberOfNewDocumentsIndexed": stats.get("numberOfNewDocumentsIndexed", 0),
            "numberOfModifiedDocumentsIndexed": stats.get("numberOfModifiedDocumentsIndexed", 0),
            "numberOfDocumentsDeleted": stats.get("numberOfDocumentsDeleted", 0),
        },
        "failureReasons": job.get("failureReasons", []),
    }


def sync_jobs_to_response(result: dict) -> dict:
    """Map list_sync_jobs result to API response."""
    return {
        "jobs": [sync_job_to_response(job) for job in result["jobs"]],
        "nextToken": result.get("nextToken"),
    }


def sync_error_to_response(message: str) -> dict:
    """Map sync conflict error to API response."""
    return {
        "error": "SYNC_IN_PROGRESS",
        "message": message,
    }
