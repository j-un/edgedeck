import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from './auth.ts'
import type { Env } from '../types.ts'

describe('Auth Middleware', () => {
  const createApp = () => {
    const app = new Hono<Env>()
    app.use('*', authMiddleware)
    app.get('/api/test', (c) => c.json({ ok: true }))
    return app
  }

  it('bypasses auth when Cf-Connecting-IP is absent (test)', async () => {
    const app = createApp()
    const res = await app.request('http://localhost/api/test')
    expect(res.status).toBe(200)
  })

  it('bypasses auth when Cf-Connecting-IP is loopback (local dev)', async () => {
    const app = createApp()
    const res = await app.request('http://streamer.n-s.tokyo/api/test', {
      headers: { 'Cf-Connecting-IP': '::1' },
    })
    expect(res.status).toBe(200)
  })

  it('returns 401 when JWT header is missing in production', async () => {
    const app = createApp()
    const res = await app.request('https://music.example.com/api/test', {
      headers: { 'Cf-Connecting-IP': '203.0.113.1' },
    })
    expect(res.status).toBe(401)
  })

  it('passes when JWT header is present in production', async () => {
    const app = createApp()
    const res = await app.request('https://music.example.com/api/test', {
      headers: {
        'Cf-Connecting-IP': '203.0.113.1',
        'Cf-Access-Jwt-Assertion': 'some-valid-jwt',
      },
    })
    expect(res.status).toBe(200)
  })
})
