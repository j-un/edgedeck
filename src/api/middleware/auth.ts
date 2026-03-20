import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types.ts'

const LOOPBACK = new Set(['::1', '127.0.0.1', 'localhost'])

export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  // ローカル開発時はバイパス
  // wrangler devはHostとreq.urlをcustom_domainに書き換えるが、
  // Cf-Connecting-IPはループバック(::1)のままなのでそれで判定する
  const clientIP = c.req.header('Cf-Connecting-IP') ?? ''
  if (!clientIP || LOOPBACK.has(clientIP)) {
    await next()
    return
  }

  // 本番ではCloudflare AccessのJWTヘッダーを確認
  const jwt = c.req.header('Cf-Access-Jwt-Assertion')
  if (!jwt) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Cloudflare Accessがリバースプロキシとして検証済みのJWTを転送するため、
  // ここではヘッダーの存在チェックのみ行う
  await next()
}
