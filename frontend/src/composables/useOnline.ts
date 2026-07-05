import { ref } from 'vue'

// Module-level ref → singleton: todos los componentes comparten el mismo estado online/offline.
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })
}

/** Estado reactivo de conexión. Úsalo para deshabilitar acciones de escritura offline (PC-4.2.3). */
export function useOnline() {
  return { isOnline }
}
