// shared/usecases/credit-stay-to-crm.ts
//
// Acredita una estadía terminada al CRM (estadías, gasto, puntos, nivel).
//
// Hay DOS caminos para dejar una reserva en `checked_out`:
//   1. `POST /api/reservas/:id/checkout` → emite `onReservationCheckedOut` (lo que usa el panel).
//   2. `PUT /api/reservas/:id {status:'checked_out'}` → emite `onReservasUpdated` (el CRUD genérico).
//
// El conector sólo escuchaba el segundo, así que por el botón de checkout el CRM nunca corría.
// `CrmService.onCheckoutComplete` es idempotente por reserva: si ambos eventos llegaran juntos,
// la estadía se acredita una sola vez.

export interface CrmCheckoutPort {
  onCheckoutComplete: (reserva: { id: string; hotelId: string; guestId: string; totalAmount: number }) => Promise<unknown>
}

export interface StayLogger {
  warn: (msg: string, meta?: Record<string, unknown>) => void
}

/** Una reserva sin huésped no tiene a quién acreditarle nada. */
export async function creditStayToCrm(
  crm: CrmCheckoutPort | null,
  logger: StayLogger | undefined,
  reserva: { id: string; hotelId: string; guestId?: string | null; totalAmount?: number },
): Promise<void> {
  if (!crm || !reserva.guestId) return

  // Best-effort a propósito: un CRM caído no debe abortar un checkout. Pero silenciarlo del todo
  // (el viejo `.catch(() => {})`) fue lo que dejó vivir el bug de los puntos durante meses.
  await crm
    .onCheckoutComplete({
      id: reserva.id,
      hotelId: reserva.hotelId,
      guestId: reserva.guestId,
      totalAmount: Number(reserva.totalAmount) || 0,
    })
    .catch((e: any) => logger?.warn('crm.onCheckoutComplete falló', { reservationId: reserva.id, error: e?.message }))
}

/** `true` sólo cuando el CRUD genérico dejó la reserva en `checked_out`. */
export const isCheckedOut = (reserva: { status?: string }): boolean => reserva.status === 'checked_out'
