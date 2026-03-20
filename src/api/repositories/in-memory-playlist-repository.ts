import type {
  Playlist,
  PlaylistRepository,
  PlaylistSong,
  Song,
  SongRepository,
} from '../types.ts'

export class InMemoryPlaylistRepository implements PlaylistRepository {
  private playlists: Playlist[] = []
  private playlistSongs: PlaylistSong[] = []
  private songRepo: SongRepository

  constructor(songRepo: SongRepository) {
    this.songRepo = songRepo
  }

  async findAll(): Promise<Playlist[]> {
    return [...this.playlists].sort((a, b) => a.name.localeCompare(b.name))
  }

  async findById(id: string): Promise<Playlist | null> {
    return this.playlists.find((p) => p.id === id) ?? null
  }

  async create(id: string, name: string, description?: string): Promise<void> {
    this.playlists.push({
      id,
      name,
      description: description ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async update(
    id: string,
    name: string,
    description?: string,
  ): Promise<boolean> {
    const playlist = this.playlists.find((p) => p.id === id)
    if (!playlist) return false
    playlist.name = name
    playlist.description = description ?? null
    playlist.updated_at = new Date().toISOString()
    return true
  }

  async remove(id: string): Promise<boolean> {
    const index = this.playlists.findIndex((p) => p.id === id)
    if (index === -1) return false
    this.playlists.splice(index, 1)
    this.playlistSongs = this.playlistSongs.filter(
      (ps) => ps.playlist_id !== id,
    )
    return true
  }

  async getSongs(playlistId: string): Promise<Song[]> {
    const entries = this.playlistSongs
      .filter((ps) => ps.playlist_id === playlistId)
      .sort((a, b) => a.position - b.position)
    const songs: Song[] = []
    for (const entry of entries) {
      const song = await this.songRepo.findById(entry.song_id)
      if (song) songs.push(song)
    }
    return songs
  }

  async addSong(playlistId: string, songId: string): Promise<void> {
    const exists = this.playlistSongs.find(
      (ps) => ps.playlist_id === playlistId && ps.song_id === songId,
    )
    if (exists) return
    const maxPos = this.playlistSongs
      .filter((ps) => ps.playlist_id === playlistId)
      .reduce((max, ps) => Math.max(max, ps.position), 0)
    this.playlistSongs.push({
      playlist_id: playlistId,
      song_id: songId,
      position: maxPos + 1,
      added_at: new Date().toISOString(),
    })
  }

  async removeSong(playlistId: string, songId: string): Promise<boolean> {
    const index = this.playlistSongs.findIndex(
      (ps) => ps.playlist_id === playlistId && ps.song_id === songId,
    )
    if (index === -1) return false
    this.playlistSongs.splice(index, 1)
    return true
  }

  async reorder(playlistId: string, songIds: string[]): Promise<void> {
    for (const ps of this.playlistSongs) {
      if (ps.playlist_id !== playlistId) continue
      const idx = songIds.indexOf(ps.song_id)
      if (idx !== -1) ps.position = idx + 1
    }
  }
}
