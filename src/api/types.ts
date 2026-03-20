export type Env = {
  Bindings: {
    DB: D1Database
    BUCKET: R2Bucket
  }
}

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
  source_hash: string | null
  artwork_r2_key: string | null
  starred_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SongRepository {
  findAll(query?: string): Promise<Song[]>
  findById(id: string): Promise<Song | null>
  insert(
    song: Omit<Song, 'starred_at' | 'created_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<void>
  softDelete(id: string): Promise<boolean>
  hardDelete(id: string): Promise<string | null>
  getRegisteredR2Keys(): Promise<string[]>
  hardDeleteByR2Keys(r2Keys: string[]): Promise<number>
  findExistingHashes(hashes: string[]): Promise<string[]>
  star(id: string): Promise<boolean>
  unstar(id: string): Promise<boolean>
}

export interface Playlist {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface PlaylistSong {
  playlist_id: string
  song_id: string
  position: number
  added_at: string
}

export interface PlaylistRepository {
  findAll(): Promise<Playlist[]>
  findById(id: string): Promise<Playlist | null>
  create(id: string, name: string, description?: string): Promise<void>
  update(id: string, name: string, description?: string): Promise<boolean>
  remove(id: string): Promise<boolean>
  getSongs(playlistId: string): Promise<Song[]>
  addSong(playlistId: string, songId: string): Promise<void>
  removeSong(playlistId: string, songId: string): Promise<boolean>
  reorder(playlistId: string, songIds: string[]): Promise<void>
}

export interface StorageObject {
  body: ReadableStream
  size: number
  httpMetadata?: { contentType?: string }
}

export interface StorageListResult {
  objects: { key: string }[]
  truncated: boolean
  cursor?: string
}

export interface StorageBucket {
  get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<StorageObject | null>
  put(key: string, body: ArrayBuffer | ReadableStream): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { cursor?: string }): Promise<StorageListResult>
}
