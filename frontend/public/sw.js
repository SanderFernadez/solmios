// SolmiOS — Service Worker (PWA). #369 crear · #370 registrar · #222 network-first + bypass /api/*
//
// Historial: un SW anterior se desactivó porque ROMPÍA EL LOGOUT (cacheaba respuestas de la API) y
// dejaba chunks viejos tras cada deploy. Este está diseñado para que eso NO pueda repetirse:
//
//   1. BYPASS TOTAL de /api/*  → auth, logout y datos SIEMPRE van a la red, nunca se cachean.
//   2. Navegación network-first → el HTML se pide siempre a la red; el cache es solo fallback
//      offline. Tras un deploy, la primera carga online ya trae el index nuevo (chunks nuevos).
//   3. Assets con hash cache-first → /assets/xxxx-HASH.js son inmutables: un cambio = otra URL,
//      así que cachearlos no sirve nada viejo.
//   4. skipWaiting + clients.claim → el SW nuevo toma control enseguida; no quedan pestañas con
//      una versión zombie.
//
// Subir CACHE_VERSION en cada cambio de este archivo invalida los caches anteriores en `activate`.

const CACHE_VERSION = 'solmios-v5'
const OFFLINE_URL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL]).catch(() => {})),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Borra los caches de versiones anteriores (solmios-v4, etc.).
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // 1. Nunca tocar la API ni nada que no sea GET del mismo origen. Auth/logout/datos → red directa.
  //    Sin esto, una respuesta 200 de login/logout cacheada rompe la sesión (el bug histórico).
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    return   // no llamamos respondWith → el navegador hace su fetch normal
  }

  // 2. Navegación (documento HTML): network-first. La red manda; el cache es solo para offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        // Guarda una copia del shell para servir offline.
        const cache = await caches.open(CACHE_VERSION)
        cache.put(OFFLINE_URL, fresh.clone()).catch(() => {})
        return fresh
      } catch {
        const cached = await caches.match(OFFLINE_URL)
        return cached || Response.error()
      }
    })())
    return
  }

  // 3. Assets con hash (/assets/xxxx-HASH.js|css, imágenes): cache-first. Inmutables por el hash.
  if (url.pathname.startsWith('/assets/') || /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req)
      if (cached) return cached
      try {
        const fresh = await fetch(req)
        if (fresh.ok) {
          const cache = await caches.open(CACHE_VERSION)
          cache.put(req, fresh.clone()).catch(() => {})
        }
        return fresh
      } catch {
        return cached || Response.error()
      }
    })())
  }
  // Todo lo demás: sin respondWith → fetch normal del navegador.
})
