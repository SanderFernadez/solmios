import type { ConnectorContext } from 'arckode-framework'
import { handleReservationCreated, handleReservationUpdated, handleReservationDeleted } from '../shared/usecases/auto-payment-request'

export function reservasPaymentRequestsConnector(orm: any): (ctx: ConnectorContext) => void {
  return (ctx: ConnectorContext) => {
    const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
    reservas.setSockets({
      onReservasCreated: (r: any) => handleReservationCreated(orm, r),
      onReservasUpdated: (r: any) => handleReservationUpdated(orm, r),
      onReservasDeleted: (id: string) => handleReservationDeleted(orm, id),
    })
  }
}
