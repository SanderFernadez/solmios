// connectors/ai-recepcionista-reservas.ts — Wire: ai-recepcionista → reservas
//
// La tool `cancel_reservation` del asistente (el huésped pide cancelar por WhatsApp/webchat)
// hacía `reservationRepo.update(id, { status: 'cancelled' })`: sin política de cancelación,
// sin snapshot financiero y sin emitir `onReservationCancelled` — el depósito retenido quedaba
// colgado. Acá se le inyecta el puerto de cancelación REAL.
//
// `penaltyMode` va por default (`hotel-policy`): es una cancelación DIRECTA del huésped, así
// que corresponde exactamente la misma política que si llamara a recepción.
//
// El connector SOLO delega: el guard de tenant (la reserva tiene que ser del hotel del bot, el
// `reservationId` lo dicta un LLM sobre un canal público) lo hace `cancel-system.ts`.

import type { ConnectorContext } from 'arckode-framework'

interface ReservasCancelPort {
  cancelBySystem: (
    id: string,
    input: { hotelId: string; reason?: string },
  ) => Promise<{ ok: boolean; error?: string; message?: string; idempotent?: boolean; refundAmount?: number; cancellationFee?: number }>
}

export function aiRecepcionistaReservasConnector(ctx: ConnectorContext): void {
  const bot = ctx.resolveModule<{ cancelReservationPort: any }>('ai-recepcionista')

  bot.cancelReservationPort = async (reservationId: string, hotelId: string, reason: string) => {
    const reservas = ctx.resolveModule<ReservasCancelPort>('reservas')
    const out = await reservas.cancelBySystem(reservationId, { hotelId, reason })
    return {
      ok: out.ok,
      error: out.ok ? undefined : out.message,
      idempotent: out.idempotent,
      refundAmount: out.refundAmount,
      cancellationFee: out.cancellationFee,
    }
  }
}
