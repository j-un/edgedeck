#!/bin/bash
set -euo pipefail

# Usage: ./scripts/cleanup.sh [api-base-url]
# Example:
#   ./scripts/cleanup.sh                              # local dev
#   ./scripts/cleanup.sh https://your-app.example.com # production (requires env vars)
#
# For production (Cloudflare Access):
#   export CF_ACCESS_CLIENT_ID="xxxxx.access"
#   export CF_ACCESS_CLIENT_SECRET="xxxxx"
#   ./scripts/cleanup.sh https://your-app.example.com
#
# Dependencies: curl, jq

API_BASE="${1:-http://localhost:8787}"

# Cloudflare Access auth headers
CURL_AUTH_OPTS=(-q)
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  CURL_AUTH_OPTS=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
  echo "Cloudflare Access auth: enabled"
elif [[ "$API_BASE" != http://localhost* ]]; then
  echo "WARNING: CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET are not set."
  echo "         Requests to ${API_BASE} will likely fail without Cloudflare Access credentials."
fi

# --- Phase 1: Detect orphaned data ---
echo "=== Phase 1: Detect orphaned data ==="

response=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs/cleanup") || {
  echo "ERROR: Failed to fetch cleanup status from ${API_BASE}/api/songs/cleanup"
  exit 1
}

orphaned_files=$(echo "$response" | jq -r '.orphaned_files | length')
orphaned_records=$(echo "$response" | jq -r '.orphaned_records | length')

echo "  Orphaned R2 files (no metadata):  ${orphaned_files}"
echo "  Orphaned DB records (no R2 file): ${orphaned_records}"

if [ "$orphaned_files" -eq 0 ] && [ "$orphaned_records" -eq 0 ]; then
  echo ""
  echo "Nothing to clean up."
  exit 0
fi

# Show details
if [ "$orphaned_files" -gt 0 ]; then
  echo ""
  echo "  Orphaned R2 files:"
  echo "$response" | jq -r '.orphaned_files[]' | while read -r key; do
    echo "    - ${key}"
  done
fi

if [ "$orphaned_records" -gt 0 ]; then
  echo ""
  echo "  Orphaned DB records:"
  echo "$response" | jq -r '.orphaned_records[]' | while read -r key; do
    echo "    - ${key}"
  done
fi

# --- Phase 2: Confirm and delete ---
echo ""
read -rp "Delete all orphaned data? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "=== Phase 2: Cleanup ==="

targets='[]'
if [ "$orphaned_files" -gt 0 ] && [ "$orphaned_records" -gt 0 ]; then
  targets='["files","records"]'
elif [ "$orphaned_files" -gt 0 ]; then
  targets='["files"]'
else
  targets='["records"]'
fi

result=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs/cleanup" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"targets\":${targets}}") || {
  echo "ERROR: Cleanup request failed"
  exit 1
}

deleted_files=$(echo "$result" | jq -r '.deleted_files')
deleted_records=$(echo "$result" | jq -r '.deleted_records')

# --- Summary ---
echo ""
echo "=== Done ==="
echo "  Deleted R2 files:  ${deleted_files}"
echo "  Deleted DB records: ${deleted_records}"
