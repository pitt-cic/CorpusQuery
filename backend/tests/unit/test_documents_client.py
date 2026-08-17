"""Unit tests for DocumentsClient."""

import pytest
from unittest.mock import MagicMock, patch


class TestListExistingFiles:
    """Tests for list_existing_files method."""

    def test_returns_filenames_from_all_users(self):
        """Should return filenames from all users since KB is shared."""
        from shared.aws.documents import DocumentsClient

        s3_client = MagicMock()
        s3_client.get_paginator.return_value.paginate.return_value = [
            {
                "Contents": [
                    {"Key": "papers/user123/paper1.pdf"},
                    {"Key": "papers/user456/paper2.pdf"},
                    {"Key": "papers/legacy.pdf"},  # legacy file without user prefix
                ]
            }
        ]

        client = DocumentsClient(
            s3_client=s3_client,
            bedrock_agent_client=MagicMock(),
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_existing_files("user123")

        assert result == {"paper1.pdf", "paper2.pdf", "legacy.pdf"}
        s3_client.get_paginator.assert_called_once_with("list_objects_v2")

    def test_returns_empty_set_when_no_files(self):
        """Should return empty set when no files exist."""
        from shared.aws.documents import DocumentsClient

        s3_client = MagicMock()
        s3_client.get_paginator.return_value.paginate.return_value = [{}]

        client = DocumentsClient(
            s3_client=s3_client,
            bedrock_agent_client=MagicMock(),
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_existing_files("user123")

        assert result == set()


class TestGenerateUploadUrls:
    """Tests for generate_upload_urls method."""

    def test_returns_presigned_urls_for_each_filename(self):
        """Should return presigned URL for each filename."""
        from shared.aws.documents import DocumentsClient

        s3_client = MagicMock()
        s3_client.generate_presigned_url.return_value = "https://s3.../presigned"

        client = DocumentsClient(
            s3_client=s3_client,
            bedrock_agent_client=MagicMock(),
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.generate_upload_urls("user123", ["paper1.pdf", "paper2.pdf"])

        assert len(result) == 2
        assert result[0]["filename"] == "paper1.pdf"
        assert result[0]["uploadUrl"] == "https://s3.../presigned"
        assert result[0]["expiresIn"] == 3600

    def test_sets_correct_s3_key_with_user_prefix(self):
        """Should generate URL for papers/{userId}/{filename} path."""
        from shared.aws.documents import DocumentsClient

        s3_client = MagicMock()
        s3_client.generate_presigned_url.return_value = "https://s3.../presigned"

        client = DocumentsClient(
            s3_client=s3_client,
            bedrock_agent_client=MagicMock(),
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        client.generate_upload_urls("user123", ["paper1.pdf"])

        s3_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "papers/user123/paper1.pdf",
                "ContentType": "application/pdf",
            },
            ExpiresIn=3600,
        )


class TestStartSync:
    """Tests for start_sync method."""

    def test_triggers_ingestion_job_and_returns_status(self):
        """Should call start_ingestion_job and return job id + status."""
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.start_ingestion_job.return_value = {
            "ingestionJob": {
                "ingestionJobId": "job123",
                "status": "STARTING",
            }
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.start_sync()

        assert result["ingestionJobId"] == "job123"
        assert result["status"] == "STARTING"
        bedrock_client.start_ingestion_job.assert_called_once_with(
            knowledgeBaseId="kb123",
            dataSourceId="ds456",
        )


class TestListDocuments:
    """Tests for list_documents method."""

    def test_returns_documents_with_sync_status(self):
        """Should return documents list with sync status."""
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.list_knowledge_base_documents.return_value = {
            "documentDetails": [
                {
                    "identifier": {
                        "s3": {"uri": "s3://bucket/papers/user1/paper1.pdf"}
                    },
                    "status": "INDEXED",
                    "updatedAt": "2026-06-05T19:59:20Z",
                }
            ],
            "nextToken": None,
        }
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": [
                {
                    "status": "COMPLETE",
                    "updatedAt": "2026-06-05T19:59:20Z",
                }
            ]
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_documents(page_size=100, next_token=None)

        assert len(result["documents"]) == 1
        assert result["documents"][0]["filename"] == "paper1.pdf"
        assert result["documents"][0]["status"] == "INDEXED"
        assert result["syncStatus"] == "COMPLETE"
        assert result["lastSyncedAt"] == "2026-06-05T19:59:20Z"

    def test_extracts_filename_from_s3_uri(self):
        """Should extract just the filename from full S3 URI."""
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.list_knowledge_base_documents.return_value = {
            "documentDetails": [
                {
                    "identifier": {
                        "s3": {"uri": "s3://bucket/papers/user1/subfolder/deep/paper.pdf"}
                    },
                    "status": "INDEXED",
                    "updatedAt": "2026-06-05T19:59:20Z",
                }
            ],
            "nextToken": None,
        }
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": []
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_documents(page_size=100, next_token=None)

        assert result["documents"][0]["filename"] == "paper.pdf"

    def test_serializes_datetime_objects_to_iso_strings(self):
        """Should convert datetime objects from boto3 to ISO format strings."""
        from datetime import datetime
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        # boto3 returns datetime objects, not strings
        bedrock_client.list_knowledge_base_documents.return_value = {
            "documentDetails": [
                {
                    "identifier": {
                        "s3": {"uri": "s3://bucket/papers/user1/paper1.pdf"}
                    },
                    "status": "INDEXED",
                    "updatedAt": datetime(2026, 6, 5, 19, 59, 20),
                }
            ],
            "nextToken": None,
        }
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": [
                {
                    "status": "COMPLETE",
                    "updatedAt": datetime(2026, 6, 5, 19, 59, 20),
                }
            ]
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_documents(page_size=100, next_token=None)

        # Should be ISO format strings, not datetime objects
        assert result["documents"][0]["updatedAt"] == "2026-06-05T19:59:20"
        assert result["lastSyncedAt"] == "2026-06-05T19:59:20"
        # Verify they're actually strings (JSON serializable)
        import json
        json.dumps(result)  # Should not raise


class TestListSyncJobs:
    """Tests for list_sync_jobs method."""

    def test_returns_jobs_sorted_by_started_at_descending(self):
        """Should return ingestion jobs sorted by startedAt descending."""
        from datetime import datetime
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": [
                {
                    "ingestionJobId": "job1",
                    "status": "COMPLETE",
                    "startedAt": datetime(2026, 6, 9, 10, 30, 0),
                    "updatedAt": datetime(2026, 6, 9, 10, 32, 15),
                    "statistics": {
                        "numberOfDocumentsScanned": 25,
                        "numberOfDocumentsFailed": 0,
                        "numberOfNewDocumentsIndexed": 3,
                        "numberOfModifiedDocumentsIndexed": 0,
                        "numberOfDocumentsDeleted": 0,
                    },
                }
            ],
            "nextToken": "abc123",
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_sync_jobs(page_size=5, next_token=None)

        assert len(result["jobs"]) == 1
        assert result["jobs"][0]["ingestionJobId"] == "job1"
        assert result["jobs"][0]["status"] == "COMPLETE"
        assert result["jobs"][0]["startedAt"] == "2026-06-09T10:30:00"
        assert result["jobs"][0]["statistics"]["numberOfNewDocumentsIndexed"] == 3
        assert result["nextToken"] == "abc123"

        bedrock_client.list_ingestion_jobs.assert_called_once_with(
            knowledgeBaseId="kb123",
            dataSourceId="ds456",
            maxResults=5,
            sortBy={"attribute": "STARTED_AT", "order": "DESCENDING"},
        )

    def test_passes_next_token_when_provided(self):
        """Should pass nextToken to Bedrock API when provided."""
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": [],
            "nextToken": None,
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        client.list_sync_jobs(page_size=5, next_token="prev-token")

        call_kwargs = bedrock_client.list_ingestion_jobs.call_args[1]
        assert call_kwargs["nextToken"] == "prev-token"

    def test_includes_failure_reasons_for_failed_jobs(self):
        """Should include failureReasons for failed jobs."""
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.list_ingestion_jobs.return_value = {
            "ingestionJobSummaries": [
                {
                    "ingestionJobId": "job1",
                    "status": "FAILED",
                    "startedAt": "2026-06-09T10:30:00Z",
                    "updatedAt": "2026-06-09T10:32:15Z",
                    "statistics": {
                        "numberOfDocumentsScanned": 0,
                        "numberOfDocumentsFailed": 1,
                        "numberOfNewDocumentsIndexed": 0,
                        "numberOfModifiedDocumentsIndexed": 0,
                        "numberOfDocumentsDeleted": 0,
                    },
                    "failureReasons": ["S3 access denied"],
                }
            ],
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.list_sync_jobs(page_size=5, next_token=None)

        assert result["jobs"][0]["failureReasons"] == ["S3 access denied"]


class TestStartSyncConflict:
    """Tests for start_sync ConflictException handling."""

    def test_raises_sync_in_progress_error_on_conflict(self):
        """Should raise SyncInProgressError when Bedrock returns ConflictException."""
        from botocore.exceptions import ClientError
        from shared.aws.documents import DocumentsClient, SyncInProgressError

        bedrock_client = MagicMock()
        bedrock_client.start_ingestion_job.side_effect = ClientError(
            {"Error": {"Code": "ConflictException", "Message": "Ingestion job already in progress"}},
            "StartIngestionJob",
        )

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        with pytest.raises(SyncInProgressError) as exc_info:
            client.start_sync()

        assert "already in progress" in str(exc_info.value).lower()

    def test_reraises_non_conflict_client_errors(self):
        """Should re-raise ClientError when not ConflictException."""
        from botocore.exceptions import ClientError
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.start_ingestion_job.side_effect = ClientError(
            {"Error": {"Code": "ValidationException", "Message": "Invalid parameter"}},
            "StartIngestionJob",
        )

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        with pytest.raises(ClientError) as exc_info:
            client.start_sync()

        assert exc_info.value.response["Error"]["Code"] == "ValidationException"


class TestGetSyncJob:
    """Tests for get_sync_job method."""

    def test_returns_job_by_id(self):
        """Should fetch and return a single ingestion job by ID."""
        from datetime import datetime
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.get_ingestion_job.return_value = {
            "ingestionJob": {
                "ingestionJobId": "job123",
                "status": "COMPLETE",
                "startedAt": datetime(2026, 6, 9, 10, 30, 0),
                "updatedAt": datetime(2026, 6, 9, 10, 35, 0),
                "statistics": {
                    "numberOfDocumentsScanned": 10,
                    "numberOfDocumentsFailed": 0,
                    "numberOfNewDocumentsIndexed": 2,
                    "numberOfModifiedDocumentsIndexed": 1,
                    "numberOfDocumentsDeleted": 0,
                },
                "failureReasons": [],
            }
        }

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.get_sync_job("job123")

        assert result["ingestionJobId"] == "job123"
        assert result["status"] == "COMPLETE"
        assert result["startedAt"] == "2026-06-09T10:30:00"
        assert result["statistics"]["numberOfNewDocumentsIndexed"] == 2
        bedrock_client.get_ingestion_job.assert_called_once_with(
            knowledgeBaseId="kb123",
            dataSourceId="ds456",
            ingestionJobId="job123",
        )

    def test_returns_none_when_job_not_found(self):
        """Should return None when job doesn't exist."""
        from botocore.exceptions import ClientError
        from shared.aws.documents import DocumentsClient

        bedrock_client = MagicMock()
        bedrock_client.get_ingestion_job.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException", "Message": "Job not found"}},
            "GetIngestionJob",
        )

        client = DocumentsClient(
            s3_client=MagicMock(),
            bedrock_agent_client=bedrock_client,
            bucket_name="test-bucket",
            kb_id="kb123",
            data_source_id="ds456",
        )

        result = client.get_sync_job("nonexistent")

        assert result is None
