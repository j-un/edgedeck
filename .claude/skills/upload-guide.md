---
description: Guide for uploading music to EdgeDeck (R2, artwork, formats, gotchas)
---

# Upload Guide

## R2 Content-Type

Do NOT set `--content-type` when uploading to R2. MIME type is inferred from file extension by `metadata-parser.ts` `inferMimeType`. A wrong explicit type takes precedence and causes playback issues.

## ALAC (.m4a)

ALAC does not play in Chrome/Firefox. AAC .m4a works fine. Convert before upload:

```bash
ffmpeg -i input.m4a -c:a flac output.flac
```

The upload script (`scripts/upload.sh`) automatically converts ALAC/APE to AAC.

## Artwork Flow

`scripts/upload.sh` handles artwork independently from the analyze route:

1. Extracts artwork via `ffmpeg` from audio files
2. Uploads to R2 via `POST /api/songs/upload/artwork`
3. Passes `artwork_r2_key` when registering the song

The analyze route (`/api/analyze`) also extracts artwork from the first 256KB of audio data, but `upload.sh` bypasses it.

## Sync API

The Sync page is removed from the UI. The API (`GET /api/sync`) still exists for detecting unregistered R2 files.
