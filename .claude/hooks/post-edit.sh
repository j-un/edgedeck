#!/bin/bash
set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if echo "$FILE_PATH" | grep -qE '^.*/terraform/.*\.tf$'; then
  cd "$(dirname "$0")/../../terraform"
  terraform fmt .
  terraform validate
elif echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  cd "$(dirname "$0")/../.."
  npm run format 2>&1
  npm run lint 2>&1
  npx tsc -b 2>&1
  npx vitest run 2>&1
elif echo "$FILE_PATH" | grep -qE '\.(js|json|yml|yaml|md|css|html)$'; then
  cd "$(dirname "$0")/../.."
  npx prettier --write "$FILE_PATH" 2>&1
fi
