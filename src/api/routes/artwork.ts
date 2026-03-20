import { Hono } from 'hono'
import type { Env, StorageBucket } from '../types.ts'

export const createArtworkRoutes = (bucket: StorageBucket) => {
  const app = new Hono<Env>()

  // GET /api/songs/artwork/:key - アートワーク画像配信
  app.get('/:key', async (c) => {
    const key = `artwork/${c.req.param('key')}`
    const obj = await bucket.get(key)
    if (!obj) {
      return c.json({ error: 'Artwork not found' }, 404)
    }
    const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg'
    return new Response(obj.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  })

  return app
}
