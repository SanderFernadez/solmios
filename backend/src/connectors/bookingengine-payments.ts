// connectors/bookingengine-payments.ts — Conector bookingengine→payments.
// El cobro del widget público entra por Stripe y es plata real. Sin esto quedaba solo en la fila de
// `bookings`: fuera de `payments`, de la conciliación bancaria y del balance.
//
// NO es best-effort: si el dinero no se puede asentar, el webhook falla y Stripe reintenta. Un cobro
// que confirma la reserva pero no aparece en la conciliación es peor que un webhook fallido.

import type { ConnectorContext } from 'arckode-framework'
import type { PublicBookingDTO } from '../modules/bookingengine'
import { postBookingPayment, type BookingPaymentPort } from '../shared/usecases/post-booking-payment'

export function bookingenginePaymentsConnector(ctx: ConnectorContext): void {
  const bookingengine = ctx.resolveModule<{ setSockets: (s: any) => void }>('bookingengine')

  bookingengine.setSockets({
    onBookingPaid: async (booking: PublicBookingDTO) => {
      await postBookingPayment(ctx.resolveModule<BookingPaymentPort>('payments'), booking)
    },
  })
}
