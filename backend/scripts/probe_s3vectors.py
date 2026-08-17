#!/usr/bin/env python3
"""
Probe S3 Vectors API to verify put_vectors, query_vectors, delete_vectors work.
Run: uv run python backend/scripts/probe_s3vectors.py

Prerequisites:
- Run setup_s3vectors.sh first to create bucket and index
- Set environment variables: VECTOR_BUCKET, VECTOR_INDEX, AWS_REGION

If any probe fails, we fall back to Bedrock Knowledge Bases (Task 5).
"""
import os
import sys

import boto3
from botocore.exceptions import ClientError

# Configuration from environment
BUCKET_NAME = os.environ.get("VECTOR_BUCKET", "corpus-query-vectors-dev")
INDEX_NAME = os.environ.get("VECTOR_INDEX", "papers")
REGION = os.environ.get("AWS_REGION", "us-east-1")

# Test vector: 1024 dimensions (matching Titan Embed v2 output)
TEST_KEY = "probe-test-vector-001"
TEST_VECTOR = [0.1] * 1024  # Simple test vector


def get_client():
    """Create S3 Vectors client."""
    return boto3.client("s3vectors", region_name=REGION)


def probe_put_vectors() -> tuple[bool, str]:
    """Test put_vectors API."""
    print("=" * 60)
    print("Probe 1: S3 Vectors - put_vectors")
    print(f"  Bucket: {BUCKET_NAME}")
    print(f"  Index:  {INDEX_NAME}")
    print(f"  Key:    {TEST_KEY}")
    print("=" * 60)

    try:
        client = get_client()
        response = client.put_vectors(
            vectorBucketName=BUCKET_NAME,
            indexName=INDEX_NAME,
            vectors=[
                {
                    "key": TEST_KEY,
                    "data": {"float32": TEST_VECTOR},
                    "metadata": {
                        "source": "probe_test",
                        "description": "Test vector for S3 Vectors API probe",
                    },
                }
            ],
        )

        # Check response
        if "failedVectors" in response and response["failedVectors"]:
            msg = f"put_vectors returned failures: {response['failedVectors']}"
            print(f"  FAIL: {msg}")
            return False, msg

        print("  PASS: Vector inserted successfully")
        return True, ""

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        msg = f"ClientError ({error_code}): {error_msg}"
        print(f"  FAIL: {msg}")
        return False, msg
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  FAIL: {msg}")
        return False, msg


def probe_query_vectors() -> tuple[bool, str]:
    """Test query_vectors API."""
    print("\n" + "=" * 60)
    print("Probe 2: S3 Vectors - query_vectors")
    print(f"  Query: Same vector as inserted (should match itself)")
    print(f"  Top-K: 5")
    print("=" * 60)

    try:
        client = get_client()
        response = client.query_vectors(
            vectorBucketName=BUCKET_NAME,
            indexName=INDEX_NAME,
            queryVector={"float32": TEST_VECTOR},
            topK=5,
            returnDistance=True,
            returnMetadata=True,
        )

        vectors = response.get("vectors", [])
        if not vectors:
            msg = "query_vectors returned empty results"
            print(f"  FAIL: {msg}")
            return False, msg

        # Check if our test vector is in the results
        found = False
        for v in vectors:
            if v.get("key") == TEST_KEY:
                found = True
                distance = v.get("distance", "N/A")
                print(f"  Found test vector: key={TEST_KEY}, distance={distance}")
                break

        if not found:
            msg = f"Test vector '{TEST_KEY}' not found in query results"
            print(f"  FAIL: {msg}")
            return False, msg

        print(f"  PASS: Query returned {len(vectors)} results, test vector found")
        return True, ""

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        msg = f"ClientError ({error_code}): {error_msg}"
        print(f"  FAIL: {msg}")
        return False, msg
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  FAIL: {msg}")
        return False, msg


def probe_delete_vectors() -> tuple[bool, str]:
    """Test delete_vectors API (cleanup)."""
    print("\n" + "=" * 60)
    print("Probe 3: S3 Vectors - delete_vectors (cleanup)")
    print(f"  Deleting: {TEST_KEY}")
    print("=" * 60)

    try:
        client = get_client()
        response = client.delete_vectors(
            vectorBucketName=BUCKET_NAME,
            indexName=INDEX_NAME,
            keys=[TEST_KEY],
        )

        # Check response
        if "failedKeys" in response and response["failedKeys"]:
            msg = f"delete_vectors returned failures: {response['failedKeys']}"
            print(f"  FAIL: {msg}")
            return False, msg

        print("  PASS: Vector deleted successfully")
        return True, ""

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        msg = f"ClientError ({error_code}): {error_msg}"
        print(f"  FAIL: {msg}")
        return False, msg
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        print(f"  FAIL: {msg}")
        return False, msg


def main():
    print("\n" + "=" * 60)
    print("S3 Vectors API Probe")
    print("=" * 60)
    print(f"  VECTOR_BUCKET: {BUCKET_NAME}")
    print(f"  VECTOR_INDEX:  {INDEX_NAME}")
    print(f"  AWS_REGION:    {REGION}")
    print("=" * 60 + "\n")

    # Run probes
    put_ok, put_err = probe_put_vectors()
    query_ok, query_err = probe_query_vectors()
    delete_ok, delete_err = probe_delete_vectors()

    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"  put_vectors:    {'PASS' if put_ok else 'FAIL'}")
    print(f"  query_vectors:  {'PASS' if query_ok else 'FAIL'}")
    print(f"  delete_vectors: {'PASS' if delete_ok else 'FAIL'}")

    # Determine path
    if put_ok and query_ok:
        print("\n" + "=" * 60)
        print("RESULT: All critical probes passed")
        print("  -> Continue to Phase 2, Path A (raw S3 Vectors)")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("** HALT: S3 Vectors API probe failed **")
        print("=" * 60)
        if not put_ok:
            print(f"  put_vectors error: {put_err}")
        if not query_ok:
            print(f"  query_vectors error: {query_err}")
        print("\n  Alternative: Use Bedrock Knowledge Bases with S3 Vectors backend (Task 5)")
        print("  Awaiting user approval to proceed with alternative path.")
        sys.exit(1)


if __name__ == "__main__":
    main()
