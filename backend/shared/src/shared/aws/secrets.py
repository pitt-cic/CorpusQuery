"""Secrets Manager client for API keys."""

import json


class SecretsClient:
    """Client for reading/writing API keys in Secrets Manager."""

    def __init__(self, secrets_client, prefix: str = "/corpus-query"):
        """Initialize with a boto3 Secrets Manager client."""
        self.secrets = secrets_client
        self.prefix = prefix

    def _secret_name(self, user_id: str) -> str:
        return f"{self.prefix}/{user_id}/api-keys"

    def put_secrets(self, user_id: str, secrets: dict) -> None:
        """Store or update API keys for a user."""
        secret_name = self._secret_name(user_id)

        try:
            existing = self._get_secret_value(user_id)
            merged = {**existing, **secrets}
            self.secrets.put_secret_value(
                SecretId=secret_name,
                SecretString=json.dumps(merged),
            )
        except self.secrets.exceptions.ResourceNotFoundException:
            self.secrets.create_secret(
                Name=secret_name,
                SecretString=json.dumps(secrets),
            )

    def get_secrets_status(self, user_id: str) -> dict[str, bool]:
        """Check which API keys exist for a user."""
        try:
            secrets = self._get_secret_value(user_id)
            return {
                "ANTHROPIC_API_KEY": bool(secrets.get("ANTHROPIC_API_KEY")),
                "OPENAI_API_KEY": bool(secrets.get("OPENAI_API_KEY")),
                "OPENALEX_API_KEY": bool(secrets.get("OPENALEX_API_KEY")),
                "NCBI_API_KEY": bool(secrets.get("NCBI_API_KEY")),
            }
        except self.secrets.exceptions.ResourceNotFoundException:
            return {
                "ANTHROPIC_API_KEY": False,
                "OPENAI_API_KEY": False,
                "OPENALEX_API_KEY": False,
                "NCBI_API_KEY": False,
            }

    def get_secrets(self, user_id: str) -> dict:
        """Get API keys for a user. Returns empty dict if none stored."""
        try:
            return self._get_secret_value(user_id)
        except self.secrets.exceptions.ResourceNotFoundException:
            return {}

    def _get_secret_value(self, user_id: str) -> dict:
        """Get the raw secret value."""
        response = self.secrets.get_secret_value(
            SecretId=self._secret_name(user_id)
        )
        return json.loads(response["SecretString"])
