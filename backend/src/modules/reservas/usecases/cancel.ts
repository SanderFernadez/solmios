// reservas/usecases/cancel.ts — Cancelación de reserva aplicando política (F2 plan #627).
//
// Orquesta: findById → ownership → state machine → resolvePolicy/computePenalty →
// persistencia del snapshot financiero → socket → invalidación de cache.
// La lógica de cálculo vive en shared/usecases/cancellation-math.ts (F1); acá solo se
// aplica. NO re-implementa computePenalty: la semántica CORRECTA es deadlineHours <=
// horasRestantes (tier cuya anticipación requerida es menor al tiempo restante aplica).
// "Corregirlo" a >= reintroduce el bug que F1 documenta y testea.
import { NotFoundError } from 'arckode-framework'
import type { Logger, CacheAdapter, Auth, RepositoryAdapter } from 'arckode-framework'
import { assertValidTransition } from './state-machine'
import { safeEmit } from './safe-emit'
import { invalidateReservasCaches } from './cache'
import { resolvePolicy, computePenalty } from '../../../shared/usecases/cancellation-math'

export interface CancelDeps {
  repo: RepositoryAdapter<any>
  policyRepo: RepositoryAdapter<any>
  logger: Logger
  cache: CacheAdapter
  sockets: any
}

/**
 * Cancela una reserva aplicando la política de cancelación del hotel.
 *
 * Idempotente: si la reserva ya está `cancelled`, la devuelve sin recalcular ni
 * re-emitir (evita doble socket / doble release de depósito). Lanza 409 si viene de
 * `checked_in`/`checked_out` (state machine). Persiste el snapshot del cálculo
 * (fee/refund/policyApplied) para auditoría y para que F4 (bookingengine) y el
 * release de depósitos tengan el monto exacto sin recalcular.
 */
export async function cancelReservation(
  deps: CancelDeps,
  id: string,
  dto: { reason?: string },
  currentUser: { id: string; role: string; hotelId?: string },
  auth: Auth,
): Promise<any> {
  const { repo, policyRepo, logger, cache, sockets } = deps
  const item = await repo.findById(id)
  if (!item) throw new NotFoundError('Reserva no encontrada')
  // assertOwnership recibe (dueño, solicitante, rol, rolAdmin) — todos strings (mem
  // ownership-bug: pasar objetos rompe el === y lanza Forbidden siempre). Post-findById
  // obligatorio (regla CLAUDE.md + analyzer textual).
  auth.assertOwnership(item.hotelId, currentUser.hotelId ?? '', currentUser.role, 'super_admin')

  // Idempotencia: ya cancelada → no-op (no recalcula penalidad, no re-emite socket).
  if (item.status === 'cancelled') return item

  // State machine: checked_in → solo checked_out; checked_out → nada. Cancelar desde
  // esos estados es un 409 (la reserva ya consumió recursos: folio, habitación ocupada).
  assertValidTransition(item.status, 'cancelled')

  const nowIso = new Date().toISOString()
  // resolvePolicy trae TODAS las políticas del hotel y aplica channel > base > preset > default.
  // computePenalty (F1) devuelve el snapshot a persistir. USAR TAL CUAL.
  const policy = await resolvePolicy(policyRepo, item.hotelId, item.channel)
  const penalty = computePenalty(policy, {
    now: nowIso,
    checkIn: item.checkIn,
    depositAmount: Number(item.deposit ?? 0),
  })

  const updated = await repo.update(id, {
    status: 'cancelled',
    cancelledAt: nowIso,
    cancellationReason: dto.reason ?? '',
    cancellationFee: penalty.cancellationFee,
    refundAmount: penalty.refundAmount,
    policyApplied: penalty.policyApplied,
  })
  if (!updated) throw new NotFoundError('Reserva no encontrada')

  // Socket hacia connectors: deposits (release/refund), CRM, channel manager (availability).
  // safeEmit: si el handler falla, NO rompe la cancelación (side-effect resilient).
  await safeEmit(logger, 'onReservationCancelled', sockets.onReservationCancelled, {
    reservationId: id,
    hotelId: item.hotelId,
    refundAmount: penalty.refundAmount,
    cancellationFee: penalty.cancellationFee,
    policyApplied: penalty.policyApplied,
  })
  await invalidateReservasCaches(cache, item.hotelId)
  return updated
}
