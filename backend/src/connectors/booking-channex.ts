// connectors/booking-channex.ts — Conector entre booking-engine y canales (Channex)
// Sincroniza disponibilidad con Google Hotel Ads via Channex

import type { ConnectorContext } from 'arckode-framework'

export function bookingChannexConnector(ctx: ConnectorContext): void {
  const bookingEngine = ctx.resolveModule<{ setSockets: (s: any) => void }>('bookingengine')

  bookingEngine.setSockets({
    onBookingCreated: async (booking: any) => {
      if (booking.status === 'confirmed') {
        const canales = ctx.resolveModule<{ pushAvailability?: (d: any) => Promise<any> }>('canales')
        await canales.pushAvailability?.({
          hotelId: booking.hotelId,
          roomType: booking.roomType,
          date: booking.checkIn,
        }).catch(() => {})
      }
    },
  })
}
