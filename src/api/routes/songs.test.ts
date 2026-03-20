import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createSongRoutes } from './songs.ts'
import { InMemorySongRepository } from '../repositories/in-memory-song-repository.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('Song Routes', () => {
  let app: Hono
  let repo: InMemorySongRepository
  let bucket: InMemoryStorageBucket

  beforeEach(() => {
    repo = new InMemorySongRepository()
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs', createSongRoutes(repo, bucket))
  })

  const makeSong = (overrides = {}) => ({
    id: 'test-id-1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    track_number: 1,
    genre: 'Rock',
    duration: 180.5,
    r2_key: 'artist/album/01-song.mp3',
    mime_type: 'audio/mpeg',
    bpm: 120,
    source_hash: null,
    artwork_r2_key: null,
    ...overrides,
  })

  describe('GET /api/songs', () => {
    it('returns empty array when no songs', async () => {
      const res = await app.request('/api/songs')
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns songs list', async () => {
      await repo.insert(makeSong())
      const res = await app.request('/api/songs')
      expect(res.status).toBe(200)
      const data = (await res.json()) as Record<string, unknown>[]
      expect(data).toHaveLength(1)
      expect(data[0].title).toBe('Test Song')
    })

    it('filters by search query', async () => {
      await repo.insert(makeSong({ id: '1', title: 'Hello World' }))
      await repo.insert(
        makeSong({ id: '2', title: 'Goodbye', r2_key: 'b.mp3' }),
      )

      const res = await app.request('/api/songs?q=hello')
      const data = (await res.json()) as Record<string, unknown>[]
      expect(data).toHaveLength(1)
      expect(data[0].title).toBe('Hello World')
    })

    it('does not return soft-deleted songs', async () => {
      await repo.insert(makeSong())
      await repo.softDelete('test-id-1')
      const res = await app.request('/api/songs')
      expect(await res.json()).toEqual([])
    })
  })

  describe('POST /api/songs', () => {
    it('creates a song', async () => {
      const body = makeSong()
      const res = await app.request('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ id: 'test-id-1' })

      const songs = await repo.findAll()
      expect(songs).toHaveLength(1)
    })

    it('returns 400 when required fields missing', async () => {
      const res = await app.request('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No ID' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/songs/:id', () => {
    it('deletes song from D1 and R2', async () => {
      await bucket.put('artist/album/01-song.mp3', new Uint8Array([1, 2, 3]))
      await repo.insert(makeSong())

      const res = await app.request('/api/songs/test-id-1', {
        method: 'DELETE',
      })
      expect(res.status).toBe(200)

      // D1 から完全に削除されている
      const all = await repo.findAll()
      expect(all).toHaveLength(0)

      // R2 からも削除されている
      const obj = await bucket.get('artist/album/01-song.mp3')
      expect(obj).toBeNull()
    })

    it('returns 404 for non-existent song', async () => {
      const res = await app.request('/api/songs/nonexistent', {
        method: 'DELETE',
      })
      expect(res.status).toBe(404)
    })
  })
})
