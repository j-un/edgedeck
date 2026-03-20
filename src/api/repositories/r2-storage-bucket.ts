import type {
  StorageBucket,
  StorageListResult,
  StorageObject,
} from '../types.ts'

export class R2StorageBucket implements StorageBucket {
  private bucket: R2Bucket

  constructor(bucket: R2Bucket) {
    this.bucket = bucket
  }

  async get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<StorageObject | null> {
    const obj = await this.bucket.get(key, options)
    if (!obj) return null
    return {
      body: obj.body,
      size: obj.size,
      httpMetadata: obj.httpMetadata,
    }
  }

  async put(key: string, body: ArrayBuffer | ReadableStream): Promise<void> {
    await this.bucket.put(key, body)
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  async list(options?: { cursor?: string }): Promise<StorageListResult> {
    const result = await this.bucket.list(options)
    return {
      objects: result.objects.map((o) => ({ key: o.key })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : undefined,
    }
  }
}
