import { useCallback, useEffect, useRef, useState } from 'react'
import type { Playlist, Song } from '../types.ts'

function formatDuration(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface SongListProps {
  songs: Song[]
  currentSongId: string | null
  onPlay: (song: Song) => void
  onDelete?: (song: Song) => void
  onDeleteMany?: (songs: Song[]) => void
  onStar?: (song: Song) => void
  onAddToPlaylist?: (song: Song, playlistId: string) => void
  onAddManyToPlaylist?: (songs: Song[], playlistId: string) => void
  playlists?: Playlist[]
  deleteLabel?: string
  onReorder?: (fromIndex: number, toIndex: number) => void
}

export function SongList({
  songs,
  currentSongId,
  onPlay,
  onDelete,
  onDeleteMany,
  onStar,
  onAddToPlaylist,
  onAddManyToPlaylist,
  playlists,
  deleteLabel = 'Delete',
  onReorder,
}: SongListProps) {
  const [menuSongId, setMenuSongId] = useState<string | null>(null)
  const [submenu, setSubmenu] = useState<'playlist' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const selectable = !!(onDeleteMany || onAddManyToPlaylist)

  // Close menu on outside click
  useEffect(() => {
    if (!menuSongId) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuSongId(null)
        setSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuSongId])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === songs.length ? new Set() : new Set(songs.map((s) => s.id)),
    )
  }, [songs])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const selectedSongs = songs.filter((s) => selected.has(s.id))

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
      // Required for Firefox
      e.dataTransfer.setData('text/plain', String(index))
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setOverIndex(index)
    },
    [],
  )

  const handleDragLeave = useCallback(() => {
    setOverIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLTableRowElement>, toIndex: number) => {
      e.preventDefault()
      if (dragIndex !== null && dragIndex !== toIndex && onReorder) {
        onReorder(dragIndex, toIndex)
      }
      setDragIndex(null)
      setOverIndex(null)
    },
    [dragIndex, onReorder],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setOverIndex(null)
  }, [])

  if (songs.length === 0) {
    return <p className="empty-message">No songs found.</p>
  }

  return (
    <div>
      {/* Bulk action bar */}
      {selectable && selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} selected</span>
          {onAddManyToPlaylist && playlists && playlists.length > 0 && (
            <BulkPlaylistMenu
              playlists={playlists}
              onSelect={(plId) => {
                onAddManyToPlaylist(selectedSongs, plId)
                clearSelection()
              }}
            />
          )}
          {onDeleteMany && (
            <button
              className="bulk-btn bulk-btn-danger"
              onClick={() => {
                onDeleteMany(selectedSongs)
                clearSelection()
              }}
            >
              {deleteLabel}
            </button>
          )}
          <button className="bulk-btn" onClick={clearSelection}>
            Cancel
          </button>
        </div>
      )}

      <table className="song-table">
        <thead>
          <tr>
            {onReorder && <th className="col-drag"></th>}
            {selectable && (
              <th className="col-checkbox">
                <input
                  type="checkbox"
                  checked={selected.size === songs.length && songs.length > 0}
                  onChange={toggleAll}
                />
              </th>
            )}
            <th className="col-play"></th>
            <th className="col-title">Title</th>
            <th className="col-artist">Artist</th>
            <th className="col-album">Album</th>
            <th className="col-duration">Duration</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song, index) => (
            <tr
              key={song.id}
              className={[
                song.id === currentSongId ? 'active' : '',
                selected.has(song.id) ? 'selected' : '',
                dragIndex === index ? 'dragging' : '',
                overIndex === index && dragIndex !== index
                  ? dragIndex !== null && dragIndex < index
                    ? 'drop-below'
                    : 'drop-above'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable={!!onReorder}
              onDragStart={
                onReorder ? (e) => handleDragStart(e, index) : undefined
              }
              onDragOver={
                onReorder ? (e) => handleDragOver(e, index) : undefined
              }
              onDragLeave={onReorder ? handleDragLeave : undefined}
              onDrop={onReorder ? (e) => handleDrop(e, index) : undefined}
              onDragEnd={onReorder ? handleDragEnd : undefined}
            >
              {onReorder && (
                <td className="col-drag">
                  <span className="drag-handle" title="Drag to reorder">
                    ⠿
                  </span>
                </td>
              )}
              {selectable && (
                <td className="col-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(song.id)}
                    onChange={() => toggleSelect(song.id)}
                  />
                </td>
              )}
              <td className="col-play">
                <button
                  className="play-btn"
                  onClick={() => onPlay(song)}
                  title="Play"
                >
                  ▶
                </button>
              </td>
              <td className="col-title">
                <span className="song-title-text">{song.title}</span>
                {song.artist && (
                  <span className="song-artist-inline">{song.artist}</span>
                )}
              </td>
              <td className="col-artist">{song.artist ?? ''}</td>
              <td className="col-album">{song.album ?? ''}</td>
              <td className="duration">{formatDuration(song.duration)}</td>
              <td className="song-actions">
                {onStar && (
                  <button
                    className={`star-btn${song.starred_at ? ' starred' : ''}`}
                    onClick={() => onStar(song)}
                    title={song.starred_at ? 'Unstar' : 'Star'}
                  >
                    {song.starred_at ? '\u2605' : '\u2606'}
                  </button>
                )}
                {(onDelete ||
                  (onAddToPlaylist && playlists && playlists.length > 0)) && (
                  <div
                    className="menu-wrapper"
                    ref={menuSongId === song.id ? menuRef : undefined}
                  >
                    <button
                      className="menu-btn"
                      onClick={() => {
                        setMenuSongId(menuSongId === song.id ? null : song.id)
                        setSubmenu(null)
                      }}
                      title="More"
                    >
                      &hellip;
                    </button>
                    {menuSongId === song.id && (
                      <div className="context-menu">
                        {onAddToPlaylist &&
                          playlists &&
                          playlists.length > 0 && (
                            <div
                              className="context-menu-item has-sub"
                              onMouseEnter={() => setSubmenu('playlist')}
                              onMouseLeave={() => setSubmenu(null)}
                            >
                              Add to playlist
                              {submenu === 'playlist' && (
                                <div className="context-submenu">
                                  {playlists.map((pl) => (
                                    <button
                                      key={pl.id}
                                      className="context-menu-item"
                                      onClick={() => {
                                        onAddToPlaylist(song, pl.id)
                                        setMenuSongId(null)
                                        setSubmenu(null)
                                      }}
                                    >
                                      {pl.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        {onDelete && (
                          <button
                            className="context-menu-item danger"
                            onClick={() => {
                              setMenuSongId(null)
                              onDelete(song)
                            }}
                          >
                            {deleteLabel}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BulkPlaylistMenu({
  playlists,
  onSelect,
}: {
  playlists: Playlist[]
  onSelect: (playlistId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="bulk-playlist-wrapper" ref={ref}>
      <button className="bulk-btn" onClick={() => setOpen(!open)}>
        Add to playlist
      </button>
      {open && (
        <div className="context-menu bulk-playlist-menu">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              className="context-menu-item"
              onClick={() => {
                onSelect(pl.id)
                setOpen(false)
              }}
            >
              {pl.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
