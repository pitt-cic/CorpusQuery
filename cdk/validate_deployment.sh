#!/bin/bash
# Validation script for styleguide integration deployment

set -e

echo "======================================"
echo "Styleguide Integration Validation"
echo "======================================"
echo ""

STACK_NAME="CorpusQueryStack"
ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ((ERRORS++))
    fi
}

# Check AWS CLI
echo "Checking AWS CLI..."
aws --version > /dev/null 2>&1
check "AWS CLI installed"

# Check stack exists
echo ""
echo "Checking CloudFormation stack..."
aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].StackStatus' > /dev/null 2>&1
check "Stack '$STACK_NAME' exists"

# Get outputs
echo ""
echo "Fetching stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`PapersBucketName`].OutputValue' --output text 2>/dev/null)

if [ -n "$API_URL" ]; then
    echo -e "${GREEN}✓${NC} API URL: $API_URL"
else
    echo -e "${RED}✗${NC} Could not fetch API URL"
    ((ERRORS++))
fi

# Check Lambda functions
echo ""
echo "Checking Lambda functions..."

aws lambda get-function --function-name corpus-query-api > /dev/null 2>&1
check "API Lambda exists"

aws lambda get-function --function-name corpus-query-StyleguideProcessingLambda > /dev/null 2>&1
check "Processing Lambda exists"

aws lambda get-function --function-name corpus-query-StyleguideConsolidatelambda > /dev/null 2>&1
check "Consolidate Lambda exists"

# Check Step Functions
echo ""
echo "Checking Step Functions..."
STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines --query "stateMachines[?name=='StyleguideStateMachine'].stateMachineArn" --output text 2>/dev/null)

if [ -n "$STATE_MACHINE_ARN" ]; then
    echo -e "${GREEN}✓${NC} State Machine exists: $STATE_MACHINE_ARN"
else
    echo -e "${RED}✗${NC} StyleguideStateMachine not found"
    ((ERRORS++))
fi

# Check S3 bucket
echo ""
echo "Checking S3 bucket..."
if [ -n "$BUCKET_NAME" ]; then
    aws s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1
    check "Papers bucket '$BUCKET_NAME' accessible"
else
    echo -e "${RED}✗${NC} Could not determine bucket name"
    ((ERRORS++))
fi

# Check Lambda environment variables
echo ""
echo "Checking Lambda environment variables..."

API_ENV=$(aws lambda get-function-configuration --function-name corpus-query-api --query 'Environment.Variables.STYLEGUIDE_STATE_MACHINE_ARN' --output text 2>/dev/null)
if [ -n "$API_ENV" ] && [ "$API_ENV" != "None" ]; then
    echo -e "${GREEN}✓${NC} API Lambda has STYLEGUIDE_STATE_MACHINE_ARN"
else
    echo -e "${RED}✗${NC} API Lambda missing STYLEGUIDE_STATE_MACHINE_ARN"
    ((ERRORS++))
fi

PROCESSING_BUCKET=$(aws lambda get-function-configuration --function-name corpus-query-StyleguideProcessingLambda --query 'Environment.Variables.BUCKET_NAME' --output text 2>/dev/null)
if [ -n "$PROCESSING_BUCKET" ] && [ "$PROCESSING_BUCKET" != "None" ]; then
    echo -e "${GREEN}✓${NC} Processing Lambda has BUCKET_NAME"
else
    echo -e "${RED}✗${NC} Processing Lambda missing BUCKET_NAME"
    ((ERRORS++))
fi

CONSOLIDATE_TABLE=$(aws lambda get-function-configuration --function-name corpus-query-StyleguideConsolidatelambda --query 'Environment.Variables.TABLE_NAME' --output text 2>/dev/null)
if [ -n "$CONSOLIDATE_TABLE" ] && [ "$CONSOLIDATE_TABLE" != "None" ]; then
    echo -e "${GREEN}✓${NC} Consolidate Lambda has TABLE_NAME"
else
    echo -e "${RED}✗${NC} Consolidate Lambda missing TABLE_NAME"
    ((ERRORS++))
fi

# Check IAM permissions (basic check)
echo ""
echo "Checking IAM permissions..."

# Check if API Lambda can start Step Functions
API_ROLE=$(aws lambda get-function-configuration --function-name corpus-query-api --query 'Role' --output text 2>/dev/null)
if [ -n "$API_ROLE" ]; then
    ROLE_NAME=$(echo $API_ROLE | rev | cut -d'/' -f1 | rev)
    aws iam get-role-policy --role-name $ROLE_NAME --policy-name StepFunctionsPolicy > /dev/null 2>&1 || \
    aws iam list-attached-role-policies --role-name $ROLE_NAME | grep -q "StepFunctions" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} API Lambda has Step Functions permissions (likely)"
    else
        echo -e "${YELLOW}⚠${NC} Could not verify API Lambda Step Functions permissions"
    fi
fi

# Check API endpoint health
echo ""
echo "Testing API endpoint..."
if [ -n "$API_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}health")
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓${NC} API health endpoint responding"
    else
        echo -e "${RED}✗${NC} API health endpoint returned $HTTP_CODE"
        ((ERRORS++))
    fi
fi

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "You can now test the styleguide integration:"
    echo "  1. Update test_styleguide.py with your credentials"
    echo "  2. Run: python test_styleguide.py"
    echo ""
    echo "Or test manually following: test_styleguide_manual.md"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s)${NC}"
    echo ""
    echo "Please fix the issues above before testing."
    echo "If you just deployed, you may need to run: cdk deploy"
    exit 1
fi
