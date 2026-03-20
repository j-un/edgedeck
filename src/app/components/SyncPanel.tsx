import { useState } from 'react'
import type { SyncEntry } from '../types.ts'

interface SyncPanelProps {
  entries: SyncEntry[]
  onUpdateEntry: (index: number, entry: SyncEntry) => void
  onToggleSelect: (index: number) => void
  onToggleSelectAll: () => void
  allSelected: boolean
}

export function SyncPanel({
  entries,
  onUpdateEntry,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
}: SyncPanelProps) {
  if (entries.length === 0) return null

  return (
    <div className="sync-results">
      <div className="sync-header">
        <label>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
          />
          Select all
        </label>
        <span>
          {entries.filter((e) => e.selected).length} / {entries.length} selected
        </span>
      </div>
      <table className="song-table">
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th>Track #</th>
            <th>Genre</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <SyncRow
              key={entry.r2_key}
              entry={entry}
              onChange={(updated) => onUpdateEntry(i, updated)}
              onToggle={() => onToggleSelect(i)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SyncRow({
  entry,
  onChange,
  onToggle,
}: {
  entry: SyncEntry
  onChange: (e: SyncEntry) => void
  onToggle: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  const updateField = (field: string, value: string) => {
    onChange({
      ...entry,
      metadata: {
        ...entry.metadata,
        [field]: value || null,
      },
    })
  }

  const editableCell = (field: string, value: string | null) => {
    const displayValue = value ?? ''
    if (editing === field) {
      return (
        <input
          type="text"
          defaultValue={displayValue}
          autoFocus
          onBlur={(e) => {
            updateField(field, e.target.value)
            setEditing(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateField(field, (e.target as HTMLInputElement).value)
              setEditing(null)
            }
            if (e.key === 'Escape') setEditing(null)
          }}
        />
      )
    }
    return (
      <span className="editable" onClick={() => setEditing(field)}>
        {displayValue || <em>--</em>}
      </span>
    )
  }

  return (
    <tr className={entry.selected ? '' : 'deselected'}>
      <td>
        <input type="checkbox" checked={entry.selected} onChange={onToggle} />
      </td>
      <td>{editableCell('title', entry.metadata.title)}</td>
      <td>{editableCell('artist', entry.metadata.artist)}</td>
      <td>{editableCell('album', entry.metadata.album)}</td>
      <td>
        {editableCell(
          'track_number',
          entry.metadata.track_number?.toString() ?? null,
        )}
      </td>
      <td>{editableCell('genre', entry.metadata.genre)}</td>
      <td className="file-path" title={entry.r2_key}>
        {entry.r2_key.split('/').pop()}
      </td>
    </tr>
  )
}
