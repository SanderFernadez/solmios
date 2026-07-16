// useApiError.ts — Manejo estándar de errores de API.
// Centraliza el patrón repetido `catch (e) { toast.error('...') }`.
// Extrae el mensaje del error (ApiError.status/message, Error.message o body) y lo muestra vía toast.
// Uso:
//   const { handle } = useApiError()
//   try { await ReservasService.create(dto) }
//   catch (e) { handle(e, 'No se pudo crear la reserva') }
import { ApiError } from '@/services/http'
import { useToast } from '@/composables/useToast'

/** Extrae un mensaje legible de cualquier forma de error. */
export function extractApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (error instanceof ApiError) {
    // 401/403 ya se manejan en http.ts (logout); acá damos un texto claro por si llega.
    if (error.status === 403) return error.message || 'No tenés permiso para esta acción'
    if (error.status === 404) return error.message || 'No se encontró el recurso'
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>
    const msg = obj.message ?? obj.error
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export function useApiError() {
  const toast = useToast()

  /**
   * Muestra el error como toast y devuelve el mensaje resuelto (por si el caller lo quiere loguear).
   * @param error   el error atrapado en el catch
   * @param fallback mensaje si no se puede extraer uno del error
   * @param title    título del toast (default: 'Error')
   */
  function handle(error: unknown, fallback = 'Ocurrió un error inesperado', title = 'Error'): string {
    const message = extractApiErrorMessage(error, fallback)
    toast.error(title, message)
    return message
  }

  return { handle, extractApiErrorMessage }
}
