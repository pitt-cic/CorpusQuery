#!/usr/bin/env bash
# Teardown AWS resources created for paper-qa testing.
# Run: bash backend/scripts/teardown_aws.sh
#
# Configurable via environment variables:
#   VECTOR_BUCKET - name of the S3 Vectors bucket (default: corpus-query-vectors-dev)
#   VECTOR_INDEX  - name of the vector index (default: papers)
#   KB_ID         - Bedrock Knowledge Base ID (optional, if set will be deleted)
#   AWS_REGION    - AWS region (default: us-east-1)
#
# CAUTION: This script permanently deletes AWS resources. Use with care.
set -euo pipefail

VECTOR_BUCKET="${VECTOR_BUCKET:-corpus-query-vectors-dev}"
VECTOR_INDEX="${VECTOR_INDEX:-papers}"
KB_ID="${KB_ID:-}"
REGION="${AWS_REGION:-us-east-1}"

echo "============================================================"
echo "AWS Resource Teardown"
echo "============================================================"
echo "  Vector Bucket: $VECTOR_BUCKET"
echo "  Vector Index:  $VECTOR_INDEX"
echo "  Region:        $REGION"
if [ -n "$KB_ID" ]; then
  echo "  Knowledge Base: $KB_ID"
fi
echo "============================================================"
echo ""
echo "WARNING: This will PERMANENTLY DELETE the above AWS resources."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

# Delete S3 Vectors index
echo ""
echo "Deleting vector index: $VECTOR_INDEX from bucket: $VECTOR_BUCKET"
if aws s3vectors delete-index \
  --vector-bucket-name "$VECTOR_BUCKET" \
  --index-name "$VECTOR_INDEX" \
  --region "$REGION" 2>/dev/null; then
  echo "  Index deleted successfully"
else
  echo "  Index not found or already deleted"
fi

# Delete S3 Vectors bucket
echo ""
echo "Deleting vector bucket: $VECTOR_BUCKET"
if aws s3vectors delete-vector-bucket \
  --vector-bucket-name "$VECTOR_BUCKET" \
  --region "$REGION" 2>/dev/null; then
  echo "  Bucket deleted successfully"
else
  echo "  Bucket not found or already deleted"
fi

# Delete Bedrock Knowledge Base if KB_ID is set
if [ -n "$KB_ID" ]; then
  echo ""
  echo "Deleting Bedrock Knowledge Base: $KB_ID"
  if aws bedrock-agent delete-knowledge-base \
    --knowledge-base-id "$KB_ID" \
    --region "$REGION" 2>/dev/null; then
    echo "  Knowledge Base deleted successfully"
  else
    echo "  Knowledge Base not found or already deleted"
  fi
fi

echo ""
echo "============================================================"
echo "Teardown Complete"
echo "============================================================"
