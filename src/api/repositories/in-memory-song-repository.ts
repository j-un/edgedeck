import type { Song, SongRepository } from '../types.ts'

export class InMemorySongRepository implements SongRepository {
  private songs: Song[] = []

  async findAll(query?: string): Promise<Song[]> {
    let results = this.songs.filter((s) => s.deleted_at === null)
    if (query) {
      const q = query.toLowerCase()
      results = results.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.artist?.toLowerCase().includes(q) ?? false) ||
          (s.album?.toLowerCase().includes(q) ?? false),
      )
    }
    return results
  }

  async findById(id: string): Promise<Song | null> {
    return this.songs.find((s) => s.id === id && s.deleted_at === null) ?? null
  }

  async insert(
    song: Omit<Song, 'starred_at' | 'created_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<void> {
    this.songs.push({
      ...song,
      artwork_r2_key: song.artwork_r2_key ?? null,
      starred_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
  }

  async softDelete(id: string): Promise<boolean> {
    const song = this.songs.find((s) => s.id === id && s.deleted_at === null)
    if (!song) return false
    song.deleted_at = new Date().toISOString()
    return true
  }

  async hardDelete(id: string): Promise<string | null> {
    const index = this.songs.findIndex((s) => s.id === id)
    if (index === -1) return null
    const r2Key = this.songs[index].r2_key
    this.songs.splice(index, 1)
    return r2Key
  }

  async hardDeleteByR2Keys(r2Keys: string[]): Promise<number> {
    const before = this.songs.length
    this.songs = this.songs.filter((s) => !r2Keys.includes(s.r2_key))
    return before - this.songs.length
  }

  async getRegisteredR2Keys(): Promise<string[]> {
    return this.songs.filter((s) => s.deleted_at === null).map((s) => s.r2_key)
  }

  async star(id: string): Promise<boolean> {
    const song = this.songs.find((s) => s.id === id && s.deleted_at === null)
    if (!song) return false
    song.starred_at = new Date().toISOString()
    return true
  }

  async unstar(id: string): Promise<boolean> {
    const song = this.songs.find((s) => s.id === id && s.deleted_at === null)
    if (!song) return false
    song.starred_at = null
    return true
  }

  async findExistingHashes(hashes: string[]): Promise<string[]> {
    return this.songs
      .filter(
        (s) =>
          s.deleted_at === null &&
          s.source_hash !== null &&
          hashes.includes(s.source_hash),
      )
      .map((s) => s.source_hash!)
  }
}
