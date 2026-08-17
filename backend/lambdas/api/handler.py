"""CorpusQuery API Lambda handler.

Routes:
- POST /ask: Submit question
- GET /jobs/{jobId}: Poll job status
- GET /sessions: List sessions
- GET /sessions/{sessionId}/messages: Get messages
- PUT /sessions/{sessionId}: Rename session
- DELETE /sessions/{sessionId}: Delete session
- GET /settings: Get user settings
- PUT /settings: Update user settings
- PUT /settings/secrets: Store API keys
- GET /settings/secrets/status: Check which keys exist
"""

import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayRestResolver
from aws_lambda_powertools.event_handler.api_gateway import CORSConfig
from aws_lambda_powertools.utilities.typing import LambdaContext
import re



from shared import (
    SessionsRepository,
    JobsRepository,
    SettingsClient,
    SecretsClient,
    DocumentsClient,
    SyncInProgressError,
    get_authenticated_user_id,
)
from mappers import (
    session_to_response,
    sessions_to_response,
    sessions_to_response_paginated,
    job_to_response,
    jobs_to_response,
    settings_to_response,
    settings_from_request,
    secrets_from_request,
    secrets_status_to_response,
    upload_urls_to_response,
    sync_to_response,
    documents_to_response,
    sync_jobs_to_response,
    sync_job_to_response,
    sync_error_to_response,
)

logger = Logger()
cors_config = CORSConfig(allow_origin="*", max_age=300)
app = APIGatewayRestResolver(cors=cors_config)

# Module-level initialization (persists across warm invocations)
session = boto3.Session(region_name=os.environ.get("AWS_REGION", "us-east-1"))
dynamodb = session.resource("dynamodb")
ssm = session.client("ssm")
secrets_manager = session.client("secretsmanager")
lambda_client = session.client("lambda")
TABLE_NAME = os.environ["SESSIONS_AND_CHAT_HISTORY_TABLE_NAME"]
QUERY_FUNCTION_NAME = os.environ["QUERY_FUNCTION_NAME"]
FETCHER_FUNCTION_NAME = os.environ["FETCHER_FUNCTION_NAME"]
INDEXER_FUNCTION_NAME = os.environ.get("INDEXER_FUNCTION_NAME", "")
PAPERS_BUCKET_NAME = os.environ.get("PAPERS_BUCKET_NAME", "")
FETCHED_BUCKET_NAME = os.environ.get("FETCHED_BUCKET_NAME", "")
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID", "")
DATA_SOURCE_ID = os.environ.get("DATA_SOURCE_ID", "")
table = dynamodb.Table(TABLE_NAME)
sessions_repo = SessionsRepository(table)
jobs_repo = JobsRepository(table)
settings_client = SettingsClient(ssm)
secrets_client = SecretsClient(secrets_manager)

bedrock_agent = session.client("bedrock-agent")
documents_client = DocumentsClient(
    s3_client=session.client("s3"),
    bedrock_agent_client=bedrock_agent,
    bucket_name=PAPERS_BUCKET_NAME,
    kb_id=KNOWLEDGE_BASE_ID,
    data_source_id=DATA_SOURCE_ID,
)

# NOTE: fetched_docs_client removed - fetched papers use Indexer Lambda with ORCID metadata,
# not Bedrock KB auto-ingestion


def _get_user_id() -> str:
    """Get authenticated user ID from the current request."""
    return get_authenticated_user_id(app.current_event._data)


def _get_user_email() -> str:
    """Get authenticated user email from the current request."""
    return app.current_event._data["requestContext"]["authorizer"]["claims"]["email"]


# --- Health Check ---


@app.get("/health")
def health_check():
    """Health check endpoint. No authentication required."""
    return {"status": "ok"}


# --- Ask / Jobs ---


@app.post("/ask")
def ask():
    """Submit a question (with optional ORCID). Creates session if needed, creates job, invokes Query Lambda."""
    body = app.current_event.json_body or {}
    question = body.get("question")
    orcid=body.get("orcid")

    if not question:
        return {"error": "question is required"}, 400

    session_id = body.get("sessionId") or str(uuid.uuid4())
    job_id = str(uuid.uuid4())

    # Create session if it doesn't exist
    existing_session = sessions_repo.get_session(_get_user_id(), session_id)
    is_new_session = not existing_session

    if is_new_session:
        title = question[:50] + "..." if len(question) > 50 else question
        sessions_repo.create_session(_get_user_id(), session_id, title)
    else:
        sessions_repo.update_last_active(_get_user_id(), session_id)

    # Create job
    job = jobs_repo.create_job(_get_user_id(), job_id, session_id, question)

    # Async invoke Query Lambda
    lambda_client.invoke(
        FunctionName=QUERY_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps({
            "user_id": _get_user_id(),
            "job_id": job_id,
            "session_id": session_id,
            "question": question,
            "orcid":orcid, 
            "is_new_session": is_new_session,
            "timestamp": job["timestamp"],
        }),
    )

    return {"jobId": job_id, "sessionId": session_id}


@app.get("/jobs/<job_id>")
def get_job(job_id: str):
    """Get job status and result."""
    job = jobs_repo.get_job(_get_user_id(), job_id)
    if not job:
        return {"error": "Job not found"}, 404
    return job_to_response(job)


# --- Sessions ---


@app.get("/sessions")
def list_sessions():
    """List sessions for the user with pagination."""
    params = app.current_event.query_string_parameters or {}
    page_size = int(params.get("pageSize", "20"))
    next_token = params.get("nextToken")

    result = sessions_repo.list_sessions_paginated(
        _get_user_id(),
        page_size=page_size,
        next_token=next_token,
    )
    return sessions_to_response_paginated(result)


@app.get("/sessions/<session_id>/messages")
def get_session_messages(session_id: str):
    """Get all messages (jobs) in a session."""
    session = sessions_repo.get_session(_get_user_id(), session_id)
    if not session:
        return {"error": "Session not found"}, 404

    jobs = jobs_repo.list_jobs_by_session(_get_user_id(), session_id)
    return jobs_to_response(jobs)


@app.put("/sessions/<session_id>")
def update_session(session_id: str):
    """Rename a session."""
    body = app.current_event.json_body or {}
    title = body.get("title")

    if not title:
        return {"error": "title is required"}, 400

    updated = sessions_repo.update_session(_get_user_id(), session_id, title)
    if not updated:
        return {"error": "Session not found"}, 404

    return session_to_response(updated)


@app.delete("/sessions/<session_id>")
def delete_session(session_id: str):
    """Delete a session and all its messages."""
    session = sessions_repo.get_session(_get_user_id(), session_id)
    if not session:
        return {"error": "Session not found"}, 404

    # Delete all jobs in the session first
    jobs_repo.delete_jobs_by_session(_get_user_id(), session_id)

    # Delete the session
    sessions_repo.delete_session(_get_user_id(), session_id)

    return {"success": True}


# --- Settings ---

@app.get("/settings")
def get_settings():
    """Get user settings. Creates defaults if not found."""
    settings = settings_client.get_settings(_get_user_id())
    return settings_to_response(settings)


@app.put("/settings")
def update_settings():
    """Update user settings (partial update supported)."""
    body = app.current_event.json_body or {}

    if not body:
        return {"error": "Request body is required"}, 400

    existing = settings_client.get_settings(_get_user_id())
    updated = settings_from_request(body, existing)
    settings_client.put_settings(_get_user_id(), updated)

    return settings_to_response(updated)


@app.put("/settings/secrets")
def update_secrets():
    """Store API keys."""
    body = app.current_event.json_body or {}

    if not body:
        return {"error": "Request body is required"}, 400

    secrets = secrets_from_request(body)
    if not secrets:
        return {"error": "No valid API keys provided"}, 400

    secrets_client.put_secrets(_get_user_id(), secrets)
    return {"success": True}


@app.get("/settings/secrets/status")
def get_secrets_status():
    """Check which API keys exist."""
    status = secrets_client.get_secrets_status(_get_user_id())
    return secrets_status_to_response(status)


# --- Documents ---

@app.post("/documents/upload-urls")
def get_upload_urls():
    """Get presigned URLs for uploading documents."""
    body = app.current_event.json_body or {}
    filenames = body.get("filenames", [])

    if not filenames:
        return {"error": "filenames is required"}, 400

    # Filter to PDF only
    pdf_filenames = [f for f in filenames if f.lower().endswith(".pdf")]
    if not pdf_filenames:
        return {"error": "Only PDF files are allowed"}, 400

    user_id = _get_user_id()
    orcid = body.get("orcid") or None

    # Check for existing files (deduplication)
    existing = documents_client.list_existing_files(user_id)

    uploads = []
    skipped = []
    for filename in pdf_filenames:
        if filename in existing:
            skipped.append({"filename": filename, "reason": "already exists"})
        else:
            uploads.append(filename)

    # Generate presigned URLs for new files
    upload_urls = documents_client.generate_upload_urls(user_id, uploads, orcid=orcid)

    return upload_urls_to_response(upload_urls, skipped)


@app.post("/documents/index")
def index_uploaded_documents():
    """Trigger S3 Vectors indexing for ORCID-tagged manual uploads."""
    body = app.current_event.json_body or {}
    orcid = body.get("orcid", "")
    filenames = body.get("filenames", [])
    user_id = _get_user_id()

    if not orcid:
        return {"error": "orcid is required"}, 400
    if not filenames:
        return {"error": "filenames is required"}, 400

    job_id = str(uuid.uuid4())
    job = jobs_repo.create_job(
        user_id=user_id,
        job_id=job_id,
        session_id=job_id,
        question=f"Indexing {len(filenames)} file(s) for {orcid}",
    )

    files = [
        {"bucket": PAPERS_BUCKET_NAME, "key": f"papers/{user_id}/{orcid}/{f}"}
        for f in filenames
    ]

    lambda_client.invoke(
        FunctionName=INDEXER_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps({"orcid": orcid, "user_id": user_id, "sk": job["sk"], "files": files}),
    )

    return {"jobId": job_id}


@app.get("/documents/researchers")
def list_researchers():
    """Return ORCIDs that have papers in S3 for the current user."""
    user_id = _get_user_id()
    orcids = documents_client.list_researchers(user_id, FETCHED_BUCKET_NAME)
    return {"researchers": [{"orcid": o} for o in orcids]}


@app.get("/documents/fetched")
def get_fetched_documents():
    """Return fetcher download summaries for the current user."""
    user_id = _get_user_id()
    results = documents_client.get_fetched_results(user_id, FETCHED_BUCKET_NAME)
    return {"fetched": results}


@app.post("/documents/sync")
def sync_documents():
    """Trigger Knowledge Base sync."""
    try:
        result = documents_client.start_sync()
        return sync_to_response(result)
    except SyncInProgressError as e:
        return (
            sync_error_to_response(str(e)),
            409,
        )
    
@app.get("/documents/download")
def get_document_download_url():
    """Generate presigned download URL for a document from manual uploads or fetched papers."""
    params = app.current_event.query_string_parameters or {}
    docname = params.get("name", "")
    if not docname:
        return {"error": "name parameter is required"}, 400

    s3_client = session.client("s3")

    papers_bucket = os.environ.get("PAPERS_BUCKET_NAME", "")
    fetched_bucket = os.environ.get("FETCHED_BUCKET_NAME", "")
    docname_lower = docname.lower()

    def search_bucket(bucket, prefix):
        """Paginate through all objects under prefix and return presigned URL if found."""
        paginator = s3_client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                filename = key.split("/")[-1]
                filename_stem = filename.rsplit(".", 1)[0] if "." in filename else filename
                if filename_stem.lower() == docname_lower:
                    url = s3_client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": bucket, "Key": key},
                        ExpiresIn=3600,
                    )
                    return {"downloadUrl": url, "filename": filename}
        return None

    # 1. Manual uploads: papers/{user_id}/{orcid}/{filename}
    try:
        result = search_bucket(papers_bucket, "papers/")
        if result:
            logger.info(f"Found document in manual uploads: {docname}")
            return result
    except Exception as e:
        logger.error(f"Error searching manual uploads: {e}")

    # 2. Fetched papers: fetched-papers/{orcid}/{filename}
    for prefix in ["fetched-papers/", "for-download/"]:
        try:
            result = search_bucket(fetched_bucket, prefix)
            if result:
                logger.info(f"Found document in fetched papers: {docname}")
                return result

        except Exception as e:
            logger.error(f"Error searching fetched papers: {e}")

    logger.warning(f"Document not found: {docname}")
    return {"error": "Document not found in manual uploads or fetched papers"}, 404

@app.get("/documents/sync-jobs")
def list_sync_jobs():
    """List ingestion job history with pagination."""
    params = app.current_event.query_string_parameters or {}
    page_size = int(params.get("pageSize", "5"))
    next_token = params.get("nextToken")

    result = documents_client.list_sync_jobs(page_size=page_size, next_token=next_token)
    return sync_jobs_to_response(result)


@app.get("/documents/sync-jobs/<job_id>")
def get_sync_job(job_id: str):
    """Get a single sync job by ID."""
    result = documents_client.get_sync_job(job_id)
    if not result:
        return {"error": "Sync job not found"}, 404
    return sync_job_to_response(result)


@app.get("/documents")
def list_documents():
    """List indexed documents from Knowledge Base."""
    params = app.current_event.query_string_parameters or {}
    page_size = int(params.get("pageSize", "100"))
    next_token = params.get("nextToken")

    result = documents_client.list_documents(page_size, next_token)
    return documents_to_response(result)


# --- Fetcher ----

@app.post("/fetcher")
def fetch_papers():
    """Fetches papers for a researcher's ORCID via OpenAlex API."""
    user_id = _get_user_id()
    job_id = str(uuid.uuid4())
    body = app.current_event.json_body or {}
    orcid = body.get("orcid","")
    question = "Scraping PMC for PMIDs"

    if not orcid:
        return {"error": "ORCID is required"}, 400

    pattern = r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$"
    if not re.fullmatch(pattern, orcid):
        return {"error": "ORCID is not in valid format (####-####-####-####)"}


    job = jobs_repo.create_job(
        user_id=user_id,
        job_id=job_id,
        session_id=job_id,  # Use job_id as session_id for fetcher jobs
        question=question
    )

    lambda_client.invoke(
        FunctionName=FETCHER_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps({
            "user_id": _get_user_id(),
            "job_id": job_id,
            "session_id": job_id,
            "question": question,
            "orcid": orcid,
            "user_email": _get_user_email(),
        }),
    )


    return {
        "jobId": job_id,
        "orcid": orcid,
        "message": "Fetch job started. Poll GET /fetcher-jobs/{jobId} for the status."
    }


@app.get("/fetcher-jobs/<job_id>")
def get_fetcher_job(job_id:str):
    """Get fetcher job status."""
    job = jobs_repo.get_job(_get_user_id(), job_id)
    logger.info(str(job))
    if not job:
        return {"error": "Job not found"}, 404

    answer = job.get("answer","")
    job_status = job.get("status","")

    return {
        "jobId": job_id,
        "status": job_status,
        "question": job.get("question", "Scraping PMC for PMIDs"),
        "answer": answer,
        "createdAt": job.get("created_at"),
    }


@app.get("/fetcher-jobs")
def list_fetcher_jobs():
    """List user's fetcher jobs."""
    user_id = _get_user_id()

    # Get all jobs for this user and filter for fetcher jobs
    all_jobs = jobs_repo.list_jobs(user_id)
    fetcher_jobs = [
        job for job in all_jobs
        if job.get("question", "").startswith("Scraping PMC for PMIDs")
    ]

    # Sort by creation time descending
    fetcher_jobs.sort(key=lambda j: j.get("created_at", ""), reverse=True)

    return {
        "jobs": [job_to_response(job) for job in fetcher_jobs[:20]]  # Limit to 20 most recent
    }


# --- Fetched Docs ---
# NOTE: Fetched papers are indexed automatically via Indexer Lambda with ORCID metadata.
# No sync endpoints needed - indexing happens automatically after fetching.
# To query fetched papers: use POST /ask with orcid parameter.



# --- Handler ---


@logger.inject_lambda_context
def handler(event: dict, context: LambdaContext) -> dict:
    """Lambda entry point."""
    return app.resolve(event, context)
