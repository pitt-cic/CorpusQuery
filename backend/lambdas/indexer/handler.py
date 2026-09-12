import os
import json
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
sqs = boto3.client("sqs")

FETCHED_BUCKET = os.environ["FETCHED_BUCKET_NAME"]
VECTOR_BUCKET = os.environ["VECTOR_BUCKET"]
INDEX_NAME = os.environ["VECTOR_INDEX"]
TABLE_NAME = os.environ["SESSIONS_AND_CHAT_HISTORY_TABLE_NAME"]
INDEXING_BATCHES_QUEUE_URL = os.environ["INDEXING_BATCHES_QUEUE_URL"]
BATCH_SIZE = 20

def handler(event, context):
    """Index papers for a given ORCID.

    Supports two modes:
    - Fetcher path (default): scans all files under fetched-papers/{orcid}/
    - Manual upload path: indexes explicit files provided in event["files"]
      as a list of {bucket, key} dicts (e.g. papers/{user_id}/{orcid}/{file})

    Can be triggered by SQS (Records wrapper) or invoked directly.
    When the file list exceeds BATCH_SIZE, fans out to the batches queue.
    """
    # Handle SQS trigger (Records wrapper) or direct invocation
    if "Records" in event:
        payload = json.loads(event["Records"][0]["body"])
    else:
        payload = event

    orcid = payload["orcid"]
    user_id = payload.get("user_id")
    sk = payload.get("sk")
    answer = payload.get("answer", "")
    explicit_files = payload.get("files")  # optional: [{bucket, key}, ...]

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
            paginator = s3.get_paginator("list_objects_v2")
            files = []
            for page in paginator.paginate(Bucket=FETCHED_BUCKET, Prefix=f"fetched-papers/{orcid}/"):
                files.extend(page.get("Contents", []))
            logger.info(f"Found {len(files)} files in S3 for ORCID {orcid}")
            file_list = [(FETCHED_BUCKET, obj["Key"]) for obj in files if obj["Key"].endswith((".pdf", ".txt"))]

            # Fan out if too many files for a single invocation
            if len(file_list) > BATCH_SIZE:
                batches = [file_list[i:i+BATCH_SIZE] for i in range(0, len(file_list), BATCH_SIZE)]
                logger.info(f"Fan-out: {len(file_list)} files → {len(batches)} batches of {BATCH_SIZE}")
                for batch in batches:
                    sqs.send_message(
                        QueueUrl=INDEXING_BATCHES_QUEUE_URL,
                        MessageBody=json.dumps({
                            "orcid": orcid,
                            "files": [{"bucket": b, "key": k} for b, k in batch],
                        }),
                    )
                if jobs_repo:
                    jobs_repo.update_job_status(
                        user_id, sk, "completed",
                        answer=answer,
                        completed_at=datetime.now(timezone.utc).isoformat(),
                    )
                return {"statusCode": 200, "body": f"Fanned out {len(batches)} batches"}

        with ThreadPoolExecutor(max_workers=10) as executor:
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