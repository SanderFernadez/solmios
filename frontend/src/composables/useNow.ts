// composables/useNow.ts — Reloj reactivo que se actualiza cada N ms.
// Pensado para mostrar tiempo transcurrido EN VIVO (ej. tareas `in_progress` de
// housekeeping) sin recargar. Limpia el interval en onUnmounted para evitar leaks
// (patrón de ai-receptionist/chat.vue). Debe llamarse dentro de un setup().
import { ref, onUnmounted } from 'vue'

export function useNow(intervalMs = 60_000) {
  const now = ref(Date.now())
  const timer = setInterval(() => { now.value = Date.now() }, intervalMs)
  onUnmounted(() => clearInterval(timer))
  return { now }
}
