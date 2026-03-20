import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createSyncRoutes, isAudioFile } from './sync.ts'
import { InMemorySongRepository } from '../repositories/in-memory-song-repository.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('isAudioFile', () => {
  it('accepts audio extensions', () => {
    expect(isAudioFile('song.mp3')).toBe(true)
    expect(isAudioFile('song.flac')).toBe(true)
    expect(isAudioFile('song.ogg')).toBe(true)
    expect(isAudioFile('song.m4a')).toBe(true)
    expect(isAudioFile('song.wav')).toBe(true)
    expect(isAudioFile('song.aac')).toBe(true)
    expect(isAudioFile('song.opus')).toBe(true)
  })

  it('rejects non-audio extensions', () => {
    expect(isAudioFile('cover.jpg')).toBe(false)
    expect(isAudioFile('notes.txt')).toBe(false)
    expect(isAudioFile('image.png')).toBe(false)
  })

  it('handles paths with directories', () => {
    expect(isAudioFile('Artist/Album/01-Track.flac')).toBe(true)
    expect(isAudioFile('Artist/Album/cover.jpg')).toBe(false)
  })
})

describe('Sync Routes', () => {
  let app: Hono
  let repo: InMemorySongRepository
  let bucket: InMemoryStorageBucket

  beforeEach(() => {
    repo = new InMemorySongRepository()
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs/sync', createSyncRoutes(repo, bucket))
  })

  it('returns unregistered audio files', async () => {
    bucket.put('artist/album/song.mp3', new Uint8Array([1, 2, 3]))
    bucket.put('artist/album/cover.jpg', new Uint8Array([4, 5, 6]))

    const res = await app.request('/api/songs/sync')
    expect(res.status).toBe(200)
    const data = (await res.json()) as Record<string, unknown>
    expect(data.unregistered).toEqual(['artist/album/song.mp3'])
  })

  it('excludes already registered files', async () => {
    bucket.put('artist/album/song.mp3', new Uint8Array([1]))
    await repo.insert({
      id: '1',
      title: 'Song',
      artist: null,
      album: null,
      track_number: null,
      genre: null,
      duration: null,
      r2_key: 'artist/album/song.mp3',
      mime_type: 'audio/mpeg',
      bpm: null,
      source_hash: null,
      artwork_r2_key: null,
    })

    const res = await app.request('/api/songs/sync')
    const data = (await res.json()) as Record<string, unknown>
    expect(data.unregistered).toEqual([])
  })

  it('returns empty when bucket is empty', async () => {
    const res = await app.request('/api/songs/sync')
    const data = (await res.json()) as Record<string, unknown>
    expect(data.unregistered).toEqual([])
  })
})
