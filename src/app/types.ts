export interface Song {
  id: string
  title: string
  artist: string | null
  album: string | null
  track_number: number | null
  genre: string | null
  duration: number | null
  r2_key: string
  mime_type: string
  bpm: number | null
  artwork_r2_key: string | null
  starred_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Playlist {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
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
}

export interface AnalyzeResult {
  r2_key: string
  artwork_r2_key: string | null
  metadata: ParsedMetadata
}

export interface SyncEntry {
  r2_key: string
  artwork_r2_key: string | null
  metadata: ParsedMetadata
  selected: boolean
}
