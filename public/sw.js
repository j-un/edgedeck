const CACHE_NAME = 'edgedeck-v3'
const STATIC_ASSETS = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Streaming endpoints: Network Only (large audio data)
  if (url.pathname.match(/^\/api\/songs\/[^/]+\/stream$/)) {
    return
  }

  // API song list: Network First (offline fallback)
  if (url.pathname === '/api/songs' && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 認証切れ時のリダイレクトレスポンス(ログインページHTML)をキャッシュしない
          const ct = response.headers.get('content-type') || ''
          if (response.ok && ct.includes('application/json')) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone)
            })
          }
          return response
        })
        .catch(() => caches.match(event.request)),
    )
    return
  }

  // Other API requests: Network Only
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Static assets: Network First (offline fallback)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (
          response.ok &&
          !response.redirected &&
          event.request.method === 'GET'
        ) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone)
          })
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
