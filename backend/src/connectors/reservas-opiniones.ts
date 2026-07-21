// connectors/reservas-opiniones.ts — Invitación a opinar tras el checkout.
// reservas emite onReservationCheckedOut; el módulo opiniones crea una review 'pending'
// (visible=0, rating=0) vinculada a la reserva, para que el huésped la complete luego.
// Best-effort: si opiniones no carga o falla, NO rompe el checkout (try/catch).
// Dedup por reservationId dentro de OpinionesService.createReviewInvite.
// Seguro encadenar: reservas COMPONE los sockets (mismo patrón que payments), así que
// este connector no pisa a reservas-huespedes (CRM) que escucha el mismo evento.

import type { ConnectorContext } from 'arckode-framework'

export function reservasOpinionesConnector(ctx: ConnectorContext): void {
  const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
  reservas.setSockets({
    onReservationCheckedOut: async (data: { reservationId: string; hotelId: string; guestId?: string | null }) => {
      try {
        const opiniones = ctx.resolveModule<{ createReviewInvite: (i: { hotelId: string; reservationId: string; guestId?: string | null }) => Promise<unknown> }>('opiniones')
        await opiniones.createReviewInvite({
          hotelId: data.hotelId,
          reservationId: data.reservationId,
          guestId: data.guestId,
        })
      } catch {
        // Best-effort: opiniones puede no estar disponible (módulo desactivado). No rompe el checkout.
      }
    },
  })
}
