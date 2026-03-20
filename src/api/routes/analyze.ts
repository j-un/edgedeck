import { Hono } from 'hono'
import type { Env, StorageBucket } from '../types.ts'
import { parseMetadata } from '../services/metadata-parser.ts'

const ANALYZE_READ_SIZE = 262144 // 256KB

const ARTWORK_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

export const createAnalyzeRoutes = (bucket: StorageBucket) => {
  const app = new Hono<Env>()

  // POST /api/songs/analyze - メタデータ解析
  app.post('/', async (c) => {
    const body = await c.req.json()

    if (!body.r2_key || typeof body.r2_key !== 'string') {
      return c.json({ error: 'r2_key is required' }, 400)
    }

    const r2Key: string = body.r2_key

    // ファイル先頭256KBを読み取る
    const obj = await bucket.get(r2Key, {
      range: { offset: 0, length: ANALYZE_READ_SIZE },
    })

    if (!obj) {
      return c.json({ error: 'File not found in storage' }, 404)
    }

    // ReadableStreamをバッファに変換
    const reader = obj.body.getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        chunks.push(result.value)
      }
    }
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const buffer = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }

    const metadata = await parseMetadata(
      buffer,
      r2Key,
      obj.httpMetadata?.contentType,
    )

    // アートワークをR2に保存
    let artworkR2Key: string | null = null
    if (metadata.artwork) {
      const ext = ARTWORK_EXT[metadata.artwork.format] ?? '.jpg'
      artworkR2Key = `artwork/${crypto.randomUUID()}${ext}`
      await bucket.put(
        artworkR2Key,
        metadata.artwork.data.buffer as ArrayBuffer,
      )
    }

    return c.json({
      r2_key: r2Key,
      artwork_r2_key: artworkR2Key,
      metadata: {
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        track_number: metadata.track_number,
        genre: metadata.genre,
        duration: metadata.duration,
        bpm: metadata.bpm,
        mime_type: metadata.mime_type,
      },
    })
  })

  return app
}
