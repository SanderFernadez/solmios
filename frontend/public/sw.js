// SolmiOS — Service Worker auto-desregistrante.
// Sanea instalaciones previas: al recargar, elimina este SW y todos sus caches.
// No intercepta fetch (deja que la red controle todo mientras se desinstala).
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Borrar todos los caches de versiones previas (mh-v4, etc.)
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    // Desregistrar este Service Worker
    await self.registration.unregister()
    // Tomar control y recargar las pestañas para que salgan del SW
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    await Promise.all(clients.map((c) => c.navigate(c.url)))
  })())
})
