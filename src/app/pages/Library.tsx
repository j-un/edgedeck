import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchSongs,
  deleteSong,
  toggleStar,
  fetchPlaylists,
  createPlaylist,
  deletePlaylist,
  fetchPlaylistSongs,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
} from '../api.ts'
import { SearchBar } from '../components/SearchBar.tsx'
import { SongList } from '../components/SongList.tsx'
import { loadHistory } from '../hooks/usePlaybackPersistence.ts'
import type { Playlist, Song } from '../types.ts'
import { PlayAllGroup } from '../components/PlayAllGroup.tsx'

export type Tab = 'songs' | 'albums' | 'artists' | 'history' | 'playlists'

interface LibraryProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
  currentSongId: string | null
  onPlay: (song: Song) => void
  onPlayAll: (songs: Song[], startFrom: Song) => void
  onSongsLoaded: (songs: Song[]) => void
  shuffleEnabled: boolean
  onShuffleToggle: () => void
}

export function Library({
  tab,
  currentSongId,
  onPlay,
  onPlayAll,
  onSongsLoaded,
  shuffleEnabled,
  onShuffleToggle,
}: LibraryProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null)
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null)
  const [selectedArtistAlbum, setSelectedArtistAlbum] = useState<string | null>(
    null,
  )

  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  )
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([])
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const loadSongs = useCallback(
    async (q?: string) => {
      setLoading(true)
      try {
        const data = await fetchSongs(q)
        setSongs(data)
        onSongsLoaded(data)
      } finally {
        setLoading(false)
      }
    },
    [onSongsLoaded],
  )

  useEffect(() => {
    loadSongs(query || undefined)
  }, [query, loadSongs])

  const loadPlaylists = useCallback(async () => {
    const data = await fetchPlaylists()
    setPlaylists(data)
  }, [])

  useEffect(() => {
    loadPlaylists()
  }, [loadPlaylists])

  const loadPlaylistSongs = useCallback(async (playlistId: string) => {
    const data = await fetchPlaylistSongs(playlistId)
    setPlaylistSongs(data)
  }, [])

  useEffect(() => {
    if (selectedPlaylistId) {
      loadPlaylistSongs(selectedPlaylistId)
    }
  }, [selectedPlaylistId, loadPlaylistSongs])

  // Reset detail selections when tab changes
  useEffect(() => {
    setSelectedAlbum(null)
    setSelectedArtist(null)
    setSelectedArtistAlbum(null)
    setSelectedPlaylistId(null)
  }, [tab])

  const handleDelete = async (song: Song) => {
    if (!confirm(`Delete "${song.title}"?`)) return
    await deleteSong(song.id)
    loadSongs(query || undefined)
  }

  const handleDeleteMany = async (targets: Song[]) => {
    if (!confirm(`Delete ${targets.length} songs?`)) return
    await Promise.all(targets.map((s) => deleteSong(s.id)))
    loadSongs(query || undefined)
  }

  const handleStar = async (song: Song) => {
    const updated = await toggleStar(song.id)
    setSongs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    if (selectedPlaylistId) {
      setPlaylistSongs((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s)),
      )
    }
  }

  const handleAddToPlaylist = async (song: Song, playlistId: string) => {
    await addSongToPlaylist(playlistId, song.id)
    if (selectedPlaylistId === playlistId) {
      loadPlaylistSongs(playlistId)
    }
  }

  const handleAddManyToPlaylist = async (
    targets: Song[],
    playlistId: string,
  ) => {
    await Promise.all(targets.map((s) => addSongToPlaylist(playlistId, s.id)))
    if (selectedPlaylistId === playlistId) {
      loadPlaylistSongs(playlistId)
    }
  }

  const handleRemoveFromPlaylist = async (song: Song) => {
    if (!selectedPlaylistId) return
    await removeSongFromPlaylist(selectedPlaylistId, song.id)
    loadPlaylistSongs(selectedPlaylistId)
  }

  const handleRemoveManyFromPlaylist = async (targets: Song[]) => {
    if (!selectedPlaylistId) return
    if (!confirm(`Remove ${targets.length} songs from playlist?`)) return
    await Promise.all(
      targets.map((s) => removeSongFromPlaylist(selectedPlaylistId, s.id)),
    )
    loadPlaylistSongs(selectedPlaylistId)
  }

  const handleReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!selectedPlaylistId || selectedPlaylistId === 'starred') return
      const reordered = [...playlistSongs]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, moved)
      setPlaylistSongs(reordered)
      await reorderPlaylistSongs(
        selectedPlaylistId,
        reordered.map((s) => s.id),
      )
    },
    [selectedPlaylistId, playlistSongs],
  )

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim()
    if (!name) return
    const id = crypto.randomUUID()
    await createPlaylist(id, name)
    setNewPlaylistName('')
    loadPlaylists()
  }

  const handleDeletePlaylist = async (playlist: Playlist) => {
    if (!confirm(`Delete playlist "${playlist.name}"?`)) return
    await deletePlaylist(playlist.id)
    if (selectedPlaylistId === playlist.id) {
      setSelectedPlaylistId(null)
      setPlaylistSongs([])
    }
    loadPlaylists()
  }

  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    setSelectedAlbum(null)
    setSelectedArtist(null)
    setSelectedArtistAlbum(null)
  }, [])

  // Albums grouped
  const albums = useMemo(() => {
    const map = new Map<string, Song[]>()
    for (const song of songs) {
      const key = song.album || '(No Album)'
      const list = map.get(key) || []
      list.push(song)
      map.set(key, list)
    }
    return Array.from(map.entries())
      .map(([name, tracks]) => {
        const artworkKey =
          tracks.find((t) => t.artwork_r2_key)?.artwork_r2_key ?? null
        return {
          name,
          artist: tracks[0].artist || '(Unknown)',
          trackCount: tracks.length,
          tracks,
          artworkKey,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [songs])

  // Artists grouped
  const artists = useMemo(() => {
    const map = new Map<string, Song[]>()
    for (const song of songs) {
      const key = song.artist || '(Unknown Artist)'
      const list = map.get(key) || []
      list.push(song)
      map.set(key, list)
    }
    return Array.from(map.entries())
      .map(([name, tracks]) => ({
        name,
        albumCount: new Set(tracks.map((t) => t.album || '(No Album)')).size,
        trackCount: tracks.length,
        tracks,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [songs])

  // Starred songs (virtual playlist)
  const starredSongs = useMemo(() => {
    return songs.filter((s) => s.starred_at !== null)
  }, [songs])

  // Filtered songs for detail view
  const albumSongs = useMemo(() => {
    if (selectedAlbum === null) return []
    return songs.filter((s) => (s.album || '(No Album)') === selectedAlbum)
  }, [songs, selectedAlbum])

  const artistSongs = useMemo(() => {
    if (selectedArtist === null) return []
    return songs.filter(
      (s) => (s.artist || '(Unknown Artist)') === selectedArtist,
    )
  }, [songs, selectedArtist])

  const artistAlbums = useMemo(() => {
    const map = new Map<string, Song[]>()
    for (const song of artistSongs) {
      const key = song.album || '(No Album)'
      const list = map.get(key) || []
      list.push(song)
      map.set(key, list)
    }
    return Array.from(map.entries())
      .map(([name, tracks]) => {
        const artworkKey =
          tracks.find((t) => t.artwork_r2_key)?.artwork_r2_key ?? null
        return { name, trackCount: tracks.length, tracks, artworkKey }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [artistSongs])

  const artistAlbumSongs = useMemo(() => {
    if (selectedArtistAlbum === null) return []
    return artistSongs.filter(
      (s) => (s.album || '(No Album)') === selectedArtistAlbum,
    )
  }, [artistSongs, selectedArtistAlbum])

  // History: resolve song IDs to Song objects
  const historySongs = useMemo(() => {
    if (tab !== 'history') return []
    const entries = loadHistory()
    const songMap = new Map(songs.map((s) => [s.id, s]))
    return entries
      .map((e) => songMap.get(e.songId))
      .filter((s): s is Song => s != null)
  }, [songs, tab])

  const handlePlaySong = useCallback(
    (song: Song) => {
      if (tab === 'albums' && selectedAlbum !== null) {
        onPlayAll(albumSongs, song)
      } else if (
        tab === 'artists' &&
        selectedArtist !== null &&
        selectedArtistAlbum !== null
      ) {
        onPlayAll(artistAlbumSongs, song)
      } else if (tab === 'playlists' && selectedPlaylistId === 'starred') {
        onPlayAll(starredSongs, song)
      } else if (tab === 'playlists' && selectedPlaylistId !== null) {
        onPlayAll(playlistSongs, song)
      } else {
        onPlay(song)
      }
    },
    [
      tab,
      selectedAlbum,
      selectedArtist,
      selectedArtistAlbum,
      selectedPlaylistId,
      albumSongs,
      artistAlbumSongs,
      starredSongs,
      playlistSongs,
      onPlay,
      onPlayAll,
    ],
  )

  const selectedPlaylist =
    playlists.find((p) => p.id === selectedPlaylistId) ?? null

  return (
    <>
      <SearchBar onSearch={handleSearch} placeholder="Search..." />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Songs tab */}
          {tab === 'songs' && (
            <>
              {songs.length > 0 && (
                <div className="songs-play-all-bar">
                  <PlayAllGroup
                    songs={songs}
                    shuffleEnabled={shuffleEnabled}
                    onPlayAll={onPlayAll}
                    onShuffleToggle={onShuffleToggle}
                  />
                </div>
              )}
              <SongList
                songs={songs}
                currentSongId={currentSongId}
                onPlay={onPlay}
                onDelete={handleDelete}
                onDeleteMany={handleDeleteMany}
                onStar={handleStar}
                onAddToPlaylist={handleAddToPlaylist}
                onAddManyToPlaylist={handleAddManyToPlaylist}
                playlists={playlists}
              />
            </>
          )}

          {/* Albums tab */}
          {tab === 'albums' && selectedAlbum === null && (
            <div className="group-list">
              {albums.map((album) => (
                <button
                  key={album.name}
                  className="group-item"
                  onClick={() => setSelectedAlbum(album.name)}
                >
                  {album.artworkKey ? (
                    <img
                      className="album-artwork"
                      src={`/api/songs/artwork/${album.artworkKey.replace('artwork/', '')}`}
                      alt=""
                    />
                  ) : (
                    <span className="album-artwork-placeholder" />
                  )}
                  <span className="group-info">
                    <span className="group-name">{album.name}</span>
                    <span className="group-meta">
                      {album.artist} &middot; {album.trackCount} tracks
                    </span>
                  </span>
                </button>
              ))}
              {albums.length === 0 && (
                <p className="empty-message">No albums found.</p>
              )}
            </div>
          )}
          {tab === 'albums' && selectedAlbum !== null && (
            <div className="detail-view">
              <div className="detail-header">
                <button
                  className="back-btn"
                  onClick={() => setSelectedAlbum(null)}
                >
                  &larr; Albums
                </button>
                {(() => {
                  const artworkKey =
                    albumSongs.find((s) => s.artwork_r2_key)?.artwork_r2_key ??
                    null
                  const artist = albumSongs[0]?.artist || '(Unknown)'
                  return (
                    <>
                      {artworkKey ? (
                        <img
                          className="detail-artwork"
                          src={`/api/songs/artwork/${artworkKey.replace('artwork/', '')}`}
                          alt={selectedAlbum}
                        />
                      ) : (
                        <div className="detail-artwork-placeholder">♪</div>
                      )}
                      <div className="detail-info">
                        <h2 className="detail-title">{selectedAlbum}</h2>
                        <p className="detail-artist">{artist}</p>
                      </div>
                    </>
                  )
                })()}
                <PlayAllGroup
                  songs={albumSongs}
                  shuffleEnabled={shuffleEnabled}
                  onPlayAll={onPlayAll}
                  onShuffleToggle={onShuffleToggle}
                />
              </div>
              <SongList
                songs={albumSongs}
                currentSongId={currentSongId}
                onPlay={handlePlaySong}
                onDelete={handleDelete}
                onDeleteMany={handleDeleteMany}
                onStar={handleStar}
                onAddToPlaylist={handleAddToPlaylist}
                onAddManyToPlaylist={handleAddManyToPlaylist}
                playlists={playlists}
              />
            </div>
          )}

          {/* Artists tab */}
          {tab === 'artists' && selectedArtist === null && (
            <div className="group-list">
              {artists.map((artist) => (
                <button
                  key={artist.name}
                  className="group-item"
                  onClick={() => setSelectedArtist(artist.name)}
                >
                  <span className="group-name">{artist.name}</span>
                  <span className="group-meta">
                    {artist.albumCount} albums &middot; {artist.trackCount}{' '}
                    tracks
                  </span>
                </button>
              ))}
              {artists.length === 0 && (
                <p className="empty-message">No artists found.</p>
              )}
            </div>
          )}
          {tab === 'artists' &&
            selectedArtist !== null &&
            selectedArtistAlbum === null && (
              <div className="detail-view">
                <div className="detail-header">
                  <button
                    className="back-btn"
                    onClick={() => setSelectedArtist(null)}
                  >
                    &larr; Artists
                  </button>
                  <h2 className="detail-title">{selectedArtist}</h2>
                  <PlayAllGroup
                    songs={artistSongs}
                    shuffleEnabled={shuffleEnabled}
                    onPlayAll={onPlayAll}
                    onShuffleToggle={onShuffleToggle}
                  />
                </div>
                <div className="group-list">
                  {artistAlbums.map((album) => (
                    <button
                      key={album.name}
                      className="group-item"
                      onClick={() => setSelectedArtistAlbum(album.name)}
                    >
                      {album.artworkKey ? (
                        <img
                          className="album-artwork"
                          src={`/api/songs/artwork/${album.artworkKey.replace('artwork/', '')}`}
                          alt=""
                        />
                      ) : (
                        <span className="album-artwork-placeholder" />
                      )}
                      <span className="group-info">
                        <span className="group-name">{album.name}</span>
                        <span className="group-meta">
                          {album.trackCount} tracks
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          {tab === 'artists' &&
            selectedArtist !== null &&
            selectedArtistAlbum !== null && (
              <div className="detail-view">
                <div className="detail-header">
                  <button
                    className="back-btn"
                    onClick={() => setSelectedArtistAlbum(null)}
                  >
                    &larr; {selectedArtist}
                  </button>
                  {(() => {
                    const artworkKey =
                      artistAlbumSongs.find((s) => s.artwork_r2_key)
                        ?.artwork_r2_key ?? null
                    return (
                      <>
                        {artworkKey ? (
                          <img
                            className="detail-artwork"
                            src={`/api/songs/artwork/${artworkKey.replace('artwork/', '')}`}
                            alt={selectedArtistAlbum}
                          />
                        ) : (
                          <div className="detail-artwork-placeholder">♪</div>
                        )}
                        <div className="detail-info">
                          <h2 className="detail-title">
                            {selectedArtistAlbum}
                          </h2>
                          <p className="detail-artist">{selectedArtist}</p>
                        </div>
                      </>
                    )
                  })()}
                  <PlayAllGroup
                    songs={artistAlbumSongs}
                    shuffleEnabled={shuffleEnabled}
                    onPlayAll={onPlayAll}
                    onShuffleToggle={onShuffleToggle}
                  />
                </div>
                <SongList
                  songs={artistAlbumSongs}
                  currentSongId={currentSongId}
                  onPlay={handlePlaySong}
                  onDelete={handleDelete}
                  onDeleteMany={handleDeleteMany}
                  onStar={handleStar}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddManyToPlaylist={handleAddManyToPlaylist}
                  playlists={playlists}
                />
              </div>
            )}

          {/* Playlists tab */}
          {tab === 'playlists' && selectedPlaylistId === null && (
            <div className="playlists-view">
              <div className="create-playlist">
                <input
                  type="text"
                  className="create-playlist-input"
                  placeholder="New playlist name..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreatePlaylist()
                  }}
                />
                <button
                  className="btn-primary"
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                >
                  Create
                </button>
              </div>
              <div className="group-list">
                <button
                  className="group-item"
                  onClick={() => setSelectedPlaylistId('starred')}
                >
                  <span className="group-name">{'\u2605'} Starred</span>
                  <span className="group-meta">
                    {starredSongs.length} tracks
                  </span>
                </button>
                {playlists.map((pl) => (
                  <div key={pl.id} className="group-item-row">
                    <button
                      className="group-item"
                      onClick={() => setSelectedPlaylistId(pl.id)}
                    >
                      <span className="group-name">{pl.name}</span>
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeletePlaylist(pl)}
                      title="Delete playlist"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === 'playlists' && selectedPlaylistId === 'starred' && (
            <div className="detail-view">
              <div className="detail-header">
                <button
                  className="back-btn"
                  onClick={() => setSelectedPlaylistId(null)}
                >
                  &larr; Playlists
                </button>
                <h2 className="detail-title">{'\u2605'} Starred</h2>
                <PlayAllGroup
                  songs={starredSongs}
                  shuffleEnabled={shuffleEnabled}
                  onPlayAll={onPlayAll}
                  onShuffleToggle={onShuffleToggle}
                />
              </div>
              <SongList
                songs={starredSongs}
                currentSongId={currentSongId}
                onPlay={handlePlaySong}
                onStar={handleStar}
              />
            </div>
          )}
          {tab === 'playlists' &&
            selectedPlaylistId !== null &&
            selectedPlaylistId !== 'starred' && (
              <div className="detail-view">
                <div className="detail-header">
                  <button
                    className="back-btn"
                    onClick={() => setSelectedPlaylistId(null)}
                  >
                    &larr; Playlists
                  </button>
                  <h2 className="detail-title">
                    {selectedPlaylist?.name ?? ''}
                  </h2>
                  <PlayAllGroup
                    songs={playlistSongs}
                    shuffleEnabled={shuffleEnabled}
                    onPlayAll={onPlayAll}
                    onShuffleToggle={onShuffleToggle}
                  />
                </div>
                <SongList
                  songs={playlistSongs}
                  currentSongId={currentSongId}
                  onPlay={handlePlaySong}
                  onDelete={handleRemoveFromPlaylist}
                  onDeleteMany={handleRemoveManyFromPlaylist}
                  onStar={handleStar}
                  deleteLabel="Remove from playlist"
                  onReorder={handleReorder}
                />
              </div>
            )}

          {/* History tab */}
          {tab === 'history' && (
            <SongList
              songs={historySongs}
              currentSongId={currentSongId}
              onPlay={onPlay}
              onDelete={handleDelete}
              onStar={handleStar}
            />
          )}
        </>
      )}
    </>
  )
}
