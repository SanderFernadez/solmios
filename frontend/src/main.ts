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
