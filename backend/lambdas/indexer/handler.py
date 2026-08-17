import os
import boto3
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from shared.indexing import index_document_from_s3
from shared import JobsRepository

# Configure root logger to capture logs from shared.indexing module
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(name)s: %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

s3 = boto3.client("s3")
s3vectors = boto3.client("s3vectors")
bedrock = boto3.client("bedrock-runtime")
dynamodb = boto3.resource("dynamodb")

FETCHED_BUCKET = os.environ["FETCHED_BUCKET_NAME"]
VECTOR_BUCKET = os.environ["VECTOR_BUCKET"]
INDEX_NAME = os.environ["VECTOR_INDEX"]
TABLE_NAME = os.environ["SESSIONS_AND_CHAT_HISTORY_TABLE_NAME"]

def handler(event, context):
    """Index papers for a given ORCID.

    Supports two modes:
    - Fetcher path (default): scans all files under fetched-papers/{orcid}/
    - Manual upload path: indexes explicit files provided in event["files"]
      as a list of {bucket, key} dicts (e.g. papers/{user_id}/{orcid}/{file})
    """
    orcid = event["orcid"]
    user_id = event.get("user_id")
    sk = event.get("sk")
    answer = event.get("answer", "")
    explicit_files = event.get("files")  # optional: [{bucket, key}, ...]

    jobs_repo = JobsRepository(dynamodb.Table(TABLE_NAME)) if user_id and sk else None

    logger.info(f"Starting indexing for ORCID: {orcid}")

    def index_file(bucket, key):
        logger.info(f"Indexing file: {key} from {bucket}")
        count = asyncio.run(index_document_from_s3(
            s3_client=s3,
            s3vectors_client=s3vectors,
            bedrock_client=bedrock,
            bucket_name=bucket,
            s3_key=key,
            orcid=orcid,
            vector_bucket=VECTOR_BUCKET,
            index_name=INDEX_NAME,
        ))
        logger.info(f"Indexed {count} vectors from {key}")
        return count

    try:
        total_vectors = 0

        if explicit_files:
            # Manual upload path: index only the specified files
            file_list = [(f["bucket"], f["key"]) for f in explicit_files if f["key"].endswith((".pdf", ".txt"))]
            logger.info(f"Indexing {len(file_list)} explicit files for ORCID {orcid}")
        else:
            # Fetcher path: scan all files under fetched-papers/{orcid}/
            response = s3.list_objects_v2(Bucket=FETCHED_BUCKET, Prefix=f"fetched-papers/{orcid}/")
            files = response.get("Contents", [])
            logger.info(f"Found {len(files)} files in S3 for ORCID {orcid}")
            file_list = [(FETCHED_BUCKET, obj["Key"]) for obj in files if obj["Key"].endswith((".pdf", ".txt"))]

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(index_file, bucket, key): key for bucket, key in file_list}
            for future in as_completed(futures):
                key = futures[future]
                try:
                    total_vectors += future.result()
                except Exception as file_err:
                    logger.warning(f"Skipping {key} — could not index: {file_err}")

        logger.info(f"COMPLETE: Indexed {total_vectors} total vectors for ORCID {orcid} into index '{INDEX_NAME}'")

        if jobs_repo:
            jobs_repo.update_job_status(
                user_id,
                sk,
                "completed",
                answer=answer,
                completed_at=datetime.now(timezone.utc).isoformat(),
            )

        return {"statusCode": 200, "body": f"Indexed {total_vectors} vectors"}

    except Exception as e:
        logger.error(f"Indexing failed for ORCID {orcid}: {e}")
        if jobs_repo:
            jobs_repo.update_job_status(user_id, sk, "failed", error=str(e))
        raise