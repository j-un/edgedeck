import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createAnalyzeRoutes } from './analyze.ts'
import { InMemoryStorageBucket } from '../repositories/in-memory-storage-bucket.ts'

describe('Analyze Routes', () => {
  let app: Hono
  let bucket: InMemoryStorageBucket

  beforeEach(() => {
    bucket = new InMemoryStorageBucket()
    app = new Hono()
    app.route('/api/songs/analyze', createAnalyzeRoutes(bucket))
  })

  it('returns 400 when r2_key is missing', async () => {
    const res = await app.request('/api/songs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 when file not found in storage', async () => {
    const res = await app.request('/api/songs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2_key: 'nonexistent.mp3' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns fallback metadata for non-parseable data', async () => {
    // 非音楽データを格納
    bucket.put(
      'Artist/Album/01-My Song.mp3',
      new Uint8Array([0, 0, 0, 0]),
      'audio/mpeg',
    )

    const res = await app.request('/api/songs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2_key: 'Artist/Album/01-My Song.mp3' }),
    })
    expect(res.status).toBe(200)

    const data = (await res.json()) as {
      r2_key: string
      metadata: Record<string, unknown>
    }
    expect(data.r2_key).toBe('Artist/Album/01-My Song.mp3')
    expect(data.metadata.title).toBe('01-My Song')
    expect(data.metadata.mime_type).toBe('audio/mpeg')
  })

  it('infers mime_type from extension when no httpContentType', async () => {
    bucket.put('song.flac', new Uint8Array([0, 0, 0, 0]))

    const res = await app.request('/api/songs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2_key: 'song.flac' }),
    })
    const data = (await res.json()) as {
      r2_key: string
      metadata: Record<string, unknown>
    }
    expect(data.metadata.mime_type).toBe('audio/flac')
  })

  it('parses a valid ID3v2 MP3 file', async () => {
    // Build ID3v2.3 tag programmatically
    function makeFrame(id: string, text: string): Uint8Array {
      const enc = new TextEncoder()
      const idBytes = enc.encode(id)
      const textBytes = enc.encode(text)
      const dataSize = 1 + textBytes.length // encoding byte + text
      const frame = new Uint8Array(10 + dataSize)
      frame.set(idBytes, 0) // frame ID
      frame[4] = (dataSize >> 24) & 0xff
      frame[5] = (dataSize >> 16) & 0xff
      frame[6] = (dataSize >> 8) & 0xff
      frame[7] = dataSize & 0xff
      // flags [8],[9] = 0
      frame[10] = 0x00 // encoding: ISO-8859-1
      frame.set(textBytes, 11)
      return frame
    }

    const tit2 = makeFrame('TIT2', 'TestSong')
    const tpe1 = makeFrame('TPE1', 'ArtistX')

    const tagSize = tit2.length + tpe1.length
    // ID3v2 header uses syncsafe integers
    const header = new Uint8Array([
      0x49,
      0x44,
      0x33, // "ID3"
      0x03,
      0x00, // version 2.3.0
      0x00, // flags
      (tagSize >> 21) & 0x7f,
      (tagSize >> 14) & 0x7f,
      (tagSize >> 7) & 0x7f,
      tagSize & 0x7f,
    ])

    const id3Tag = new Uint8Array(header.length + tagSize)
    id3Tag.set(header, 0)
    id3Tag.set(tit2, header.length)
    id3Tag.set(tpe1, header.length + tit2.length)

    bucket.put('test/tagged.mp3', id3Tag, 'audio/mpeg')

    const res = await app.request('/api/songs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2_key: 'test/tagged.mp3' }),
    })
    expect(res.status).toBe(200)

    const data = (await res.json()) as {
      r2_key: string
      metadata: Record<string, unknown>
    }
    expect(data.metadata.title).toBe('TestSong')
    expect(data.metadata.artist).toBe('ArtistX')
    expect(data.metadata.mime_type).toBe('audio/mpeg')
  })
})
