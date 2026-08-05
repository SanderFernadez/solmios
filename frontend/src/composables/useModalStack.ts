// composables/useModalStack.ts — cuántos AppModal hay abiertos ahora mismo, compartido entre
// TODAS las instancias (module-level, no por-componente). #643: FeedbackToolbar.vue lo usa para
// esconderse mientras haya un modal abierto — a 375px el widget flotante (fixed bottom-right,
// z-[9999]) tapaba el botón "Guardar" del footer de AppModal (z-50, pero dentro de su propio
// stacking context: el z-index más alto del widget igual gana visualmente en esa esquina).
import { ref } from 'vue'

export const openModalCount = ref(0)

export function pushModal(): void { openModalCount.value++ }
export function popModal(): void { openModalCount.value = Math.max(0, openModalCount.value - 1) }
