import { createApp } from './api/index.ts'

interface WorkerEnv {
  DB: D1Database
  BUCKET: R2Bucket
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const app = createApp(env)
    return app.fetch(request)
  },
}
