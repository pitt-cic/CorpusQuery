#!/usr/bin/env bash
# Setup S3 Vectors bucket and index for paper-qa vector storage.
# Run: bash backend/scripts/setup_s3vectors.sh
#
# Configurable via environment variables:
#   VECTOR_BUCKET - name of the S3 Vectors bucket (default: corpus-query-vectors-dev)
#   VECTOR_INDEX  - name of the vector index (default: papers)
#   AWS_REGION    - AWS region (default: us-east-1)
set -euo pipefail

BUCKET_NAME="${VECTOR_BUCKET:-corpus-query-vectors-dev}"
INDEX_NAME="${VECTOR_INDEX:-papers}"
REGION="${AWS_REGION:-us-east-1}"

echo "============================================================"
echo "S3 Vectors Setup"
echo "============================================================"
echo "  Bucket: $BUCKET_NAME"
echo "  Index:  $INDEX_NAME"
echo "  Region: $REGION"
echo "============================================================"

echo ""
echo "Creating S3 Vectors bucket: $BUCKET_NAME in $REGION"
aws s3vectors create-vector-bucket \
  --vector-bucket-name "$BUCKET_NAME" \
  --region "$REGION" 2>&1 || {
    # Check if it's an "already exists" error
    if aws s3vectors get-vector-bucket --vector-bucket-name "$BUCKET_NAME" --region "$REGION" &>/dev/null; then
      echo "  Bucket already exists, continuing..."
    else
      echo "  ERROR: Failed to create bucket and bucket does not exist"
      exit 1
    fi
  }

echo ""
echo "Waiting for bucket to be ready..."
sleep 5

echo ""
echo "Creating vector index: $INDEX_NAME (1024 dims, cosine, float32)"
aws s3vectors create-index \
  --vector-bucket-name "$BUCKET_NAME" \
  --index-name "$INDEX_NAME" \
  --data-type float32 \
  --dimension 1024 \
  --distance-metric cosine \
  --region "$REGION" 2>&1 || {
    # Check if it's an "already exists" error
    if aws s3vectors get-index --vector-bucket-name "$BUCKET_NAME" --index-name "$INDEX_NAME" --region "$REGION" &>/dev/null; then
      echo "  Index already exists, continuing..."
    else
      echo "  ERROR: Failed to create index and index does not exist"
      exit 1
    fi
  }

echo ""
echo "============================================================"
echo "Setup Complete"
echo "============================================================"
echo ""
echo "Export these before running integration tests:"
echo "  export VECTOR_BUCKET=$BUCKET_NAME"
echo "  export VECTOR_INDEX=$INDEX_NAME"
echo "  export AWS_REGION=$REGION"
