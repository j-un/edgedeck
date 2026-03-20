import { useState } from 'react'
import { fetchUnregistered, analyzeSong, createSong } from '../api.ts'
import { SyncPanel } from '../components/SyncPanel.tsx'
import type { SyncEntry } from '../types.ts'

const CONCURRENCY = 3

export function Sync() {
  const [entries, setEntries] = useState<SyncEntry[]>([])
  const [phase, setPhase] = useState<
    'idle' | 'scanning' | 'analyzing' | 'ready' | 'registering' | 'done'
  >('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState({ success: 0, failed: 0 })

  const handleSync = async () => {
    setPhase('scanning')
    const unregistered = await fetchUnregistered()

    if (unregistered.length === 0) {
      setPhase('idle')
      alert('No new files found.')
      return
    }

    setPhase('analyzing')
    setProgress({ current: 0, total: unregistered.length })

    const analyzed: SyncEntry[] = []
    let completed = 0

    // 並列度を制限して解析
    const queue = [...unregistered]
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const r2Key = queue.shift()
        if (!r2Key) break
        try {
          const res = await analyzeSong(r2Key)
          analyzed.push({
            r2_key: res.r2_key,
            artwork_r2_key: res.artwork_r2_key,
            metadata: res.metadata,
            selected: true,
          })
        } catch {
          analyzed.push({
            r2_key: r2Key,
            artwork_r2_key: null,
            metadata: {
              title:
                r2Key
                  .split('/')
                  .pop()
                  ?.replace(/\.[^.]+$/, '') ?? r2Key,
              artist: null,
              album: null,
              track_number: null,
              genre: null,
              duration: null,
              bpm: null,
              mime_type: 'audio/mpeg',
            },
            selected: true,
          })
        }
        completed++
        setProgress({ current: completed, total: unregistered.length })
      }
    })

    await Promise.all(workers)
    setEntries(analyzed)
    setPhase('ready')
  }

  const handleRegister = async () => {
    const selected = entries.filter((e) => e.selected)
    if (selected.length === 0) return

    setPhase('registering')
    setProgress({ current: 0, total: selected.length })

    let success = 0
    let failed = 0

    for (const entry of selected) {
      try {
        await createSong({
          id: crypto.randomUUID(),
          title: entry.metadata.title,
          artist: entry.metadata.artist,
          album: entry.metadata.album,
          track_number: entry.metadata.track_number,
          genre: entry.metadata.genre,
          duration: entry.metadata.duration,
          r2_key: entry.r2_key,
          mime_type: entry.metadata.mime_type,
          bpm: entry.metadata.bpm,
          artwork_r2_key: entry.artwork_r2_key,
        })
        success++
      } catch {
        failed++
      }
      setProgress({ current: success + failed, total: selected.length })
    }

    setResult({ success, failed })
    setPhase('done')
  }

  const updateEntry = (index: number, entry: SyncEntry) => {
    setEntries((prev) => {
      const next = [...prev]
      next[index] = entry
      return next
    })
  }

  const toggleSelect = (index: number) => {
    setEntries((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], selected: !next[index].selected }
      return next
    })
  }

  const toggleSelectAll = () => {
    const allSelected = entries.every((e) => e.selected)
    setEntries((prev) => prev.map((e) => ({ ...e, selected: !allSelected })))
  }

  const allSelected = entries.length > 0 && entries.every((e) => e.selected)

  return (
    <div className="sync-page">
      <div className="sync-actions">
        {(phase === 'idle' || phase === 'done') && (
          <button className="btn-primary" onClick={handleSync}>
            Sync with R2
          </button>
        )}
        {phase === 'ready' && (
          <button
            className="btn-primary"
            onClick={handleRegister}
            disabled={entries.filter((e) => e.selected).length === 0}
          >
            Register {entries.filter((e) => e.selected).length} songs
          </button>
        )}
      </div>

      {(phase === 'analyzing' || phase === 'registering') && (
        <div className="progress-section">
          <p>
            {phase === 'analyzing' ? 'Analyzing' : 'Registering'}...{' '}
            {progress.current} / {progress.total}
          </p>
          <progress value={progress.current} max={progress.total} />
        </div>
      )}

      {phase === 'scanning' && <p>Scanning R2 bucket...</p>}

      {phase === 'done' && (
        <div className="result-summary">
          <p>
            Done: {result.success} registered
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
        </div>
      )}

      {(phase === 'ready' || phase === 'done') && (
        <SyncPanel
          entries={entries}
          onUpdateEntry={updateEntry}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
        />
      )}
    </div>
  )
}
