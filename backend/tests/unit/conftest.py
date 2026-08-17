"""Unit test configuration and fixtures.

Sets required environment variables so Lambda handler modules can be imported
without AWS infrastructure present.
"""

import os

# Set required Lambda env vars before any handler module is imported.
# These are read at module level when the handler is first imported.
os.environ.setdefault("SESSIONS_AND_CHAT_HISTORY_TABLE_NAME", "test-sessions-table")
os.environ.setdefault("VECTOR_BUCKET", "test-vectors-bucket")
os.environ.setdefault("VECTOR_INDEX", "test-index")
