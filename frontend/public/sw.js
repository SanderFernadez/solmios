// ManagerHotel Service Worker
// Estrategia: app-shell (cache first para shell, network first para API).

const CACHE_VERSION = 'mh-v1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Instalación: precachea el shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  )
  self.skipWaiting()
})

// Activación: limpia caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: estrategia según tipo de request
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Nunca cachear el endpoint de auth (token fresco siempre)
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/stripe/webhook')) {
    return
  }

  // API: network first, fallback a cache (datos offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Solo cachear respuestas exitosas (no errores 4xx/5xx)
          if (res.ok && req.method === 'GET') {
            const clone = res.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(
          JSON.stringify({ error: 'offline', message: 'Sin conexión' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )))
    )
    return
  }

  // Assets estáticos y navegación: cache first, fallback a red
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        // Cachear solo GET exitosos
        if (res.ok && req.method === 'GET' && (url.origin === self.location.origin)) {
          const clone = res.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => {})
        }
        return res
      }).catch(() => {
        // Fallback offline para navegación: mostrar index.html
        if (req.mode === 'navigate') {
          return caches.match('/index.html')
        }
        return new Response('Offline', { status: 503 })
      })
    })
  )
})

// Permitir skipWaiting desde la página
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})
