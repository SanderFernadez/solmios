// reservas/usecases/cancel-system.ts — Cancelación de reserva por un actor de SISTEMA.
//
// Camino para los flujos automáticos que NO tienen usuario logueado:
//   - `canales` — una OTA cancela vía el feed de Channex (cron de ingesta).
//   - `ai-recepcionista` — el huésped le pide al bot que cancele.
//   - `ai-gerente` — herramienta del Gerente IA (con confirmación previa del gerente).
//
// ── AUTORIZACIÓN: tenant, no usuario ─────────────────────────────────────────────────────
// `cancelReservation` (camino del panel) exige `currentUser` y hace `auth.assertOwnership`.
// Acá NO hay usuario, y meter uno falso o saltear el check sería abrir un agujero: el
// `reservationId` de los dos flujos de IA lo dicta un LLM sobre un canal PÚBLICO, así que una
// prompt-injection podría pedir cancelar la reserva de cualquier hotel.
// El equivalente correcto es el TENANT: el caller declara para qué hotel está actuando —dato
// que NO viene del LLM ni del payload de la OTA, sino del contexto (el bot conoce su hotelId;
// el cron deriva el hotel de `revision.propertyId → channel_config.channexPropertyId`)— y acá
// se verifica que la reserva sea de ese hotel. Si no lo es, es como si no existiera.
// Es exactamente la garantía que ya daban los guards locales `findOwnedReservation` /
// `ownedReservation` de los módulos de IA; acá se centraliza en un solo lugar.
//
// Lookup con `findMany({ id })` y no `findById`: mismo motivo que public-cancel.ts — `findById`
// sin un `auth.assertOwnership` textual detrás dispara el falso positivo del analyzer, y acá el
// chequeo es por hotelId (no hay Auth para llamar).
//
// Devuelve un resultado discriminado en vez de lanzar NotFound/Forbidden: los callers son
// connectors y tools de LLM, que necesitan traducirlo a un mensaje, no a un HTTP status.

import { ConflictError } from 'arckode-framework'
import { applyCancellation, type CancelCoreDeps, type PenaltyMode } from './cancel-core'

export type SystemCancelDeps = CancelCoreDeps

export interface SystemCancelInput {
  /** Hotel para el que actúa el caller. La reserva DEBE pertenecerle. */
  hotelId: string
  /** Motivo persistido en `cancellationReason`. */
  reason?: string
  /** Ver PenaltyMode en cancel-core.ts. Default: `hotel-policy`. */
  penaltyMode?: PenaltyMode
}

export type SystemCancelOutcome =
  | {
      ok: true
      reservationId: string
      /** true → ya estaba cancelada: no se recalculó penalidad ni se re-emitió el evento. */
      idempotent: boolean
      refundAmount: number
      cancellationFee: number
      policyApplied: unknown
    }
  | { ok: false; error: 'not_found' | 'invalid_state'; message: string }

/**
 * Cancela una reserva en nombre del sistema, con el MISMO efecto que la cancelación del panel:
 * política aplicada, snapshot financiero persistido y `onReservationCancelled` emitido (que es
 * lo que libera el depósito retenido vía connectors/reservas-deposits.ts).
 */
export async function cancelReservationBySystem(
  deps: SystemCancelDeps,
  id: string,
  input: SystemCancelInput,
): Promise<SystemCancelOutcome> {
  if (!id || !input?.hotelId) return { ok: false, error: 'not_found', message: 'Reserva no encontrada' }

  const rows = (await deps.repo.findMany({ id })) as any[]
  const item = Array.isArray(rows) ? rows[0] : (rows as any)?.data?.[0]
  // Guard de tenant: reserva de otro hotel === reserva inexistente (anti prompt-injection).
  if (!item || item.hotelId !== input.hotelId) {
    return { ok: false, error: 'not_found', message: 'Reserva no encontrada' }
  }

  try {
    const { penalty, idempotent } = await applyCancellation(deps, item, {
      reason: input.reason,
      penaltyMode: input.penaltyMode,
    })
    return {
      ok: true,
      reservationId: id,
      idempotent,
      refundAmount: penalty.refundAmount,
      cancellationFee: penalty.cancellationFee,
      policyApplied: penalty.policyApplied,
    }
  } catch (e) {
    // checked_in / checked_out → la reserva ya consumió recursos; cancelarla automáticamente
    // no corresponde (requiere gestión humana). El resto de errores sí propaga.
    if (e instanceof ConflictError) {
      return {
        ok: false,
        error: 'invalid_state',
        message: `No se puede cancelar una reserva en estado "${item.status}". Requiere gestión del hotel.`,
      }
    }
    throw e
  }
}
