// connectors/canales-reservas.ts — Wire: canales → reservas (cancelación que llega de una OTA)
//
// El cron de ingesta de bookings (booking-sync → applyBookingRevision) recibe revisiones con
// `status: 'cancelled'` desde Channex. Antes las aplicaba con `orm.update('Reservations', id,
// { status: 'cancelled' })`: sin política, sin snapshot financiero y —lo caro— sin emitir
// `onReservationCancelled`, que es LO ÚNICO que libera el depósito/garantía retenido
// (connectors/reservas-deposits.ts). Plata del hotel trabada en un hold que nadie soltaba.
//
// `canales` no puede importar `reservas` (regla del proyecto): acá se le inyecta el puerto y el
// connector SOLO delega — toda la lógica (guard de tenant, idempotencia, state machine,
// política, snapshot, evento) vive en `reservas/usecases/cancel-system.ts`.
//
// ⚠ MATIZ DE NEGOCIO — `penaltyMode: 'channel-managed'`:
// en una cancelación que llega de una OTA la penalidad comercial la cobra y retiene el CANAL,
// según el rate plan con el que el huésped reservó; los tiers de cancelación del hotel no
// aplican a esa reserva. Por eso el snapshot se persiste con fee 0 y reembolso total, y el
// depósito retenido se libera completo. Si un hotel quisiera aplicar TAMBIÉN su propia
// penalidad a las cancelaciones OTA, el cambio es una línea: `penaltyMode: 'hotel-policy'`.

import type { ConnectorContext } from 'arckode-framework'

interface ReservasCancelPort {
  cancelBySystem: (
    id: string,
    input: { hotelId: string; reason?: string; penaltyMode?: 'hotel-policy' | 'channel-managed' },
  ) => Promise<{ ok: boolean; error?: string; message?: string; idempotent?: boolean }>
}

export function canalesReservasConnector(ctx: ConnectorContext): void {
  const canales = ctx.resolveModule<{ setReservationCancelPort?: (fn: any) => void }>('canales')

  canales.setReservationCancelPort?.(async (reservationId: string, hotelId: string, reason: string) => {
    const reservas = ctx.resolveModule<ReservasCancelPort>('reservas')
    const out = await reservas.cancelBySystem(reservationId, {
      hotelId,
      reason,
      penaltyMode: 'channel-managed',
    })
    // Van los DOS: `error` es el CÓDIGO (`invalid_state` / `not_found`) y con él la ingesta decide
    // si tiene sentido reintentar; `message` es el texto para el log. Pisar el código con el
    // mensaje dejaba a `applyBookingRevision` sin poder distinguir un fallo definitivo de uno
    // transitorio, y la revisión reintentaba para siempre.
    if (out.ok) return { ok: true, idempotent: out.idempotent }
    return { ok: false, error: out.error, message: out.message, idempotent: out.idempotent }
  })
}
