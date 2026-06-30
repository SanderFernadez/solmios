// reservas/usecases/state-machine.ts — Validación de transiciones legales de estado de reserva.
// Evita transiciones inválidas (ej: checked_out → pending). super_admin puede forzar (se omite el check antes de llamar).
import { ConflictError } from 'arckode-framework'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'pending'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: ['pending'],
  no_show: ['cancelled'],
}

/**
 * Lanza ConflictError (HTTP 409) si la transición from→to no es legal — no es un error de auth.
 * No-op si fromStatus está vacío (reserva sin estado previo, ej: mocks) o si from===to.
 */
export function assertValidTransition(fromStatus: string | undefined, toStatus: string): void {
  if (!fromStatus || fromStatus === toStatus) return
  const allowed = VALID_TRANSITIONS[fromStatus] ?? []
  if (!allowed.includes(toStatus)) {
    throw new ConflictError(`Transición de estado no permitida: ${fromStatus} → ${toStatus}`)
  }
}
