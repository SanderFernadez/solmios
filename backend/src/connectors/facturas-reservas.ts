// connectors/facturas-reservas.ts — Al pagar una factura vinculada a una reserva, appendea el
// aviso a las notas de la reserva. El connector solo wirea; la lógica vive en el usecase compartido.
// Best-effort: no falla el pago de la factura si la reserva no existe.

import type { ConnectorContext } from 'arckode-framework'
import { appendInvoiceNoteToReservation } from '../shared/usecases/append-invoice-note'

export function facturasReservasConnector(ctx: ConnectorContext): void {
  const facturas = ctx.resolveModule<{ setSockets: (s: any) => void }>('facturas')
  facturas.setSockets({
    onFacturasUpdated: (factura: any) =>
      appendInvoiceNoteToReservation(ctx.resolveModule('reservas'), factura).catch(() => {}),
  })
}
