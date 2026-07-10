// connectors/reservas-huespedes.ts — solo wiring. La lógica vive en shared/usecases/credit-stay-to-crm.
import type { ConnectorContext, Logger } from 'arckode-framework'
import { creditStayToCrm, isCheckedOut, type CrmCheckoutPort } from '../shared/usecases/credit-stay-to-crm'

export function reservasHuespedesConnector(logger: Logger): (ctx: ConnectorContext) => void {
  return (ctx: ConnectorContext) => {
    const reservas = ctx.resolveModule<{ setSockets: (s: any) => void }>('reservas')
    const crm = (): CrmCheckoutPort | null => ctx.resolveModule<CrmCheckoutPort>('crm') ?? null

    reservas.setSockets({
      onReservasUpdated: (r: any) => isCheckedOut(r) ? creditStayToCrm(crm(), logger, r) : Promise.resolve(),
      onReservationCheckedOut: (d: any) =>
        creditStayToCrm(crm(), logger, { id: d.reservationId, hotelId: d.hotelId, guestId: d.guestId, totalAmount: d.totalAmount }),
    })
  }
}
