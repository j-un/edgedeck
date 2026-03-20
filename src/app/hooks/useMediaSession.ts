import { useEffect } from 'react'
import type { Song } from '../types.ts'

interface MediaSessionOptions {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrevious: () => void
  onSeek: (time: number) => void
}

export function useMediaSession({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onSeek,
}: MediaSessionOptions) {
  // Set metadata when song changes
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist ?? undefined,
      album: currentSong.album ?? undefined,
    })
  }, [currentSong])

  // Update playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
  }, [isPlaying])

  // Update position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return
    if (!duration || !isFinite(duration)) return

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      })
    } catch {
      // Some browsers throw if position > duration
    }
  }, [currentSong, currentTime, duration])

  // Register action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', onPlay],
      ['pause', onPause],
      ['previoustrack', onPrevious],
      ['nexttrack', onNext],
      [
        'seekto',
        (details) => {
          if (details.seekTime != null) {
            onSeek(details.seekTime)
          }
        },
      ],
    ]

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Action not supported
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Action not supported
        }
      }
    }
  }, [onPlay, onPause, onNext, onPrevious, onSeek])
}
