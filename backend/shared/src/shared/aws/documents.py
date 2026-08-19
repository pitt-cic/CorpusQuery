"""S3 and Bedrock Agent client for document operations."""

import json
import re
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError
# TODO: Fix index_doc import - scripts/ not available in Lambda package
# from scripts.index_papers import index_doc

class SyncInProgressError(Exception):
    """Raised when a sync job is already in progress."""
    pass


def _serialize_datetime(value: Any) -> str | None:
    """Convert datetime to ISO format string, pass through strings, return None for None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


class DocumentsClient:
    """Client for document upload and Knowledge Base sync operations."""

    def __init__(
        self,
        s3_client: Any,
        bedrock_agent_client: Any,
        bucket_name: str,
        kb_id: str,
        data_source_id: str,
        s3_vectors_client: Any = None,
        vector_bucket: Any = None,
    ):
        """Initialize with boto3 clients and resource identifiers."""
        self.s3 = s3_client
        self.bedrock_agent = bedrock_agent_client
        self.bucket_name = bucket_name
        self.kb_id = kb_id
        self.data_source_id = data_source_id
        self.s3_vectors_client = s3_vectors_client
        self.vector_bucket = vector_bucket

    def list_existing_files(self, user_id: str) -> set[str]:
        """List filenames across all users in papers/ prefix.

        Returns a set of filenames (without path) that exist globally,
        since the Knowledge Base is shared between users.
        """
        prefix = "papers/"
        filenames: set[str] = set()

        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                # Extract just the filename (last segment) — handles both
                # papers/{user_id}/{filename} and papers/{user_id}/{orcid}/{filename}
                filename = key.split("/")[-1]
                if filename:
                    filenames.add(filename)

        return filenames

    def generate_upload_urls(
        self, user_id: str, filenames: list[str], orcid: str | None = None, expires_in: int = 3600
    ) -> list[dict]:
        """Generate presigned PUT URLs for each filename.

        If orcid is provided, files are stored under papers/{user_id}/{orcid}/{filename}
        so they can be dual-indexed into S3 Vectors with ORCID metadata.
        Returns list of dicts with filename, uploadUrl, and expiresIn.
        """
        urls = []
        for filename in filenames:
            key = f"papers/{user_id}/{orcid}/{filename}" if orcid else f"papers/{user_id}/{filename}"
            url = self.s3.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "ContentType": "application/pdf",
                },
                ExpiresIn=expires_in,
            )
            urls.append({
                "filename": filename,
                "uploadUrl": url,
                "expiresIn": expires_in,
            })
        return urls

    def get_fetched_results(self, user_id: str, fetched_bucket: str) -> list[dict]:
        """Return fetcher run summaries for a user.

        Reads from fetched_bucket (not self.bucket_name) because the fetcher
        writes download-results to the fetched papers bucket.
        Returns list of {orcid, papers} where papers is a list of
        {orcid, title, doi, status} dicts from the fetcher's download summary.
        """
        prefix = f"download-results/{user_id}/"
        results = []

        paginator = self.s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=fetched_bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                filename = key.split("/")[-1]
                if filename.endswith(".json"):
                    orcid = filename[:-5]
                    body = self.s3.get_object(Bucket=fetched_bucket, Key=key)["Body"].read()
                    results.append({"orcid": orcid, "papers": json.loads(body)})

        return results

    def start_sync(self) -> dict:
        """Trigger KB ingestion job, return job id + status.

        Raises:
            SyncInProgressError: If a sync job is already in progress.
        """
        try:
            response = self.bedrock_agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.data_source_id,
            )
            job = response["ingestionJob"]
            return {
                "ingestionJobId": job["ingestionJobId"],
                "status": job["status"],
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConflictException":
                raise SyncInProgressError("A sync is already in progress. Please try again later.")
            raise


    def list_documents(
        self, page_size: int, next_token: str | None, user_id: str | None = None
    ) -> dict:
        """List KB documents (shared), sorted globally by updatedAt descending.

        Fetches all documents from Bedrock (handling its internal pagination),
        sorts them all, then slices the requested page. next_token is a numeric
        offset string rather than a Bedrock token.
        """
        orcid_pattern = re.compile(r'^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$')
        all_docs = []
        bedrock_token = None

        # Exhaust all Bedrock pages to get the full document list
        while True:
            params: dict[str, Any] = {
                "knowledgeBaseId": self.kb_id,
                "dataSourceId": self.data_source_id,
                "maxResults": 100,
            }
            if bedrock_token:
                params["nextToken"] = bedrock_token

            response = self.bedrock_agent.list_knowledge_base_documents(**params)

            for doc in response.get("documentDetails", []):
                s3_uri = doc["identifier"]["s3"]["uri"]
                parts = s3_uri.split("/")
                # s3://bucket/papers/{user_id}/{orcid}/{filename}
                if user_id and not (len(parts) >= 5 and parts[3] == "papers" and parts[4] == user_id):
                    continue
                filename = parts[-1]
                orcid = parts[-2] if len(parts) >= 7 and orcid_pattern.match(parts[-2]) else None
                raw_updated = doc.get("updatedAt")
                all_docs.append({
                    "filename": filename,
                    "status": doc["status"],
                    "updatedAt": _serialize_datetime(raw_updated),
                    "orcid": orcid,
                    "_updatedAt_raw": raw_updated,
                })

            bedrock_token = response.get("nextToken")
            if not bedrock_token:
                break

        # Sort all documents globally by updatedAt descending
        all_docs.sort(
            key=lambda d: d["_updatedAt_raw"] or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        for doc in all_docs:
            del doc["_updatedAt_raw"]

        # Slice the requested page using a numeric offset token
        offset = int(next_token) if next_token else 0
        page = all_docs[offset:offset + page_size]
        next_offset = offset + page_size
        new_next_token = str(next_offset) if next_offset < len(all_docs) else None

        # Get latest sync status
        sync_response = self.bedrock_agent.list_ingestion_jobs(
            knowledgeBaseId=self.kb_id,
            dataSourceId=self.data_source_id,
            maxResults=1,
            sortBy={"attribute": "STARTED_AT", "order": "DESCENDING"},
        )

        last_synced_at = None
        sync_status = None
        summaries = sync_response.get("ingestionJobSummaries", [])
        if summaries:
            last_synced_at = _serialize_datetime(summaries[0].get("updatedAt"))
            sync_status = summaries[0].get("status")

        return {
            "documents": page,
            "nextToken": new_next_token,
            "lastSyncedAt": last_synced_at,
            "syncStatus": sync_status,
        }

    def list_researchers(self, user_id: str, fetched_bucket: str) -> list[str]:
        """Return unique ORCIDs from fetched-papers/ (fetched bucket) and papers/{user_id}/ (manual uploads)."""
        orcid_pattern = re.compile(r'^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$')
        orcids = set()

        # Fetched papers: download-results/{user_id}/{orcid}.json (user-scoped)
        response = self.s3.list_objects_v2(
            Bucket=fetched_bucket,
            Prefix=f"download-results/{user_id}/",
        )
        for obj in response.get("Contents", []):
            filename = obj["Key"].split("/")[-1]
            if filename.endswith(".json"):
                segment = filename[:-5]
                if orcid_pattern.match(segment):
                    orcids.add(segment)

        # Manual uploads with ORCID tag: papers/{user_id}/{orcid}/
        response = self.s3.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=f"papers/{user_id}/",
            Delimiter="/",
        )
        for cp in response.get("CommonPrefixes", []):
            segment = cp["Prefix"].rstrip("/").split("/")[-1]
            if orcid_pattern.match(segment):
                orcids.add(segment)

        return list(orcids)

    def list_sync_jobs(self, page_size: int, next_token: str | None) -> dict:
        """List ingestion jobs with pagination, sorted by startedAt descending."""
        params: dict[str, Any] = {
            "knowledgeBaseId": self.kb_id,
            "dataSourceId": self.data_source_id,
            "maxResults": page_size,
            "sortBy": {"attribute": "STARTED_AT", "order": "DESCENDING"},
        }
        if next_token:
            params["nextToken"] = next_token

        response = self.bedrock_agent.list_ingestion_jobs(**params)

        jobs = []
        for summary in response.get("ingestionJobSummaries", []):
            jobs.append({
                "ingestionJobId": summary["ingestionJobId"],
                "status": summary["status"],
                "startedAt": _serialize_datetime(summary.get("startedAt")),
                "updatedAt": _serialize_datetime(summary.get("updatedAt")),
                "statistics": summary.get("statistics", {}),
                "failureReasons": summary.get("failureReasons", []),
            })

        return {
            "jobs": jobs,
            "nextToken": response.get("nextToken"),
        }

    def get_sync_job(self, job_id: str) -> dict | None:
        """Get a single ingestion job by ID.

        Returns:
            Job dict with ingestionJobId, status, startedAt, updatedAt, statistics, failureReasons.
            None if job not found.
        """
        try:
            response = self.bedrock_agent.get_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.data_source_id,
                ingestionJobId=job_id,
            )
            job = response["ingestionJob"]
            return {
                "ingestionJobId": job["ingestionJobId"],
                "status": job["status"],
                "startedAt": _serialize_datetime(job.get("startedAt")),
                "updatedAt": _serialize_datetime(job.get("updatedAt")),
                "statistics": job.get("statistics", {}),
                "failureReasons": job.get("failureReasons", []),
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                return None
            raise
