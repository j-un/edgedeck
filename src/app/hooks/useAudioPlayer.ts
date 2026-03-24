import { useCallback, useEffect, useRef, useState } from 'react'
import type { Song } from '../types.ts'
import { isAuthExpired } from '../api.ts'
import {
  loadPersistedState,
  saveQueue,
  saveCurrentTime as persistCurrentTime,
  saveVolume as persistVolume,
  addHistoryEntry,
  pruneHistory,
} from './usePlaybackPersistence.ts'

export interface AudioPlayerState {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
}

export interface AudioPlayerControls {
  play: (song: Song) => void
  pause: () => void
  resume: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  next: () => void
  previous: () => void
  setPlaylist: (songs: Song[]) => void
  restoreFromSongs: (songs: Song[]) => void
  updateCurrentSong: (song: Song) => void
}

const persisted = loadPersistedState()

const MAX_RETRY = 3
const RETRY_DELAY_MS = 1500

export function useAudioPlayer(): AudioPlayerState &
  AudioPlayerControls & {
    audioRef: React.RefObject<HTMLAudioElement | null>
  } {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(persisted.volume)
  const playlistRef = useRef<Song[]>([])
  const saveTimeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoredRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextSongAudioRef = useRef<HTMLAudioElement | null>(null)

  /** Attempt to play the audio element with retry logic */
  const playWithRetry = useCallback(
    (audio: HTMLAudioElement, onSuccess?: () => void) => {
      retryCountRef.current = 0
      const attempt = () => {
        audio
          .play()
          .then(() => {
            retryCountRef.current = 0
            onSuccess?.()
          })
          .catch(async () => {
            if (await isAuthExpired()) {
              window.location.reload()
              return
            }
            retryCountRef.current++
            if (retryCountRef.current <= MAX_RETRY) {
              retryTimerRef.current = setTimeout(attempt, RETRY_DELAY_MS)
            }
          })
      }
      attempt()
    },
    [],
  )

  /** Preload the next song's stream into a hidden audio element */
  const preloadNextSong = useCallback((nextSong: Song) => {
    // Clean up previous preload
    if (nextSongAudioRef.current) {
      nextSongAudioRef.current.removeAttribute('src')
      nextSongAudioRef.current.load()
      nextSongAudioRef.current = null
    }
    const preloadAudio = new Audio()
    preloadAudio.preload = 'auto'
    preloadAudio.src = `/api/songs/${nextSong.id}/stream`
    nextSongAudioRef.current = preloadAudio
  }, [])

  // Apply persisted volume on mount
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = persisted.volume
    pruneHistory()

    return () => {
      // Cleanup retry timer and preload on unmount
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (nextSongAudioRef.current) {
        nextSongAudioRef.current.removeAttribute('src')
        nextSongAudioRef.current.load()
        nextSongAudioRef.current = null
      }
    }
  }, [])

  /** Advance to the next song in the playlist */
  const advanceToNext = useCallback(
    (audio: HTMLAudioElement, fromSongId: string | undefined) => {
      const idx = playlistRef.current.findIndex((s) => s.id === fromSongId)
      if (idx >= 0 && idx < playlistRef.current.length - 1) {
        const nextSong = playlistRef.current[idx + 1]
        setCurrentSong(nextSong)
        audio.src = `/api/songs/${nextSong.id}/stream`
        playWithRetry(audio, () => setIsPlaying(true))
        addHistoryEntry(nextSong.id)
        saveQueue(
          playlistRef.current.map((s) => s.id),
          idx + 1,
        )
        persistCurrentTime(0)

        // Preload the song after next
        if (idx + 2 < playlistRef.current.length) {
          preloadNextSong(playlistRef.current[idx + 2])
        }
      }
    },
    [playWithRetry, preloadNextSong],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      // Debounced save every 5 seconds
      if (!saveTimeRef.current) {
        saveTimeRef.current = setTimeout(() => {
          persistCurrentTime(audio.currentTime)
          saveTimeRef.current = null
        }, 5000)
      }

      // Preload next song when current is near the end (30 seconds remaining)
      if (audio.duration && audio.duration - audio.currentTime < 30) {
        if (!nextSongAudioRef.current) {
          const idx = playlistRef.current.findIndex(
            (s) => s.id === currentSong?.id,
          )
          if (idx >= 0 && idx < playlistRef.current.length - 1) {
            preloadNextSong(playlistRef.current[idx + 1])
          }
        }
      }
    }
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setIsPlaying(false)
      advanceToNext(audio, currentSong?.id)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => {
      setIsPlaying(false)
      // Save position immediately on pause
      persistCurrentTime(audio.currentTime)
    }

    // Check if playback position is near the end of the song
    const isNearEnd = () =>
      audio.duration > 0 && audio.currentTime >= audio.duration - 1

    // Error / stall recovery: retry current playback or advance to next
    const onError = async () => {
      if (!audio.src) return
      // If near the end of the song, treat as ended and advance
      if (isNearEnd()) {
        setIsPlaying(false)
        retryCountRef.current = 0
        advanceToNext(audio, currentSong?.id)
        return
      }
      // 認証期限切れならリトライせずログイン画面へ遷移
      if (await isAuthExpired()) {
        setIsPlaying(false)
        window.location.reload()
        return
      }
      retryCountRef.current++
      if (retryCountRef.current <= MAX_RETRY) {
        retryTimerRef.current = setTimeout(() => {
          const savedTime = audio.currentTime
          audio.load()
          audio.currentTime = savedTime
          playWithRetry(audio, () => setIsPlaying(true))
        }, RETRY_DELAY_MS)
      } else {
        // Exhausted retries on current song – skip to next
        setIsPlaying(false)
        retryCountRef.current = 0
        advanceToNext(audio, currentSong?.id)
      }
    }

    const onStalled = () => {
      // If near the end, treat as ended
      if (isNearEnd()) {
        setIsPlaying(false)
        advanceToNext(audio, currentSong?.id)
        return
      }
      // When stalled, wait a bit then check if still stalled
      retryTimerRef.current = setTimeout(() => {
        if (audio.paused && !audio.ended && isPlaying) {
          audio.load()
          audio.currentTime = currentTime
          playWithRetry(audio, () => setIsPlaying(true))
        }
      }, 3000)
    }

    const onWaiting = () => {
      // Monitor buffering: if stuck waiting too long, reload
      retryTimerRef.current = setTimeout(() => {
        if (audio.readyState < 3 && !audio.paused && !audio.ended) {
          const savedTime = audio.currentTime
          audio.load()
          audio.currentTime = savedTime
          playWithRetry(audio, () => setIsPlaying(true))
        }
      }, 10000)
    }

    // Recovery on screen wake / tab focus return
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!audio.src) return

      // If audio ended while backgrounded but ended event didn't advance
      if (audio.ended) {
        advanceToNext(audio, currentSong?.id)
        return
      }

      // If we should be playing but audio is paused (e.g. OS suspended it)
      if (isPlaying && audio.paused) {
        // If near the end, advance instead of retrying
        if (isNearEnd()) {
          advanceToNext(audio, currentSong?.id)
          return
        }
        retryCountRef.current = 0
        playWithRetry(audio, () => setIsPlaying(true))
        return
      }

      // If audio has an error, attempt reload
      if (audio.error) {
        retryCountRef.current = 0
        const savedTime = audio.currentTime
        audio.load()
        audio.currentTime = savedTime
        playWithRetry(audio, () => setIsPlaying(true))
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)
    audio.addEventListener('stalled', onStalled)
    audio.addEventListener('waiting', onWaiting)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('stalled', onStalled)
      audio.removeEventListener('waiting', onWaiting)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [
    currentSong,
    isPlaying,
    currentTime,
    advanceToNext,
    playWithRetry,
    preloadNextSong,
  ])

  const play = useCallback(
    (song: Song) => {
      const audio = audioRef.current
      if (!audio) return
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryCountRef.current = 0
      setCurrentSong(song)
      audio.src = `/api/songs/${song.id}/stream`
      playWithRetry(audio, () => setIsPlaying(true))
      addHistoryEntry(song.id)
      const idx = playlistRef.current.findIndex((s) => s.id === song.id)
      saveQueue(
        playlistRef.current.map((s) => s.id),
        idx >= 0 ? idx : 0,
      )
      persistCurrentTime(0)

      // Clear any existing preload since we just changed songs
      if (nextSongAudioRef.current) {
        nextSongAudioRef.current.removeAttribute('src')
        nextSongAudioRef.current.load()
        nextSongAudioRef.current = null
      }
    },
    [playWithRetry],
  )

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    playWithRetry(audio, () => setIsPlaying(true))
  }, [playWithRetry])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }, [isPlaying, pause, resume])

  const seek = useCallback((time: number) => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime = time
    }
  }, [])

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = v
      setVolumeState(v)
      persistVolume(v)
    }
  }, [])

  const next = useCallback(() => {
    const idx = playlistRef.current.findIndex((s) => s.id === currentSong?.id)
    if (idx >= 0 && idx < playlistRef.current.length - 1) {
      play(playlistRef.current[idx + 1])
    }
  }, [currentSong, play])

  const previous = useCallback(() => {
    const idx = playlistRef.current.findIndex((s) => s.id === currentSong?.id)
    if (idx > 0) {
      play(playlistRef.current[idx - 1])
    }
  }, [currentSong, play])

  const setPlaylist = useCallback((songs: Song[]) => {
    playlistRef.current = songs
  }, [])

  const restoreFromSongs = useCallback((songs: Song[]) => {
    if (restoredRef.current) return
    restoredRef.current = true

    const { queue, queueIndex, currentTime: savedTime } = persisted
    if (queue.length === 0) return

    const songMap = new Map(songs.map((s) => [s.id, s]))
    const resolved = queue
      .map((id) => songMap.get(id))
      .filter((s): s is Song => s != null)
    if (resolved.length === 0) return

    playlistRef.current = resolved
    const idx = Math.min(queueIndex, resolved.length - 1)
    const song = resolved[idx]
    setCurrentSong(song)

    // Prepare audio source but don't play
    const audio = audioRef.current
    if (audio) {
      audio.src = `/api/songs/${song.id}/stream`
      audio.preload = 'metadata'
      // Seek to saved position once metadata is loaded
      const onLoadedMetadata = () => {
        if (savedTime > 0 && savedTime < (audio.duration || Infinity)) {
          audio.currentTime = savedTime
        }
        audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      }
      audio.addEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [])

  const updateCurrentSong = useCallback((song: Song) => {
    setCurrentSong((prev) => (prev && prev.id === song.id ? song : prev))
  }, [])

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    play,
    pause,
    resume,
    togglePlay,
    seek,
    setVolume,
    next,
    previous,
    setPlaylist,
    restoreFromSongs,
    updateCurrentSong,
    audioRef,
  }
}
