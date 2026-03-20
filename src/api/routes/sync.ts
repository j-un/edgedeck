import { Hono } from 'hono'
import type { Env, SongRepository, StorageBucket } from '../types.ts'

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.ogg',
  '.m4a',
  '.wav',
  '.aac',
  '.wma',
  '.opus',
])

export function isAudioFile(key: string): boolean {
  const ext = key.substring(key.lastIndexOf('.')).toLowerCase()
  return AUDIO_EXTENSIONS.has(ext)
}

export const createSyncRoutes = (
  repo: SongRepository,
  bucket: StorageBucket,
) => {
  const app = new Hono<Env>()

  // GET /api/songs/sync - 未登録ファイル検出
  app.get('/', async (c) => {
    // R2の全オブジェクトキーを取得（ページネーション対応）
    const allKeys: string[] = []
    let cursor: string | undefined

    do {
      const result = await bucket.list(cursor ? { cursor } : undefined)
      for (const obj of result.objects) {
        if (isAudioFile(obj.key)) {
          allKeys.push(obj.key)
        }
      }
      cursor = result.truncated ? result.cursor : undefined
    } while (cursor)

    // D1の登録済みキーと突合
    const registeredKeys = new Set(await repo.getRegisteredR2Keys())
    const unregistered = allKeys.filter((key) => !registeredKeys.has(key))

    return c.json({ unregistered })
  })

  return app
}
