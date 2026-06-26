// ManagerHotel Service Worker
// Estrategia: app-shell (cache first para shell, network first para API).

const CACHE_VERSION = 'mh-v4'
const APP_SHELL = [
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

  // Nunca cachear auth ni archivos JavaScript (para desarrollo)
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/stripe/webhook') || url.pathname.endsWith('.js') || url.pathname.endsWith('.ts')) {
    return
  }

  // API: network only — never cache API responses
  if (url.pathname.startsWith('/api/')) {
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
