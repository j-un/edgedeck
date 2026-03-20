const KEYS = {
  queue: 'edgedeck:queue',
  queueIndex: 'edgedeck:queueIndex',
  currentTime: 'edgedeck:currentTime',
  volume: 'edgedeck:volume',
  history: 'edgedeck:history',
} as const

const MAX_HISTORY = 100
const HISTORY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface HistoryEntry {
  songId: string
  playedAt: string // ISO 8601
}

export interface PersistedState {
  queue: string[]
  queueIndex: number
  currentTime: number
  volume: number
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveQueue(songIds: string[], index: number): void {
  localStorage.setItem(KEYS.queue, JSON.stringify(songIds))
  localStorage.setItem(KEYS.queueIndex, String(index))
}

export function saveCurrentTime(time: number): void {
  localStorage.setItem(KEYS.currentTime, String(time))
}

export function saveVolume(volume: number): void {
  localStorage.setItem(KEYS.volume, String(volume))
}

export function addHistoryEntry(songId: string): void {
  const history = readJSON<HistoryEntry[]>(KEYS.history, [])
  // Skip if same as most recent
  if (history.length > 0 && history[0].songId === songId) return
  history.unshift({ songId, playedAt: new Date().toISOString() })
  // Trim to max
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  localStorage.setItem(KEYS.history, JSON.stringify(history))
}

export function loadPersistedState(): PersistedState {
  return {
    queue: readJSON<string[]>(KEYS.queue, []),
    queueIndex: Number(localStorage.getItem(KEYS.queueIndex) ?? 0),
    currentTime: Number(localStorage.getItem(KEYS.currentTime) ?? 0),
    volume: Number(localStorage.getItem(KEYS.volume) ?? 1),
  }
}

export function loadHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry[]>(KEYS.history, [])
}

export function pruneHistory(): void {
  const history = readJSON<HistoryEntry[]>(KEYS.history, [])
  const cutoff = Date.now() - HISTORY_MAX_AGE_MS
  const pruned = history
    .filter((e) => new Date(e.playedAt).getTime() > cutoff)
    .slice(0, MAX_HISTORY)
  localStorage.setItem(KEYS.history, JSON.stringify(pruned))
}
