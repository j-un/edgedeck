import { useCallback, useEffect, useRef, useState } from 'react'
import type { Song } from '../types.ts'
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
}

const persisted = loadPersistedState()

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

  // Apply persisted volume on mount
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = persisted.volume
    pruneHistory()
  }, [])

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
    }
    const onDurationChange = () => setDuration(audio.duration || 0)
    const onEnded = () => {
      setIsPlaying(false)
      // 自動次曲再生
      const idx = playlistRef.current.findIndex((s) => s.id === currentSong?.id)
      if (idx >= 0 && idx < playlistRef.current.length - 1) {
        const nextSong = playlistRef.current[idx + 1]
        setCurrentSong(nextSong)
        audio.src = `/api/songs/${nextSong.id}/stream`
        audio
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {})
        addHistoryEntry(nextSong.id)
        saveQueue(
          playlistRef.current.map((s) => s.id),
          idx + 1,
        )
        persistCurrentTime(0)
      }
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => {
      setIsPlaying(false)
      // Save position immediately on pause
      persistCurrentTime(audio.currentTime)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [currentSong])

  const play = useCallback((song: Song) => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentSong(song)
    audio.src = `/api/songs/${song.id}/stream`
    audio.play().catch(() => {})
    addHistoryEntry(song.id)
    const idx = playlistRef.current.findIndex((s) => s.id === song.id)
    saveQueue(
      playlistRef.current.map((s) => s.id),
      idx >= 0 ? idx : 0,
    )
    persistCurrentTime(0)
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {})
  }, [])

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
    audioRef,
  }
}
