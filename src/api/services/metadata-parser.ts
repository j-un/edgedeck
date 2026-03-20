import { parseBuffer } from 'music-metadata'

const MIME_TYPE_MAP: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.opus': 'audio/opus',
}

export interface ArtworkData {
  data: Uint8Array
  format: string // e.g. "image/jpeg", "image/png"
}

export interface ParsedMetadata {
  title: string
  artist: string | null
  album: string | null
  track_number: number | null
  genre: string | null
  duration: number | null
  bpm: number | null
  mime_type: string
  artwork: ArtworkData | null
}

export function inferMimeType(r2Key: string, httpContentType?: string): string {
  if (httpContentType) return httpContentType
  const ext = r2Key.substring(r2Key.lastIndexOf('.')).toLowerCase()
  return MIME_TYPE_MAP[ext] ?? 'audio/mpeg'
}

export function titleFromFilename(r2Key: string): string {
  const filename = r2Key.substring(r2Key.lastIndexOf('/') + 1)
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.substring(0, dotIndex) : filename
}

export async function parseMetadata(
  buffer: Uint8Array,
  r2Key: string,
  httpContentType?: string,
): Promise<ParsedMetadata> {
  const mimeType = inferMimeType(r2Key, httpContentType)

  try {
    const metadata = await parseBuffer(buffer, { mimeType })
    const { common, format } = metadata

    let artwork: ArtworkData | null = null
    const pic = common.picture?.[0]
    if (pic && pic.data.length > 0) {
      artwork = {
        data: new Uint8Array(pic.data),
        format: pic.format ?? 'image/jpeg',
      }
    }

    return {
      title: common.title ?? titleFromFilename(r2Key),
      artist: common.artist ?? null,
      album: common.album ?? null,
      track_number: common.track?.no ?? null,
      genre: common.genre?.[0] ?? null,
      duration: format.duration ?? null,
      bpm: common.bpm ?? null,
      mime_type: mimeType,
      artwork,
    }
  } catch {
    // タグ解析に失敗した場合、ファイル名ベースのフォールバック
    return {
      title: titleFromFilename(r2Key),
      artist: null,
      album: null,
      track_number: null,
      genre: null,
      duration: null,
      bpm: null,
      mime_type: mimeType,
      artwork: null,
    }
  }
}
