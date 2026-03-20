import { Hono } from 'hono'
import type { Env, PlaylistRepository } from '../types.ts'

export const createPlaylistRoutes = (repo: PlaylistRepository) => {
  const app = new Hono<Env>()

  // GET /api/playlists - 一覧
  app.get('/', async (c) => {
    const playlists = await repo.findAll()
    return c.json(playlists)
  })

  // POST /api/playlists - 作成
  app.post('/', async (c) => {
    const body = await c.req.json()
    if (!body.id || !body.name) {
      return c.json({ error: 'id and name are required' }, 400)
    }
    await repo.create(body.id, body.name, body.description)
    return c.json({ id: body.id }, 201)
  })

  // PUT /api/playlists/:id - 更新
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    if (!body.name) {
      return c.json({ error: 'name is required' }, 400)
    }
    const updated = await repo.update(id, body.name, body.description)
    if (!updated) return c.json({ error: 'Playlist not found' }, 404)
    return c.json({ success: true })
  })

  // DELETE /api/playlists/:id - 削除
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const removed = await repo.remove(id)
    if (!removed) return c.json({ error: 'Playlist not found' }, 404)
    return c.json({ success: true })
  })

  // GET /api/playlists/:id/songs - 曲一覧
  app.get('/:id/songs', async (c) => {
    const id = c.req.param('id')
    const playlist = await repo.findById(id)
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404)
    const songs = await repo.getSongs(id)
    return c.json(songs)
  })

  // POST /api/playlists/:id/songs - 曲追加
  app.post('/:id/songs', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    if (!body.song_id) {
      return c.json({ error: 'song_id is required' }, 400)
    }
    const playlist = await repo.findById(id)
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404)
    await repo.addSong(id, body.song_id)
    return c.json({ success: true }, 201)
  })

  // PUT /api/playlists/:id/songs/reorder - 並び替え
  app.put('/:id/songs/reorder', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    if (!Array.isArray(body.song_ids)) {
      return c.json({ error: 'song_ids array is required' }, 400)
    }
    const playlist = await repo.findById(id)
    if (!playlist) return c.json({ error: 'Playlist not found' }, 404)
    await repo.reorder(id, body.song_ids)
    return c.json({ success: true })
  })

  // DELETE /api/playlists/:id/songs/:songId - 曲削除
  app.delete('/:id/songs/:songId', async (c) => {
    const id = c.req.param('id')
    const songId = c.req.param('songId')
    const removed = await repo.removeSong(id, songId)
    if (!removed) return c.json({ error: 'Song not in playlist' }, 404)
    return c.json({ success: true })
  })

  return app
}
