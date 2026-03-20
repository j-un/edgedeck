import type { AnalyzeResult, Playlist, Song } from './types.ts'

export async function fetchSongs(query?: string): Promise<Song[]> {
  const url = query ? `/api/songs?q=${encodeURIComponent(query)}` : '/api/songs'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch songs')
  return res.json()
}

export async function createSong(
  song: Omit<Song, 'starred_at' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<void> {
  const res = await fetch('/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  })
  if (!res.ok) throw new Error('Failed to create song')
}

export async function deleteSong(id: string): Promise<void> {
  const res = await fetch(`/api/songs/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete song')
}

export async function fetchUnregistered(): Promise<string[]> {
  const res = await fetch('/api/songs/sync')
  if (!res.ok) throw new Error('Failed to fetch unregistered files')
  const data: { unregistered: string[] } = await res.json()
  return data.unregistered
}

export async function analyzeSong(r2Key: string): Promise<AnalyzeResult> {
  const res = await fetch('/api/songs/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ r2_key: r2Key }),
  })
  if (!res.ok) throw new Error(`Failed to analyze ${r2Key}`)
  return res.json()
}

export async function toggleStar(songId: string): Promise<Song> {
  const res = await fetch(`/api/songs/${songId}/star`, { method: 'PUT' })
  if (!res.ok) throw new Error('Failed to toggle star')
  return res.json()
}

export async function fetchPlaylists(): Promise<Playlist[]> {
  const res = await fetch('/api/playlists')
  if (!res.ok) throw new Error('Failed to fetch playlists')
  return res.json()
}

export async function createPlaylist(id: string, name: string): Promise<void> {
  const res = await fetch('/api/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name }),
  })
  if (!res.ok) throw new Error('Failed to create playlist')
}

export async function deletePlaylist(id: string): Promise<void> {
  const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete playlist')
}

export async function fetchPlaylistSongs(playlistId: string): Promise<Song[]> {
  const res = await fetch(`/api/playlists/${playlistId}/songs`)
  if (!res.ok) throw new Error('Failed to fetch playlist songs')
  return res.json()
}

export async function addSongToPlaylist(
  playlistId: string,
  songId: string,
): Promise<void> {
  const res = await fetch(`/api/playlists/${playlistId}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  })
  if (!res.ok) throw new Error('Failed to add song to playlist')
}

export async function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
): Promise<void> {
  const res = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to remove song from playlist')
}

export async function reorderPlaylistSongs(
  playlistId: string,
  songIds: string[],
): Promise<void> {
  const res = await fetch(`/api/playlists/${playlistId}/songs/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_ids: songIds }),
  })
  if (!res.ok) throw new Error('Failed to reorder playlist')
}
