import type {
  StorageBucket,
  StorageListResult,
  StorageObject,
} from '../types.ts'

export class InMemoryStorageBucket implements StorageBucket {
  private objects: Map<string, { data: Uint8Array; contentType?: string }> =
    new Map()

  async put(
    key: string,
    body: ArrayBuffer | ReadableStream | Uint8Array,
    contentType?: string,
  ): Promise<void> {
    let data: Uint8Array
    if (body instanceof Uint8Array) {
      data = body
    } else if (body instanceof ArrayBuffer) {
      data = new Uint8Array(body)
    } else {
      const reader = body.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) chunks.push(result.value)
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      data = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        data.set(chunk, offset)
        offset += chunk.length
      }
    }
    this.objects.set(key, { data, contentType })
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }

  async get(
    key: string,
    options?: { range?: { offset: number; length: number } },
  ): Promise<StorageObject | null> {
    const obj = this.objects.get(key)
    if (!obj) return null

    let data = obj.data
    if (options?.range) {
      data = data.slice(
        options.range.offset,
        options.range.offset + options.range.length,
      )
    }

    return {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        },
      }),
      size: options?.range ? data.length : obj.data.length,
      httpMetadata: obj.contentType
        ? { contentType: obj.contentType }
        : undefined,
    }
  }

  async list(options?: { cursor?: string }): Promise<StorageListResult> {
    const keys = Array.from(this.objects.keys())
    const startIndex = options?.cursor ? parseInt(options.cursor, 10) : 0
    const pageSize = 1000
    const page = keys.slice(startIndex, startIndex + pageSize)
    const truncated = startIndex + pageSize < keys.length

    return {
      objects: page.map((key) => ({ key })),
      truncated,
      cursor: truncated ? String(startIndex + pageSize) : undefined,
    }
  }
}
