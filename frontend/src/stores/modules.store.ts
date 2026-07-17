import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ModulesService, type ModuleState } from '@/services/Platform.service'
import { isRouteEnabled } from '@/config/module-map'

// Estado EFECTIVO de módulos/submódulos del hotel actual (global ∩ plan). Cacheado por hotelId.
// Lo consumen el menú (AdminLayout) y el guard de rutas (router). Fuente: GET /api/modules.
export const useModulesStore = defineStore('modules', () => {
  const state = ref<ModuleState>({})
  const loadedHotel = ref<string | null>(null)
  const loading = ref<Promise<void> | null>(null)

  async function fetchState(): Promise<void> {
    try {
      state.value = (await ModulesService.enabled()).state || {}
    } catch {
      state.value = {} // sin datos: no bloquear nada (todo visible)
    }
  }

  /** Carga el estado una vez por hotel. Si cambió el hotel (login/impersonación), recarga. */
  async function ensure(hotelId?: string | null): Promise<void> {
    const hid = hotelId ?? null
    if (loadedHotel.value === hid && !loading.value) return
    if (loadedHotel.value === hid && loading.value) return loading.value
    loadedHotel.value = hid
    loading.value = fetchState().finally(() => { loading.value = null })
    return loading.value
  }

  function reset(): void {
    state.value = {}
    loadedHotel.value = null
    loading.value = null
  }

  function enabled(key?: string): boolean {
    return !key || state.value[key] !== false
  }

  function routeEnabled(path: string): boolean {
    return isRouteEnabled(path, state.value)
  }

  return { state, enabled, routeEnabled, ensure, reset }
})
