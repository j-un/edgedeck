import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createUploadRoutes } from './upload.ts'
import { InMemorySongRepository } from '../repositories/in-memory-song-repository.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('Upload Routes', () => {
  let app: Hono
  let repo: InMemorySongRepository
  let bucket: InMemoryStorageBucket

  beforeEach(() => {
    repo = new InMemorySongRepository()
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs/upload', createUploadRoutes(repo, bucket))
  })

  describe('POST /api/songs/upload/check-hashes', () => {
    it('returns empty array when no matches', async () => {
      const res = await app.request('/api/songs/upload/check-hashes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes: ['abc123'] }),
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ existing: [] })
    })

    it('returns matching hashes', async () => {
      await repo.insert({
        id: '1',
        title: 'Song',
        artist: null,
        album: null,
        track_number: null,
        genre: null,
        duration: null,
        r2_key: 'test.mp3',
        mime_type: 'audio/mpeg',
        bpm: null,
        source_hash: 'hash-abc',
        artwork_r2_key: null,
      })

      const res = await app.request('/api/songs/upload/check-hashes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes: ['hash-abc', 'hash-xyz'] }),
      })
      const data = (await res.json()) as Record<string, unknown>
      expect(data.existing).toEqual(['hash-abc'])
    })

    it('returns 400 when hashes not an array', async () => {
      const res = await app.request('/api/songs/upload/check-hashes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hashes: 'not-array' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/songs/upload', () => {
    it('uploads a file to R2 and returns r2_key', async () => {
      const formData = new FormData()
      const fileContent = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
      formData.append(
        'file',
        new File([fileContent], 'test.mp3', { type: 'audio/mpeg' }),
      )
      formData.append('original_filename', 'test.mp3')

      const res = await app.request('/api/songs/upload', {
        method: 'POST',
        body: formData,
      })
      expect(res.status).toBe(201)

      const data = (await res.json()) as Record<string, unknown>
      expect(data.r2_key).toMatch(/^[0-9a-f-]+\.mp3$/)
    })

    it('returns 400 when file is missing', async () => {
      const formData = new FormData()
      formData.append('original_filename', 'test.mp3')

      const res = await app.request('/api/songs/upload', {
        method: 'POST',
        body: formData,
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 when original_filename is missing', async () => {
      const formData = new FormData()
      formData.append('file', new File([new Uint8Array([0])], 'test.mp3'))

      const res = await app.request('/api/songs/upload', {
        method: 'POST',
        body: formData,
      })
      expect(res.status).toBe(400)
    })
  })
})
