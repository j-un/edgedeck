import { Hono } from 'hono'
import type { Env } from './types.ts'
import { authMiddleware } from './middleware/auth.ts'
import { createSongRoutes } from './routes/songs.ts'
import { createStreamRoutes } from './routes/stream.ts'
import { createSyncRoutes } from './routes/sync.ts'
import { createAnalyzeRoutes } from './routes/analyze.ts'
import { createUploadRoutes } from './routes/upload.ts'
import { createCleanupRoutes } from './routes/cleanup.ts'
import { createArtworkRoutes } from './routes/artwork.ts'
import { createPlaylistRoutes } from './routes/playlists.ts'
import { D1SongRepository } from './repositories/d1-song-repository.ts'
import { D1PlaylistRepository } from './repositories/d1-playlist-repository.ts'
import { R2StorageBucket } from './repositories/r2-storage-bucket.ts'

export function createApp(env: { DB: D1Database; BUCKET: R2Bucket }) {
  const app = new Hono<Env>().basePath('/api')
  const repo = new D1SongRepository(env.DB)
  const playlistRepo = new D1PlaylistRepository(env.DB)
  const bucket = new R2StorageBucket(env.BUCKET)

  app.use('*', authMiddleware)

  // 固定パスを先にマウントし、:id パラメータとの衝突を回避する
  app.route('/songs/sync', createSyncRoutes(repo, bucket))
  app.route('/songs/analyze', createAnalyzeRoutes(bucket))
  app.route('/songs/upload', createUploadRoutes(repo, bucket))
  app.route('/songs/cleanup', createCleanupRoutes(repo, bucket))
  app.route('/songs/artwork', createArtworkRoutes(bucket))
  app.route('/songs', createStreamRoutes(repo, bucket))
  app.route('/songs', createSongRoutes(repo, bucket))
  app.route('/playlists', createPlaylistRoutes(playlistRepo))

  return app
}
