import { describe, it, expect } from 'vitest'
import { inferMimeType, titleFromFilename } from './metadata-parser.ts'

describe('inferMimeType', () => {
  it('uses httpContentType when provided', () => {
    expect(inferMimeType('song.mp3', 'audio/mpeg')).toBe('audio/mpeg')
  })

  it('infers from extension when no httpContentType', () => {
    expect(inferMimeType('song.flac')).toBe('audio/flac')
    expect(inferMimeType('song.ogg')).toBe('audio/ogg')
    expect(inferMimeType('song.m4a')).toBe('audio/mp4')
    expect(inferMimeType('song.wav')).toBe('audio/wav')
    expect(inferMimeType('song.aac')).toBe('audio/aac')
    expect(inferMimeType('song.opus')).toBe('audio/opus')
    expect(inferMimeType('song.mp3')).toBe('audio/mpeg')
  })

  it('falls back to audio/mpeg for unknown extensions', () => {
    expect(inferMimeType('song.xyz')).toBe('audio/mpeg')
  })
})

describe('titleFromFilename', () => {
  it('extracts filename without extension', () => {
    expect(titleFromFilename('Artist/Album/01-Track.flac')).toBe('01-Track')
  })

  it('handles simple filenames', () => {
    expect(titleFromFilename('song.mp3')).toBe('song')
  })

  it('handles filenames with multiple dots', () => {
    expect(titleFromFilename('some.artist.song.mp3')).toBe('some.artist.song')
  })

  it('handles filenames without extension', () => {
    expect(titleFromFilename('noext')).toBe('noext')
  })
})
