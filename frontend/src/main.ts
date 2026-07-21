import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/main.css'

// Chunk lazy obsoleto tras un deploy pero fuera del router (componente lazy dentro de una vista):
// Vite emite `vite:preloadError` cuando un modulepreload de un chunk publicado en un build anterior
// ya no existe. Recargamos una sola vez (flag en sessionStorage) para traer los assets nuevos y
// evitar un loop si el chunk falla por una causa real. El caso de rutas lo maneja `router.onError`.
window.addEventListener('vite:preloadError', () => {
  const RELOAD_FLAG = 'vite:preload-reload'
  if (sessionStorage.getItem(RELOAD_FLAG) === '1') return
  sessionStorage.setItem(RELOAD_FLAG, '1')
  window.location.reload()
})
window.addEventListener('load', () => sessionStorage.removeItem('vite:preload-reload'))

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Service Worker (PWA offline). #370. Se registra en producción; en dev estorba (HMR).
// El SW (public/sw.js) hace bypass total de /api/* y navegación network-first: el logout y los
// datos nunca se cachean. Si aparece una versión nueva del SW tras un deploy, se recarga UNA vez
// (flag en sessionStorage) para tomar los assets nuevos sin loop.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          // Hay un SW nuevo activo y ya había uno controlando → llegó una versión nueva.
          if (sw.state === 'activated' && navigator.serviceWorker.controller) {
            const FLAG = 'sw:reloaded'
            if (sessionStorage.getItem(FLAG) === '1') return
            sessionStorage.setItem(FLAG, '1')
            window.location.reload()
          }
        })
      })
    }).catch(() => { /* sin SW la app funciona igual, solo sin offline */ })
  })
}
