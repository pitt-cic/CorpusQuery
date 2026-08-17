"""Jobs repository for DynamoDB operations."""

from datetime import datetime, timezone
from decimal import Decimal


class JobsRepository:
    """Repository for job CRUD operations."""

    def __init__(self, table):
        """Initialize with a DynamoDB Table resource."""
        self.table = table

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def create_job(
        self, user_id: str, job_id: str, session_id: str, question: str
    ) -> dict:
        """Create a new job with pending status."""
        timestamp = self._now()
        sk = f"job#{timestamp}#{job_id}"
        item = {
            "user_id": user_id,
            "sk": sk,
            "job_id": job_id,
            "session_id": session_id,
            "status": "pending",
            "question": question,
            "created_at": timestamp,
        }
        self.table.put_item(Item=item)
        return {**item, "timestamp": timestamp}

    def get_job(self, user_id: str, job_id: str) -> dict | None:
        """Get a job by ID."""
        response = self.table.query(
            KeyConditionExpression="user_id = :uid AND begins_with(sk, :prefix)",
            FilterExpression="job_id = :jid",
            ExpressionAttributeValues={
                ":uid": user_id,
                ":prefix": "job#",
                ":jid": job_id,
            },
        )
        items = response.get("Items", [])
        return self._item_to_job(items[0]) if items else None

    def list_jobs_by_session(self, user_id: str, session_id: str) -> list[dict]:
        """List all jobs for a session, ordered by creation time."""
        response = self.table.query(
            KeyConditionExpression="user_id = :uid AND begins_with(sk, :prefix)",
            FilterExpression="session_id = :sid",
            ExpressionAttributeValues={
                ":uid": user_id,
                ":prefix": "job#",
                ":sid": session_id,
            },
        )
        items = response.get("Items", [])
        return [self._item_to_job(item) for item in items]

    def update_job_status(
        self, user_id: str, sk: str, status: str, **fields
    ) -> None:
        """Update job status and optional fields."""
        update_expr = "SET #status = :status"
        expr_names = {"#status": "status"}
        expr_values = {":status": status}

        for key, value in fields.items():
            safe_key = key.replace("_", "")
            expr_names[f"#{safe_key}"] = key
            update_expr += f", #{safe_key} = :{safe_key}"
            if isinstance(value, float):
                expr_values[f":{safe_key}"] = Decimal(str(value))
            else:
                expr_values[f":{safe_key}"] = value

        self.table.update_item(
            Key={"user_id": user_id, "sk": sk},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )

    def delete_jobs_by_session(self, user_id: str, session_id: str) -> int:
        """Delete all jobs for a session. Returns count of deleted items."""
        jobs = self.list_jobs_by_session(user_id, session_id)
        for job in jobs:
            sk = f"job#{job['created_at']}#{job['job_id']}"
            self.table.delete_item(Key={"user_id": user_id, "sk": sk})
        return len(jobs)

    def _item_to_job(self, item: dict) -> dict:
        """Convert DynamoDB item to job dict."""
        sk = item.get("sk", "")
        fallback_job_id = sk.split("#")[-1] if sk else None

        result = {
            "job_id": item.get("job_id") or fallback_job_id,
            "session_id": item.get("session_id"),
            "status": item.get("status", "unknown"),
            "question": item.get("question", ""),
            "created_at": item.get("created_at"),
            "sk": sk,
        }
        if "answer" in item:
            result["answer"] = item["answer"]
        if "citations" in item:
            result["citations"] = item["citations"]
        if "completed_at" in item:
            result["completed_at"] = item["completed_at"]
        if "error" in item:
            result["error"] = item["error"]
        return result
    
    def list_jobs(self, user_id: str) -> list[dict]:
        """List all jobs for a session, ordered by creation time."""
        response = self.table.query(
            KeyConditionExpression="user_id = :uid AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={
                ":uid": user_id,
                ":prefix": "job#",
            },
        )
        items = response.get("Items", [])
        return [self._item_to_job(item) for item in items]

