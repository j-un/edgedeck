import { Hono } from 'hono'
import type { Env, SongRepository, StorageBucket } from '../types.ts'

export const createStreamRoutes = (
  repo: SongRepository,
  bucket: StorageBucket,
) => {
  const app = new Hono<Env>()

  // GET /api/songs/:id/stream - ストリーミング再生
  app.get('/:id/stream', async (c) => {
    const id = c.req.param('id')
    const song = await repo.findById(id)

    if (!song) {
      return c.json({ error: 'Song not found' }, 404)
    }

    const rangeHeader = c.req.header('Range')

    if (rangeHeader) {
      // Range リクエスト対応
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (!match) {
        return new Response('Invalid Range', { status: 416 })
      }

      // まずフルオブジェクトを取得してサイズを得る
      const fullObj = await bucket.get(song.r2_key)
      if (!fullObj) {
        return c.json({ error: 'File not found in storage' }, 404)
      }

      const totalSize = fullObj.size
      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1

      if (start >= totalSize || end >= totalSize || start > end) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${totalSize}` },
        })
      }

      // Range指定でオブジェクトを取得
      const rangedObj = await bucket.get(song.r2_key, {
        range: { offset: start, length: end - start + 1 },
      })
      if (!rangedObj) {
        return c.json({ error: 'File not found in storage' }, 404)
      }

      return new Response(rangedObj.body, {
        status: 206,
        headers: {
          'Content-Type': song.mime_type,
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
        },
      })
    }

    // Range未指定: フルレスポンス
    const obj = await bucket.get(song.r2_key)
    if (!obj) {
      return c.json({ error: 'File not found in storage' }, 404)
    }

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': song.mime_type,
        'Content-Length': String(obj.size),
        'Accept-Ranges': 'bytes',
      },
    })
  })

  return app
}
