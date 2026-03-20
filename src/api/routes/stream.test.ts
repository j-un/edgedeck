import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createStreamRoutes } from './stream.ts'
import { InMemorySongRepository } from '../repositories/in-memory-song-repository.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('Stream Routes', () => {
  let app: Hono
  let repo: InMemorySongRepository
  let bucket: InMemoryStorageBucket

  const songData = {
    id: 'song-1',
    title: 'Test',
    artist: null,
    album: null,
    track_number: null,
    genre: null,
    duration: null,
    r2_key: 'test/song.mp3',
    mime_type: 'audio/mpeg',
    bpm: null,
    source_hash: null,
    artwork_r2_key: null,
  }

  beforeEach(() => {
    repo = new InMemorySongRepository()
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs', createStreamRoutes(repo, bucket))
  })

  it('returns 404 for non-existent song', async () => {
    const res = await app.request('/api/songs/nonexistent/stream')
    expect(res.status).toBe(404)
  })

  it('streams full file without Range header', async () => {
    await repo.insert(songData)
    const data = new Uint8Array([1, 2, 3, 4, 5])
    bucket.put('test/song.mp3', data, 'audio/mpeg')

    const res = await app.request('/api/songs/song-1/stream')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Content-Length')).toBe('5')

    const body = new Uint8Array(await res.arrayBuffer())
    expect(body).toEqual(data)
  })

  it('returns 206 with Range header', async () => {
    await repo.insert(songData)
    const data = new Uint8Array([10, 20, 30, 40, 50])
    bucket.put('test/song.mp3', data, 'audio/mpeg')

    const res = await app.request('/api/songs/song-1/stream', {
      headers: { Range: 'bytes=1-3' },
    })
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 1-3/5')
    expect(res.headers.get('Content-Length')).toBe('3')

    const body = new Uint8Array(await res.arrayBuffer())
    expect(body).toEqual(new Uint8Array([20, 30, 40]))
  })

  it('returns 416 for invalid Range', async () => {
    await repo.insert(songData)
    bucket.put('test/song.mp3', new Uint8Array([1, 2, 3]), 'audio/mpeg')

    const res = await app.request('/api/songs/song-1/stream', {
      headers: { Range: 'invalid' },
    })
    expect(res.status).toBe(416)
  })

  it('returns 416 for out-of-bounds Range', async () => {
    await repo.insert(songData)
    bucket.put('test/song.mp3', new Uint8Array([1, 2, 3]), 'audio/mpeg')

    const res = await app.request('/api/songs/song-1/stream', {
      headers: { Range: 'bytes=10-20' },
    })
    expect(res.status).toBe(416)
  })
})
