import { Hono } from 'hono'
import type { Env, SongRepository, StorageBucket } from '../types.ts'

export const createSongRoutes = (
  repo: SongRepository,
  bucket: StorageBucket,
) => {
  const app = new Hono<Env>()

  // GET /api/songs - 楽曲一覧取得
  app.get('/', async (c) => {
    const query = c.req.query('q')
    const songs = await repo.findAll(query || undefined)
    return c.json(songs)
  })

  // POST /api/songs - 楽曲登録
  app.post('/', async (c) => {
    const body = await c.req.json()

    if (!body.id || !body.title || !body.r2_key) {
      return c.json({ error: 'id, title, and r2_key are required' }, 400)
    }

    await repo.insert({
      id: body.id,
      title: body.title,
      artist: body.artist ?? null,
      album: body.album ?? null,
      track_number: body.track_number ?? null,
      genre: body.genre ?? null,
      duration: body.duration ?? null,
      r2_key: body.r2_key,
      mime_type: body.mime_type ?? 'audio/mpeg',
      bpm: body.bpm ?? null,
      source_hash: body.source_hash ?? null,
      artwork_r2_key: body.artwork_r2_key ?? null,
    })

    return c.json({ id: body.id }, 201)
  })

  // PUT /api/songs/:id/star - Star トグル
  app.put('/:id/star', async (c) => {
    const id = c.req.param('id')
    const song = await repo.findById(id)
    if (!song) return c.json({ error: 'Song not found' }, 404)

    if (song.starred_at) {
      await repo.unstar(id)
    } else {
      await repo.star(id)
    }
    const updated = await repo.findById(id)
    return c.json(updated)
  })

  // DELETE /api/songs/:id - 物理削除（D1 + R2）
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const r2Key = await repo.hardDelete(id)

    if (r2Key === null) {
      return c.json({ error: 'Song not found' }, 404)
    }

    await bucket.delete(r2Key)

    return c.json({ success: true })
  })

  return app
}
