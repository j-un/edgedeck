import { Hono } from 'hono'
import type { Env, SongRepository, StorageBucket } from '../types.ts'
import { isAudioFile } from './sync.ts'

export const createCleanupRoutes = (
  repo: SongRepository,
  bucket: StorageBucket,
) => {
  const app = new Hono<Env>()

  // GET /api/songs/cleanup - 孤立データの検出
  app.get('/', async (c) => {
    // R2の全オブジェクトキーを取得
    const r2Keys = new Set<string>()
    let cursor: string | undefined
    do {
      const result = await bucket.list(cursor ? { cursor } : undefined)
      for (const obj of result.objects) {
        if (isAudioFile(obj.key)) {
          r2Keys.add(obj.key)
        }
      }
      cursor = result.truncated ? result.cursor : undefined
    } while (cursor)

    // D1の全登録済みキーを取得（論理削除含む）
    const registeredKeys = await repo.getRegisteredR2Keys()
    const registeredKeySet = new Set(registeredKeys)

    // R2にあるがD1に未登録（Syncで取り込み対象になる孤立ファイル）
    const orphanedFiles = Array.from(r2Keys).filter(
      (key) => !registeredKeySet.has(key),
    )

    // D1にあるがR2にファイルがない（再生不能な孤立レコード）
    const orphanedRecords = registeredKeys.filter((key) => !r2Keys.has(key))

    return c.json({
      orphaned_files: orphanedFiles,
      orphaned_records: orphanedRecords,
    })
  })

  // POST /api/songs/cleanup - 孤立データの削除
  app.post('/', async (c) => {
    const body = await c.req.json()
    const targets = body.targets

    if (!Array.isArray(targets) || targets.length === 0) {
      return c.json(
        { error: 'targets array is required (e.g. ["files", "records"])' },
        400,
      )
    }

    const result: { deleted_files: number; deleted_records: number } = {
      deleted_files: 0,
      deleted_records: 0,
    }

    // R2の全キーとD1の全キーを取得
    const r2Keys = new Set<string>()
    let cursor: string | undefined
    do {
      const listResult = await bucket.list(cursor ? { cursor } : undefined)
      for (const obj of listResult.objects) {
        if (isAudioFile(obj.key)) {
          r2Keys.add(obj.key)
        }
      }
      cursor = listResult.truncated ? listResult.cursor : undefined
    } while (cursor)

    const registeredKeys = await repo.getRegisteredR2Keys()
    const registeredKeySet = new Set(registeredKeys)

    // 孤立ファイル削除（R2にあるがD1に未登録）
    if (targets.includes('files')) {
      const orphanedFiles = Array.from(r2Keys).filter(
        (key) => !registeredKeySet.has(key),
      )
      for (const key of orphanedFiles) {
        await bucket.delete(key)
        result.deleted_files++
      }
    }

    // 孤立レコード削除（D1にあるがR2にファイルがない）
    if (targets.includes('records')) {
      const orphanedRecordKeys = registeredKeys.filter(
        (key) => !r2Keys.has(key),
      )
      result.deleted_records = await repo.hardDeleteByR2Keys(orphanedRecordKeys)
    }

    return c.json(result)
  })

  return app
}
