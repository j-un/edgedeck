import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createCleanupRoutes } from './cleanup.ts'
import { InMemorySongRepository } from '../repositories/in-memory-song-repository.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('Cleanup Routes', () => {
  let app: Hono
  let repo: InMemorySongRepository
  let bucket: InMemoryStorageBucket

  const makeSong = (overrides = {}) => ({
    id: 'song-1',
    title: 'Test Song',
    artist: null,
    album: null,
    track_number: null,
    genre: null,
    duration: null,
    r2_key: 'abc.mp3',
    mime_type: 'audio/mpeg',
    bpm: null,
    source_hash: null,
    artwork_r2_key: null,
    ...overrides,
  })

  beforeEach(() => {
    repo = new InMemorySongRepository()
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs/cleanup', createCleanupRoutes(repo, bucket))
  })

  describe('GET /api/songs/cleanup', () => {
    it('returns empty when everything is consistent', async () => {
      await bucket.put('abc.mp3', new Uint8Array([1]))
      await repo.insert(makeSong())

      const res = await app.request('/api/songs/cleanup')
      const data = (await res.json()) as Record<string, unknown>
      expect(data.orphaned_files).toEqual([])
      expect(data.orphaned_records).toEqual([])
    })

    it('detects orphaned R2 files (no D1 record)', async () => {
      await bucket.put('orphan.mp3', new Uint8Array([1]))

      const res = await app.request('/api/songs/cleanup')
      const data = (await res.json()) as Record<string, unknown>
      expect(data.orphaned_files).toEqual(['orphan.mp3'])
      expect(data.orphaned_records).toEqual([])
    })

    it('detects orphaned D1 records (no R2 file)', async () => {
      await repo.insert(makeSong({ r2_key: 'missing.mp3' }))

      const res = await app.request('/api/songs/cleanup')
      const data = (await res.json()) as Record<string, unknown>
      expect(data.orphaned_files).toEqual([])
      expect(data.orphaned_records).toEqual(['missing.mp3'])
    })

    it('detects both types of orphans', async () => {
      await bucket.put('orphan-file.mp3', new Uint8Array([1]))
      await repo.insert(makeSong({ r2_key: 'orphan-record.mp3' }))

      const res = await app.request('/api/songs/cleanup')
      const data = (await res.json()) as Record<string, unknown>
      expect(data.orphaned_files).toEqual(['orphan-file.mp3'])
      expect(data.orphaned_records).toEqual(['orphan-record.mp3'])
    })
  })

  describe('POST /api/songs/cleanup', () => {
    it('deletes orphaned files', async () => {
      await bucket.put('orphan.mp3', new Uint8Array([1]))
      await bucket.put('valid.mp3', new Uint8Array([1]))
      await repo.insert(makeSong({ r2_key: 'valid.mp3' }))

      const res = await app.request('/api/songs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: ['files'] }),
      })
      const data = (await res.json()) as Record<string, unknown>
      expect(data.deleted_files).toBe(1)
      expect(data.deleted_records).toBe(0)

      // orphan.mp3 が削除されている
      expect(await bucket.get('orphan.mp3')).toBeNull()
      // valid.mp3 は残っている
      expect(await bucket.get('valid.mp3')).not.toBeNull()
    })

    it('deletes orphaned records', async () => {
      await repo.insert(makeSong({ id: '1', r2_key: 'missing.mp3' }))
      await bucket.put('valid.mp3', new Uint8Array([1]))
      await repo.insert(makeSong({ id: '2', r2_key: 'valid.mp3' }))

      const res = await app.request('/api/songs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: ['records'] }),
      })
      const data = (await res.json()) as Record<string, unknown>
      expect(data.deleted_files).toBe(0)
      expect(data.deleted_records).toBe(1)

      const songs = await repo.findAll()
      expect(songs).toHaveLength(1)
      expect(songs[0].r2_key).toBe('valid.mp3')
    })

    it('deletes both types', async () => {
      await bucket.put('orphan.mp3', new Uint8Array([1]))
      await repo.insert(makeSong({ r2_key: 'missing.mp3' }))

      const res = await app.request('/api/songs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: ['files', 'records'] }),
      })
      const data = (await res.json()) as Record<string, unknown>
      expect(data.deleted_files).toBe(1)
      expect(data.deleted_records).toBe(1)
    })

    it('returns 400 when targets is missing', async () => {
      const res = await app.request('/api/songs/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })
})
