#!/usr/bin/env bash
set -euo pipefail

# Disable AWS CLI pager
export AWS_PAGER=""

usage() {
  cat <<'EOF'
Build the frontend and deploy it to the Amplify app created by CDK.

Usage:
  ./scripts/deploy-frontend.sh [options]

Options:
  --stack-name <name>    CloudFormation stack name (default: CorpusQueryStack)
  --app-id <id>          Amplify app ID override (otherwise from stack output)
  --branch <name>        Amplify branch name (default: main)
  --profile <profile>    AWS profile to use
  --region <region>      AWS region override
  --skip-install         Skip bun install before build
  -h, --help             Show this help text
EOF
}

STACK_NAME="CorpusQueryStack"
APP_ID=""
BRANCH_NAME="main"
PROFILE=""
REGION=""
SKIP_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --stack-name)
      STACK_NAME="${2:-}"
      shift 2
      ;;
    --app-id)
      APP_ID="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH_NAME="${2:-}"
      shift 2
      ;;
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --region)
      REGION="${2:-}"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

for cmd in aws bun curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command '$cmd' is not available in PATH." >&2
    exit 1
  fi
done

# Determine zip strategy
# Note: on Windows, 'python' may be a non-functional Store alias; prefer 'py' (Windows Launcher)
_python_cmd=""
for _py in python3 py python; do
  if command -v "$_py" >/dev/null 2>&1 && "$_py" -c "import sys; sys.exit(0)" 2>/dev/null; then
    _python_cmd="$_py"
    break
  fi
done

if command -v zip >/dev/null 2>&1; then
  ZIP_METHOD="zip"
elif [[ -n "$_python_cmd" ]]; then
  ZIP_METHOD="$_python_cmd"
elif command -v powershell.exe >/dev/null 2>&1; then
  ZIP_METHOD="powershell"
else
  echo "Error: no zip tool available (tried: zip, python3, py, python, powershell.exe)." >&2
  exit 1
fi
echo "Note: using '$ZIP_METHOD' to create zip archive." >&2

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

run_aws() {
  local args=()
  [[ -n "$PROFILE" ]] && args+=(--profile "$PROFILE")
  [[ -n "$REGION" ]] && args+=(--region "$REGION")
  aws "${args[@]}" "$@"
}

get_stack_output() {
  local key="$1"
  local value

  if ! value="$(run_aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue | [0]" \
    --output text 2>/dev/null)"; then
    echo "Error: unable to read CloudFormation stack '$STACK_NAME'." >&2
    exit 1
  fi

  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Error: output '$key' not found in stack '$STACK_NAME'." >&2
    exit 1
  fi

  printf '%s\n' "$value"
}

echo "Loading backend outputs from stack '$STACK_NAME'..." >&2
API_URL="$(get_stack_output "ApiUrl")"
USER_POOL_ID="$(get_stack_output "UserPoolId")"
USER_POOL_CLIENT_ID="$(get_stack_output "UserPoolClientId")"

if [[ -z "$APP_ID" ]]; then
  APP_ID="$(get_stack_output "AmplifyAppId")"
fi

# Determine AWS region
if [[ -n "$REGION" ]]; then
  AWS_REGION="$REGION"
elif [[ -n "$AWS_REGION" ]]; then
  AWS_REGION="$AWS_REGION"
else
  AWS_REGION="us-east-1"
fi

echo "Amplify target: appId=$APP_ID branch=$BRANCH_NAME" >&2

cd "$FRONTEND_DIR"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "Installing frontend dependencies..." >&2
  bun install --frozen-lockfile
fi

# Clean previous build artifacts
rm -rf dist

echo "Building frontend..." >&2
VITE_API_URL="$API_URL" \
VITE_USER_POOL_ID="$USER_POOL_ID" \
VITE_USER_POOL_CLIENT_ID="$USER_POOL_CLIENT_ID" \
VITE_AWS_REGION="$AWS_REGION" \
bun run build

if [[ ! -d dist ]]; then
  echo "Error: build did not produce frontend/dist." >&2
  exit 1
fi

ZIP_FILE="amplify-deploy-$(date +%Y%m%d-%H%M%S).zip"
# Store zip next to dist/ (not inside it) so it's never included in its own contents
ZIP_PATH="$FRONTEND_DIR/$ZIP_FILE"

echo "Packaging dist bundle..." >&2
case "$ZIP_METHOD" in
  zip)
    (cd dist && zip -r "$ZIP_PATH" .)
    ;;
  python3|py|python)
    "$ZIP_METHOD" - "$FRONTEND_DIR/dist" "$ZIP_PATH" <<'PYEOF'
import sys, os, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            arcname = os.path.relpath(full, src).replace(os.sep, '/')
            zf.write(full, arcname)
PYEOF
    ;;
  powershell)
    DIST_WIN="$(cygpath -w "$FRONTEND_DIR/dist")"
    ZIP_WIN="$(cygpath -w "$ZIP_PATH")"
    powershell.exe -NoProfile -Command "Add-Type -Assembly System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('$DIST_WIN', '$ZIP_WIN')"
    ;;
esac

# Verify the zip contains assets
if [[ "$ZIP_METHOD" == python3 || "$ZIP_METHOD" == py || "$ZIP_METHOD" == python ]]; then
  FILE_COUNT=$("$ZIP_METHOD" -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(len(z.namelist()))" "$ZIP_PATH")
else
  FILE_COUNT="?"
fi
echo "Zip created with $FILE_COUNT files: $ZIP_PATH" >&2
 

echo "Creating Amplify deployment..." >&2
read -r ZIP_UPLOAD_URL JOB_ID <<< "$(run_aws amplify create-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH_NAME" \
  --query '[zipUploadUrl,jobId]' \
  --output text)"

if [[ -z "$ZIP_UPLOAD_URL" || -z "$JOB_ID" || "$ZIP_UPLOAD_URL" == "None" || "$JOB_ID" == "None" ]]; then
  echo "Error: failed to create Amplify deployment job." >&2
  exit 1
fi

echo "Uploading artifact to Amplify..." >&2
curl -sSfL -X PUT \
  -H "Content-Type: application/zip" \
  --upload-file "$ZIP_PATH" \
  "$ZIP_UPLOAD_URL" >/dev/null

echo "Starting Amplify deployment job $JOB_ID..." >&2
if ! run_aws amplify start-deployment \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH_NAME" \
  --job-id "$JOB_ID" >/dev/null; then
    echo "Failed to start deployment" >&2
    rm -f "$ZIP_PATH"
    exit 1
fi

# Clean up zip file
rm -f "$ZIP_PATH"

AMPLIFY_URL="https://${BRANCH_NAME}.${APP_ID}.amplifyapp.com"

echo "Deployment started. Waiting for completion..." >&2
echo "Job ID: $JOB_ID" >&2

# Poll for deployment completion
MAX_WAIT=300  # 5 minutes
POLL_INTERVAL=10
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  STATUS="$(run_aws amplify get-job \
    --app-id "$APP_ID" \
    --branch-name "$BRANCH_NAME" \
    --job-id "$JOB_ID" \
    --query 'job.summary.status' \
    --output text 2>/dev/null || echo "UNKNOWN")"

  case "$STATUS" in
    SUCCEED)
      echo >&2
      echo "Deployment succeeded. Visit: $AMPLIFY_URL" >&2
      exit 0
      ;;
    FAILED|CANCELLED)
      echo >&2
      echo "Deployment $STATUS." >&2
      echo "Check logs: aws amplify get-job --app-id \"$APP_ID\" --branch-name \"$BRANCH_NAME\" --job-id \"$JOB_ID\"" >&2
      exit 1
      ;;
    PENDING|RUNNING|PROVISIONING|DEPLOYING)
      printf "." >&2
      sleep $POLL_INTERVAL
      ELAPSED=$((ELAPSED + POLL_INTERVAL))
      ;;
    *)
      echo >&2
      echo "Unknown status: $STATUS" >&2
      sleep $POLL_INTERVAL
      ELAPSED=$((ELAPSED + POLL_INTERVAL))
      ;;
  esac
done

echo >&2
echo "Timeout waiting for deployment after ${MAX_WAIT}s." >&2
echo "Check status manually: aws amplify get-job --app-id \"$APP_ID\" --branch-name \"$BRANCH_NAME\" --job-id \"$JOB_ID\" --query 'job.summary.status' --output text" >&2
exit 1
