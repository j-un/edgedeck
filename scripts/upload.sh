#!/bin/bash
set -euo pipefail

# Usage: ./scripts/upload.sh <directory> [api-base-url]
# Example:
#   ./scripts/upload.sh ~/Music                              # local dev
#   ./scripts/upload.sh ~/Music https://your-app.example.com # production (requires env vars)
#
# For production (Cloudflare Access):
#   export CF_ACCESS_CLIENT_ID="xxxxx.access"
#   export CF_ACCESS_CLIENT_SECRET="xxxxx"
#   ./scripts/upload.sh ~/Music https://your-app.example.com
#
# Dependencies: ffmpeg, ffprobe, curl, jq

if [ $# -lt 1 ]; then
  echo "Usage: $0 <directory> [api-base-url]"
  echo "  directory:    Directory containing music files"
  echo "  api-base-url: API base URL (default: http://localhost:8787)"
  echo ""
  echo "For production, set the following environment variables:"
  echo "  CF_ACCESS_CLIENT_ID      Cloudflare Access Service Token Client ID"
  echo "  CF_ACCESS_CLIENT_SECRET  Cloudflare Access Service Token Client Secret"
  exit 1
fi

MUSIC_DIR="$1"
API_BASE="${2:-http://localhost:8787}"

# Cloudflare Access auth headers (-q disables .curlrc, harmless no-op)
CURL_AUTH_OPTS=(-q)
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  CURL_AUTH_OPTS=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
  echo "Cloudflare Access auth: enabled"
fi

# Supported formats (uploaded as-is)
SUPPORTED_EXT="mp3|flac|ogg|m4a|wav|aac|wma|opus"

# ffmpeg conversion settings
AAC_BITRATE="256k"

# Temporary directory
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# --- Extract cover art with ffmpeg ---
# Outputs temp file path on success. Empty string if no cover art.
extract_artwork() {
  local file="$1"
  local out="$TMP_DIR/cover_$RANDOM.jpg"
  if ffmpeg -nostdin -i "$file" -an -vcodec copy -y "$out" -loglevel error 2>/dev/null; then
    # Verify image was actually written (treat 0 bytes as failure)
    if [ -s "$out" ]; then
      echo "$out"
      return
    fi
  fi
  rm -f "$out"
  echo ""
}

# --- Extract metadata with ffprobe ---
extract_metadata() {
  local file="$1"
  local filename="$2"

  local probe
  probe=$(ffprobe -v quiet -print_format json -show_format -show_streams "$file" 2>/dev/null) || true

  local title artist album track genre duration bpm

  title=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "title")) | .[0].value // empty' 2>/dev/null) || true
  artist=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "artist")) | .[0].value // empty' 2>/dev/null) || true
  album=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "album")) | .[0].value // empty' 2>/dev/null) || true
  track=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "track")) | .[0].value // empty' 2>/dev/null) || true
  genre=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "genre")) | .[0].value // empty' 2>/dev/null) || true
  duration=$(echo "$probe" | jq -r '.format.duration // empty' 2>/dev/null) || true
  bpm=$(echo "$probe" | jq -r '.format.tags // {} | to_entries | map(select(.key | ascii_downcase == "bpm" or (.key | ascii_downcase == "tbpm"))) | .[0].value // empty' 2>/dev/null) || true

  # Strip denominator from "1/10" track number format
  if [[ "$track" == */* ]]; then
    track="${track%%/*}"
  fi

  # Fall back to filename if title is empty
  if [ -z "$title" ]; then
    title="${filename%.*}"
  fi

  # Infer mime_type from extension
  local ext_lower
  ext_lower=$(echo "${filename##*.}" | tr '[:upper:]' '[:lower:]')
  local mime_type="audio/mpeg"
  case "$ext_lower" in
    mp3)  mime_type="audio/mpeg" ;;
    flac) mime_type="audio/flac" ;;
    ogg)  mime_type="audio/ogg" ;;
    m4a)  mime_type="audio/mp4" ;;
    wav)  mime_type="audio/wav" ;;
    aac)  mime_type="audio/aac" ;;
    wma)  mime_type="audio/x-ms-wma" ;;
    opus) mime_type="audio/opus" ;;
  esac

  # JSON output
  jq -n \
    --arg title "$title" \
    --arg artist "$artist" \
    --arg album "$album" \
    --arg track "$track" \
    --arg genre "$genre" \
    --arg duration "$duration" \
    --arg bpm "$bpm" \
    --arg mime_type "$mime_type" \
    '{
      title: $title,
      artist: (if $artist == "" then null else $artist end),
      album: (if $album == "" then null else $album end),
      track_number: (if $track == "" then null else ($track | tonumber) end),
      genre: (if $genre == "" then null else $genre end),
      duration: (if $duration == "" then null else ($duration | tonumber) end),
      bpm: (if $bpm == "" then null else ($bpm | tonumber | floor) end),
      mime_type: $mime_type
    }'
}

# --- Phase 1: Scan files and collect hashes ---
echo "=== Phase 1: File scan ==="

HASH_FILE="$TMP_DIR/hashes.txt"
FILE_LIST="$TMP_DIR/files.txt"

file_count=0
while IFS= read -r -d '' file; do
  ext="${file##*.}"
  ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

  # Check if it's a music file
  case "$ext_lower" in
    mp3|flac|ogg|m4a|wav|aac|wma|opus|alac|ape|wv|dsf|dff|aiff|aif)
      ;;
    *)
      continue
      ;;
  esac

  hash=$(shasum -a 256 "$file" | awk '{print $1}')
  echo "$hash" >> "$HASH_FILE"
  printf '%s\t%s\n' "$hash" "$file" >> "$FILE_LIST"
  file_count=$((file_count + 1))
done < <(find "$MUSIC_DIR" -type f -print0)

if [ "$file_count" -eq 0 ]; then
  echo "No music files found"
  exit 0
fi

echo "  Found ${file_count} music file(s)"

# --- Phase 2: Diff check ---
echo "=== Phase 2: Diff check ==="

hashes_json=$(awk '{printf "\"%s\",", $0}' "$HASH_FILE" | sed 's/,$//')
response=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs/upload/check-hashes" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "{\"hashes\":[${hashes_json}]}")

echo "$response" | grep -o '"[a-f0-9]\{64\}"' | tr -d '"' | sort > "$TMP_DIR/existing.txt" || true
existing_count=$(wc -l < "$TMP_DIR/existing.txt" | tr -d ' ')

echo "  ${existing_count} already registered (skipping)"

# --- Phase 3: Upload ---
echo "=== Phase 3: Upload ==="

uploaded=0
skipped=0
failed=0

while IFS=$'\t' read -r hash filepath; do
  # Skip if already registered
  if grep -qF "$hash" "$TMP_DIR/existing.txt" 2>/dev/null; then
    skipped=$((skipped + 1))
    continue
  fi

  filename=$(basename "$filepath")
  ext="${filename##*.}"
  ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

  # Determine if conversion is needed
  upload_file="$filepath"
  original_filename="$filename"
  needs_cleanup=false
  needs_convert=false

  if ! echo "$ext_lower" | grep -qE "^(${SUPPORTED_EXT})$"; then
    # Unsupported extension — needs conversion
    needs_convert=true
  elif [ "$ext_lower" = "m4a" ]; then
    # .m4a — check codec (ALAC can't play in browser, needs conversion)
    codec=$(ffprobe -v quiet -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$filepath" 2>/dev/null || true)
    if [ "$codec" = "alac" ]; then
      needs_convert=true
    fi
  fi

  if [ "$needs_convert" = true ]; then
    converted_name="${filename%.*}.m4a"
    converted_path="$TMP_DIR/$converted_name"
    echo "  Converting: $filename -> AAC"

    if ! ffmpeg -nostdin -i "$filepath" -c:a aac -b:a "$AAC_BITRATE" -y "$converted_path" \
      -loglevel error 2>&1; then
      echo "  ERROR: Conversion failed: $filename"
      failed=$((failed + 1))
      continue
    fi

    upload_file="$converted_path"
    original_filename="$converted_name"
    needs_cleanup=true
  fi

  # Extract metadata (from original file before conversion)
  echo "  Analyzing: $filename"
  metadata=$(extract_metadata "$filepath" "$original_filename")

  # Upload to R2
  echo "  Uploading: $filename"
  upload_response=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs/upload" \
    -X POST \
    -F "file=@${upload_file}" \
    -F "original_filename=${original_filename}" 2>&1) || {
    echo "  ERROR: Upload failed: $filename"
    failed=$((failed + 1))
    if [ "$needs_cleanup" = true ]; then rm -f "$converted_path"; fi
    continue
  }

  r2_key=$(echo "$upload_response" | jq -r '.r2_key')

  # Extract & upload cover art
  artwork_r2_key="null"
  artwork_path=$(extract_artwork "$filepath")
  if [ -n "$artwork_path" ]; then
    artwork_upload=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs/upload/artwork" \
      -X POST \
      -F "file=@${artwork_path}" 2>&1) || true
    if [ -n "$artwork_upload" ]; then
      raw_key=$(echo "$artwork_upload" | jq -r '.artwork_r2_key // empty')
      if [ -n "$raw_key" ]; then
        artwork_r2_key="\"${raw_key}\""
      fi
    fi
    rm -f "$artwork_path"
  fi

  # Register in D1
  register_body=$(echo "$metadata" | jq \
    --arg id "$(uuidgen | tr '[:upper:]' '[:lower:]')" \
    --arg r2_key "$r2_key" \
    --arg source_hash "$hash" \
    --argjson artwork_r2_key "$artwork_r2_key" \
    '. + {id: $id, r2_key: $r2_key, source_hash: $source_hash, artwork_r2_key: $artwork_r2_key}')

  register_response=$(curl -sf "${CURL_AUTH_OPTS[@]}" "${API_BASE}/api/songs" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$register_body" 2>&1) || {
    echo "  ERROR: Registration failed: $filename"
    failed=$((failed + 1))
    if [ "$needs_cleanup" = true ]; then rm -f "$converted_path"; fi
    continue
  }

  uploaded=$((uploaded + 1))

  if [ "$needs_cleanup" = true ]; then
    rm -f "$converted_path"
  fi
done < "$FILE_LIST"

# --- Summary ---
echo ""
echo "=== Done ==="
echo "  Uploaded: ${uploaded}"
echo "  Skipped (already registered): ${skipped}"
echo "  Failed: ${failed}"
