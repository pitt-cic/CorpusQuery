"""Sessions repository for DynamoDB operations."""

import base64
import json
from datetime import datetime, timezone


class SessionsRepository:
    """Repository for session CRUD operations."""

    def __init__(self, table):
        """Initialize with a DynamoDB Table resource."""
        self.table = table

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def list_sessions(self, user_id: str) -> list[dict]:
        """List all sessions for a user."""
        response = self.table.query(
            KeyConditionExpression="user_id = :uid AND begins_with(sk, :prefix)",
            ExpressionAttributeValues={
                ":uid": user_id,
                ":prefix": "session#",
            },
        )
        items = response.get("Items", [])
        return [self._item_to_session(item) for item in items]

    def get_session(self, user_id: str, session_id: str) -> dict | None:
        """Get a single session by ID."""
        response = self.table.get_item(
            Key={"user_id": user_id, "sk": f"session#{session_id}"}
        )
        item = response.get("Item")
        return self._item_to_session(item) if item else None

    def create_session(self, user_id: str, session_id: str, title: str) -> dict:
        """Create a new session."""
        now = self._now()
        item = {
            "user_id": user_id,
            "sk": f"session#{session_id}",
            "session_id": session_id,
            "title": title,
            "created_at": now,
            "last_active": now,
        }
        self.table.put_item(Item=item)
        return self._item_to_session(item)

    def update_session(self, user_id: str, session_id: str, title: str) -> dict | None:
        """Update session title and last_active timestamp."""
        now = self._now()
        try:
            response = self.table.update_item(
                Key={"user_id": user_id, "sk": f"session#{session_id}"},
                UpdateExpression="SET title = :title, last_active = :last_active",
                ExpressionAttributeValues={
                    ":title": title,
                    ":last_active": now,
                },
                ConditionExpression="attribute_exists(sk)",
                ReturnValues="ALL_NEW",
            )
            return self._item_to_session(response["Attributes"])
        except self.table.meta.client.exceptions.ConditionalCheckFailedException:
            return None

    def update_last_active(self, user_id: str, session_id: str) -> None:
        """Update only the last_active timestamp."""
        now = self._now()
        self.table.update_item(
            Key={"user_id": user_id, "sk": f"session#{session_id}"},
            UpdateExpression="SET last_active = :last_active",
            ExpressionAttributeValues={":last_active": now},
        )

    def delete_session(self, user_id: str, session_id: str) -> None:
        """Delete a session."""
        self.table.delete_item(
            Key={"user_id": user_id, "sk": f"session#{session_id}"}
        )

    def list_sessions_paginated(
        self, user_id: str, page_size: int = 20, next_token: str | None = None
    ) -> dict:
        """List sessions paginated, sorted by last_active descending."""
        query_params = {
            "IndexName": "user-sessions-by-last-active",
            "KeyConditionExpression": "user_id = :uid",
            "ExpressionAttributeValues": {":uid": user_id},
            "ScanIndexForward": False,
            "Limit": page_size,
        }
        if next_token:
            query_params["ExclusiveStartKey"] = json.loads(
                base64.b64decode(next_token).decode()
            )

        response = self.table.query(**query_params)

        items = response.get("Items", [])
        last_key = response.get("LastEvaluatedKey")

        encoded_token = None
        if last_key:
            encoded_token = base64.b64encode(json.dumps(last_key).encode()).decode()

        return {
            "sessions": [self._item_to_session(item) for item in items],
            "next_token": encoded_token,
        }

    def _item_to_session(self, item: dict) -> dict:
        """Convert DynamoDB item to session dict."""
        return {
            "session_id": item["session_id"],
            "title": item["title"],
            "created_at": item["created_at"],
            "last_active": item["last_active"],
        }
