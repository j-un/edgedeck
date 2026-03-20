import { Hono } from 'hono'
import type { Env, SongRepository, StorageBucket } from '../types.ts'

export const createUploadRoutes = (
  repo: SongRepository,
  bucket: StorageBucket,
) => {
  const app = new Hono<Env>()

  // POST /api/songs/upload/check-hashes - 既登録ハッシュの確認
  app.post('/check-hashes', async (c) => {
    const body = await c.req.json()

    if (!Array.isArray(body.hashes)) {
      return c.json({ error: 'hashes array is required' }, 400)
    }

    const existing = await repo.findExistingHashes(body.hashes)
    return c.json({ existing })
  })

  // POST /api/songs/upload - ファイルをR2にアップロードしr2_keyを返す（CPU軽量）
  app.post('/', async (c) => {
    const formData = await c.req.parseBody()
    const file = formData['file']
    const originalFilename = formData['original_filename']

    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }
    if (typeof originalFilename !== 'string' || !originalFilename) {
      return c.json({ error: 'original_filename is required' }, 400)
    }

    // R2キー生成: {uuid}.{ext}
    const ext = originalFilename.includes('.')
      ? originalFilename
          .substring(originalFilename.lastIndexOf('.'))
          .toLowerCase()
      : '.bin'
    const r2Key = `${crypto.randomUUID()}${ext}`

    // R2にアップロード
    const arrayBuffer = await file.arrayBuffer()
    await bucket.put(r2Key, arrayBuffer)

    return c.json({ r2_key: r2Key }, 201)
  })

  // POST /api/songs/upload/artwork - アートワーク画像をR2にアップロード
  app.post('/artwork', async (c) => {
    const formData = await c.req.parseBody()
    const file = formData['file']

    if (!(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }

    const ext = file.name?.includes('.')
      ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      : '.jpg'
    const r2Key = `artwork/${crypto.randomUUID()}${ext}`

    const arrayBuffer = await file.arrayBuffer()
    await bucket.put(r2Key, arrayBuffer)

    return c.json({ artwork_r2_key: r2Key }, 201)
  })

  return app
}
