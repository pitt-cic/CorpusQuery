"""CorpusQuery Query Lambda handler.

Invoked asynchronously by API Lambda. Runs paper-qa docs.aquery
against S3 Vectors and stores results in DynamoDB.
"""

import asyncio
import json
import os
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal

import aioboto3
import boto3
import litellm
from aws_lambda_powertools import Logger
from litellm.integrations.custom_logger import CustomLogger
from paperqa import Docs, Settings
from paperqa.settings import AnswerSettings, PromptSettings

from shared import SettingsClient, JobsRepository, SecretsClient
from vectorstore import BedrockKBVectorStore

from config import DEFAULT_MODEL, DEFAULT_EMBEDDING, DEFAULT_RETRIEVAL, TITLE_MODEL_ID
from prompts import SYSTEM_PROMPT, SUMMARY_PROMPT, TITLE_PROMPT
from utils import format_conversation_history

logger = Logger()

# Configure root logger to capture logs from vectorstore and other modules
logging.basicConfig(level=logging.INFO, force=True)
logging.getLogger("vectorstore").setLevel(logging.INFO)


class LLMCallInstrumentation(CustomLogger):
    """Intercept all LiteLLM calls for observability.

    Registered as a litellm callback to log the actual messages sent to the LLM,
    including system prompts, user messages, and any injected context. This lets us
    verify that conversation history reaches the model and inspect Paper-QA's
    internal prompt construction.
    """

    def log_pre_api_call(self, model, messages, kwargs):
        call_name = kwargs.get("additional_args", {}).get("name", "unnamed")
        logger.info(
            "LLM request",
            extra={
                "call_name": call_name,
                "model": model,
                "message_count": len(messages),
                "messages": [
                    {"role": m.get("role"), "content": m.get("content", "")[:500]}
                    for m in messages
                ],
            },
        )

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        model = kwargs.get("model", "unknown")
        call_name = kwargs.get("additional_args", {}).get("name", "unnamed")
        usage = getattr(response_obj, "usage", None)
        logger.info(
            "LLM response",
            extra={
                "call_name": call_name,
                "model": model,
                "duration_ms": int((end_time - start_time).total_seconds() * 1000),
                "input_tokens": getattr(usage, "prompt_tokens", None),
                "output_tokens": getattr(usage, "completion_tokens", None),
            },
        )


litellm.callbacks = [LLMCallInstrumentation()]

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["SESSIONS_AND_CHAT_HISTORY_TABLE_NAME"]
VECTOR_BUCKET = os.environ.get("VECTOR_BUCKET", "corpus-query-vectors-dev")
VECTOR_INDEX = os.environ.get("VECTOR_INDEX", "papers")

ssm = boto3.client("ssm")
secrets_manager = boto3.client("secretsmanager")
settings_client = SettingsClient(ssm)
secrets_client = SecretsClient(secrets_manager)
jobs_repo = JobsRepository(dynamodb.Table(TABLE_NAME))



def _make_llm_config(provider: str, model_id: str, api_keys: dict) -> dict | None:
    """Build a LiteLLM Router config for non-Bedrock providers with the user's API key."""
    if provider == "bedrock":
        return None
    key_name = "ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY"
    return {
        "model_list": [{
            "model_name": model_id,
            "litellm_params": {
                "model": f"{provider}/{model_id}",
                "api_key": api_keys.get(key_name),
            },
        }]
    }


def _build_settings(user_settings: dict, conversation_history: str | None, api_keys: dict) -> Settings:
    """Build Paper-QA Settings from user config and conversation history.

    Uses defaults as fallback if settings are missing to avoid failures.

    NOTE on conversation history injection:
    We inject history into the system prompt rather than using PromptSettings.pre.
    Paper-QA's `pre` field triggers a separate LLM call that "summarizes" the pre
    content before injecting it as "Extra background information" into the QA context.
    This adds latency and cost, and risks losing important details from the original
    conversation. Direct system prompt injection preserves the exact history and avoids
    the extra LLM call.

    Ideal: LiteLLM supports a `messages` list for multi-turn context. If Paper-QA
    exposed this (e.g., prior messages in the QA call), we could pass conversation
    history as proper message turns. See: https://github.com/Future-House/paper-qa
    """
    mc = user_settings.get("model_config", {})
    rc = user_settings.get("retrieval_config", {})

    llm = mc.get("llm", DEFAULT_MODEL)
    summary_llm = mc.get("summary_llm", DEFAULT_MODEL)
    embedding = mc.get("embedding", DEFAULT_EMBEDDING)

    system = SYSTEM_PROMPT
    if conversation_history:
        system = f"{SYSTEM_PROMPT}\n\n{conversation_history}"

    return Settings(
        llm=f"{llm['provider']}/{llm['model_id']}",
        llm_config=_make_llm_config(llm["provider"], llm["model_id"], api_keys),
        summary_llm=f"{summary_llm['provider']}/{summary_llm['model_id']}",
        summary_llm_config=_make_llm_config(summary_llm["provider"], summary_llm["model_id"], api_keys),
        embedding=f"{embedding['provider']}/{embedding['model_id']}",
        embedding_config=_make_llm_config(embedding["provider"], embedding["model_id"], api_keys),
        answer=AnswerSettings(
            evidence_k=rc.get("evidence_k", DEFAULT_RETRIEVAL["evidence_k"]),
            answer_max_sources=rc.get("max_sources", DEFAULT_RETRIEVAL["max_sources"]),
            evidence_summary_length=f"about {rc.get('evidence_summary_length', DEFAULT_RETRIEVAL['evidence_summary_length'])} words",
            answer_length=f"about {rc.get('answer_length', DEFAULT_RETRIEVAL['answer_length'])} words",
            evidence_relevance_score_cutoff=1,  # CRITICAL: Must stay at 1 for Bedrock KB
        ),
        prompts=PromptSettings(
            system=system,
            summary=SUMMARY_PROMPT,
        ),
        texts_index_mmr_lambda=rc.get("mmr_lambda", DEFAULT_RETRIEVAL["mmr_lambda"]),
    )


def handler(event: dict, context) -> dict:
    """Lambda entry point."""
    return asyncio.run(_async_handler(event))


async def _async_handler(event: dict) -> dict:
    """Async handler that runs paper-qa query."""
    user_id = event["user_id"]
    job_id = event["job_id"]
    session_id = event["session_id"]
    question = event["question"]
    timestamp = event["timestamp"]
    orcid = event.get("orcid")
    is_new_session = event.get("is_new_session", False)

    table = dynamodb.Table(TABLE_NAME)
    sk = f"job#{timestamp}#{job_id}"

    table.update_item(
        Key={"user_id": user_id, "sk": sk},
        UpdateExpression="SET #status = :status",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":status": "processing"},
    )

    try:
        tasks = [_process_question(user_id, job_id, session_id, question, orcid, timestamp, table, sk)]

        if is_new_session:
            tasks.append(_generate_title(user_id, session_id, question, table))

        await asyncio.gather(*tasks)

        logger.info("Query completed", extra={"job_id": job_id})
        return {"status": "completed", "job_id": job_id}

    except Exception as e:
        logger.exception("Query failed")
        completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        table.update_item(
            Key={"user_id": user_id, "sk": sk},
            UpdateExpression="SET #status = :status, #error = :error, completed_at = :completed_at",
            ExpressionAttributeNames={"#status": "status", "#error": "error"},
            ExpressionAttributeValues={
                ":status": "failed",
                ":error": str(e),
                ":completed_at": completed_at,
            },
        )
        raise


async def _process_question(
    user_id: str, job_id: str, session_id: str, question: str, orcid: str | None, timestamp: str, table, sk: str
) -> None:
    """Process the paper-qa query with dynamic settings and conversation history."""
    # Fetch user settings from SSM
    user_settings = settings_client.get_settings(user_id)
    api_keys = secrets_client.get_secrets(user_id)

    # Fetch prior conversation from this session
    prior_jobs = jobs_repo.list_jobs_by_session(user_id, session_id)
    conversation_history = format_conversation_history(jobs=prior_jobs, current_question=question)

    # Build settings per-request
    query_settings = _build_settings(user_settings, conversation_history, api_keys)

    vector_store = BedrockKBVectorStore(
        bucket_name=VECTOR_BUCKET,
        index_name=VECTOR_INDEX, # "papers"
        orcid=orcid,
    )

    docs = Docs(texts_index=vector_store)

    logger.info("Running paper-qa query", extra={
        "job_id": job_id,
        "question": question,
        "orcid": orcid,
        "vector_index": VECTOR_INDEX,
        "vector_bucket": VECTOR_BUCKET,
        "filtering_by_orcid": orcid is not None
    })
    session = await docs.aquery(query=question, settings=query_settings)

    # Use formatted_answer which includes inline citations like (docname)
    answer = session.formatted_answer if hasattr(session, "formatted_answer") else session.answer

    # Strip the "Question: ..." echo that paper-qa prepends to formatted_answer
    answer = re.sub(r'^Question:.*?\n\n', '', answer, count=1, flags=re.DOTALL)

    # Strip References section (redundant with UI's Sources panel)
    answer = _strip_references_section(answer)

    citations = _extract_citations(session)

    completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    table.update_item(
        Key={"user_id": user_id, "sk": sk},
        UpdateExpression="SET #status = :status, answer = :answer, citations = :citations, completed_at = :completed_at",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":status": "completed",
            ":answer": answer,
            ":citations": citations,
            ":completed_at": completed_at,
        },
    )


async def _generate_title(user_id: str, session_id: str, question: str, table) -> None:
    """Generate a concise title for the session using Claude Haiku."""
    try:
        session = aioboto3.Session()
        async with session.client("bedrock-runtime") as bedrock:
            response = await bedrock.invoke_model(
                modelId=TITLE_MODEL_ID,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 30,
                    "messages": [
                        {"role": "user", "content": TITLE_PROMPT.format(question=question)}
                    ],
                }),
            )
            body = await response["body"].read()
            result = json.loads(body)
            title = result["content"][0]["text"].strip()

            now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            table.update_item(
                Key={"user_id": user_id, "sk": f"session#{session_id}"},
                UpdateExpression="SET title = :title, last_active = :last_active",
                ExpressionAttributeValues={":title": title, ":last_active": now},
            )
            logger.info("Title generated", extra={"session_id": session_id, "title": title})
    except Exception as e:
        logger.warning("Title generation failed", extra={"error": str(e)})


def _strip_references_section(answer: str) -> str:
    """Remove References section from paper-qa answer (redundant with UI's Sources panel)."""
    # Match "References" as plain text or markdown header, followed by the numbered list
    # Pattern: newlines + "References" + everything after
    pattern = r'\n\s*References\s*\n.*$'
    return re.sub(pattern, '', answer, flags=re.IGNORECASE | re.DOTALL).strip()


def _extract_citations(session) -> list[dict]:
    """Extract citations from paper-qa session."""
    citations = []
    if hasattr(session, "contexts") and session.contexts:
        for ctx in session.contexts:
            docname = "unknown"
            if hasattr(ctx, "text") and hasattr(ctx.text, "doc"):
                docname = getattr(ctx.text.doc, "docname", "unknown")

            quote = ""
            if hasattr(ctx, "text") and hasattr(ctx.text, "text"):
                quote = ctx.text.text[:500]

            score = Decimal("0")
            if hasattr(ctx, "score"):
                score = Decimal(str(ctx.score))

            citations.append({
                "docname": docname,
                "text_name": ctx.text.name,
                "quote": ctx.text.text[:500],
                "relevance_score": score,
            })
    return citations
