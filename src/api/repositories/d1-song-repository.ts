import type { Song, SongRepository } from '../types.ts'

export class D1SongRepository implements SongRepository {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async findAll(query?: string): Promise<Song[]> {
    if (query) {
      const pattern = `%${query}%`
      const result = await this.db
        .prepare(
          'SELECT * FROM songs WHERE deleted_at IS NULL AND (title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1) ORDER BY artist, album, track_number, title',
        )
        .bind(pattern)
        .all<Song>()
      return result.results
    }
    const result = await this.db
      .prepare(
        'SELECT * FROM songs WHERE deleted_at IS NULL ORDER BY artist, album, track_number, title',
      )
      .all<Song>()
    return result.results
  }

  async findById(id: string): Promise<Song | null> {
    const result = await this.db
      .prepare('SELECT * FROM songs WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Song>()
    return result ?? null
  }

  async insert(
    song: Omit<Song, 'starred_at' | 'created_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO songs (id, title, artist, album, track_number, genre, duration, r2_key, mime_type, bpm, source_hash, artwork_r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        song.id,
        song.title,
        song.artist,
        song.album,
        song.track_number,
        song.genre,
        song.duration,
        song.r2_key,
        song.mime_type,
        song.bpm,
        song.source_hash,
        song.artwork_r2_key,
      )
      .run()
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'UPDATE songs SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      )
      .bind(id)
      .run()
    return result.meta.changes > 0
  }

  async hardDelete(id: string): Promise<string | null> {
    const song = await this.db
      .prepare('SELECT r2_key FROM songs WHERE id = ?')
      .bind(id)
      .first<{ r2_key: string }>()
    if (!song) return null
    await this.db.prepare('DELETE FROM songs WHERE id = ?').bind(id).run()
    return song.r2_key
  }

  async hardDeleteByR2Keys(r2Keys: string[]): Promise<number> {
    if (r2Keys.length === 0) return 0
    let deleted = 0
    const chunkSize = 100
    for (let i = 0; i < r2Keys.length; i += chunkSize) {
      const chunk = r2Keys.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '?').join(',')
      const result = await this.db
        .prepare(`DELETE FROM songs WHERE r2_key IN (${placeholders})`)
        .bind(...chunk)
        .run()
      deleted += result.meta.changes
    }
    return deleted
  }

  async findExistingHashes(hashes: string[]): Promise<string[]> {
    if (hashes.length === 0) return []
    // D1 has a limit on bind parameters, so batch in chunks
    const chunkSize = 100
    const existing: string[] = []
    for (let i = 0; i < hashes.length; i += chunkSize) {
      const chunk = hashes.slice(i, i + chunkSize)
      const placeholders = chunk.map(() => '?').join(',')
      const result = await this.db
        .prepare(
          `SELECT source_hash FROM songs WHERE source_hash IN (${placeholders}) AND deleted_at IS NULL`,
        )
        .bind(...chunk)
        .all<{ source_hash: string }>()
      existing.push(...result.results.map((r) => r.source_hash))
    }
    return existing
  }

  async star(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'UPDATE songs SET starred_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL',
      )
      .bind(id)
      .run()
    return result.meta.changes > 0
  }

  async unstar(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'UPDATE songs SET starred_at = NULL WHERE id = ? AND deleted_at IS NULL',
      )
      .bind(id)
      .run()
    return result.meta.changes > 0
  }

  async getRegisteredR2Keys(): Promise<string[]> {
    const result = await this.db
      .prepare('SELECT r2_key FROM songs WHERE deleted_at IS NULL')
      .all<{ r2_key: string }>()
    return result.results.map((r) => r.r2_key)
  }
}
