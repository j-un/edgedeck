import type { Playlist, PlaylistRepository, Song } from '../types.ts'

export class D1PlaylistRepository implements PlaylistRepository {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async findAll(): Promise<Playlist[]> {
    const result = await this.db
      .prepare('SELECT * FROM playlists ORDER BY name')
      .all<Playlist>()
    return result.results
  }

  async findById(id: string): Promise<Playlist | null> {
    const result = await this.db
      .prepare('SELECT * FROM playlists WHERE id = ?')
      .bind(id)
      .first<Playlist>()
    return result ?? null
  }

  async create(id: string, name: string, description?: string): Promise<void> {
    await this.db
      .prepare('INSERT INTO playlists (id, name, description) VALUES (?, ?, ?)')
      .bind(id, name, description ?? null)
      .run()
  }

  async update(
    id: string,
    name: string,
    description?: string,
  ): Promise<boolean> {
    const result = await this.db
      .prepare(
        'UPDATE playlists SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      )
      .bind(name, description ?? null, id)
      .run()
    return result.meta.changes > 0
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db
      .prepare('DELETE FROM playlists WHERE id = ?')
      .bind(id)
      .run()
    return result.meta.changes > 0
  }

  async getSongs(playlistId: string): Promise<Song[]> {
    const result = await this.db
      .prepare(
        'SELECT s.* FROM songs s INNER JOIN playlist_songs ps ON s.id = ps.song_id WHERE ps.playlist_id = ? AND s.deleted_at IS NULL ORDER BY ps.position',
      )
      .bind(playlistId)
      .all<Song>()
    return result.results
  }

  async addSong(playlistId: string, songId: string): Promise<void> {
    const maxPos = await this.db
      .prepare(
        'SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_songs WHERE playlist_id = ?',
      )
      .bind(playlistId)
      .first<{ max_pos: number }>()
    const position = (maxPos?.max_pos ?? 0) + 1
    await this.db
      .prepare(
        'INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      )
      .bind(playlistId, songId, position)
      .run()
  }

  async removeSong(playlistId: string, songId: string): Promise<boolean> {
    const result = await this.db
      .prepare(
        'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      )
      .bind(playlistId, songId)
      .run()
    return result.meta.changes > 0
  }

  async reorder(playlistId: string, songIds: string[]): Promise<void> {
    const stmts = songIds.map((songId, i) =>
      this.db
        .prepare(
          'UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?',
        )
        .bind(i + 1, playlistId, songId),
    )
    await this.db.batch(stmts)
  }
}
