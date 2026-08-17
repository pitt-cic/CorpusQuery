"""Authentication utilities for extracting user identity from API Gateway events."""


def get_authenticated_user_id(event: dict) -> str:
    """Extract Cognito user ID (sub) from API Gateway event.

    Args:
        event: The raw Lambda event from API Gateway with Cognito authorizer.

    Returns:
        The Cognito user's sub (unique identifier).

    Raises:
        KeyError: If the event doesn't contain authorizer claims.
    """
    return event["requestContext"]["authorizer"]["claims"]["sub"]
