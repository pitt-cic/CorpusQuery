"""SSM Parameter Store client for user settings."""

import copy
import json
from datetime import datetime, timezone

DEFAULT_SETTINGS = {
    "model_config": {
        "llm": {"provider": "bedrock", "model_id": "us.anthropic.claude-sonnet-4-6"},
        "summary_llm": {"provider": "bedrock", "model_id": "us.anthropic.claude-sonnet-4-6"},
        "agent_llm": {"provider": "bedrock", "model_id": "us.anthropic.claude-haiku-4-5-20251001"},
        "embedding": {"provider": "bedrock", "model_id": "amazon.titan-embed-text-v2:0"},
    },
    "retrieval_config": {
        "evidence_k": 20,
        "max_sources": 10,
        "mmr_lambda": 0.7,
        "evidence_summary_length": 100,
        "answer_length": 400,
    },
}


class SettingsClient:
    """Client for reading/writing user settings in SSM Parameter Store."""

    def __init__(self, ssm_client, prefix: str = "/corpus-query"):
        """Initialize with a boto3 SSM client."""
        self.ssm = ssm_client
        self.prefix = prefix

    def _param_name(self, user_id: str) -> str:
        return f"{self.prefix}/{user_id}/settings"

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def _with_timestamps(self, settings: dict) -> dict:
        """Add timestamps to settings if not present."""
        now = self._now()
        result = settings.copy()

        if "model_config" in result:
            mc = result["model_config"]
            if "created_at" not in mc:
                mc["created_at"] = now
            if "updated_at" not in mc:
                mc["updated_at"] = now

        if "retrieval_config" in result:
            rc = result["retrieval_config"]
            if "created_at" not in rc:
                rc["created_at"] = now
            if "updated_at" not in rc:
                rc["updated_at"] = now

        return result

    def get_settings(self, user_id: str) -> dict:
        """Get user settings. Creates defaults if not found."""
        try:
            response = self.ssm.get_parameter(
                Name=self._param_name(user_id),
                WithDecryption=False,
            )
            return json.loads(response["Parameter"]["Value"])
        except self.ssm.exceptions.ParameterNotFound:
            default = self._with_timestamps(copy.deepcopy(DEFAULT_SETTINGS))
            self.put_settings(user_id, default)
            return default

    def put_settings(self, user_id: str, settings: dict) -> None:
        """Save user settings."""
        self.ssm.put_parameter(
            Name=self._param_name(user_id),
            Value=json.dumps(settings),
            Type="String",
            Overwrite=True,
        )
