// connectors/folios-payments.ts — Conector entre módulos
// Postear un pago al folio asienta el dinero en `payments` (caja + conciliación), además de dejar
// la línea en `folio_charges` que calcula el saldo del folio.
//
// El dinero se asienta UNA sola vez: en el checkout, `settle-folio-at-checkout` postea el pago al
// folio y la factura nace con ese `amountPaid` heredado, sin volver a cobrarse.

import type { ConnectorContext } from 'arckode-framework'
import type { RecordFolioPaymentInput } from '../modules/folios'

interface PaymentsModule {
  createPayment: (dto: Record<string, unknown>) => Promise<{ id: string; status: string }>
}

export function foliosPaymentsConnector(ctx: ConnectorContext): void {
  const folios = ctx.resolveModule<{ setPaymentDeps: (p: any) => void }>('folios')
  const payments = ctx.resolveModule<PaymentsModule>('payments')

  folios.setPaymentDeps({
    recordPayment: async (input: RecordFolioPaymentInput) => {
      const payment = await payments.createPayment({
        hotelId: input.hotelId,
        folioId: input.folioId,
        guestId: input.guestId ?? undefined,
        type: 'charge',
        method: input.method,
        // Postear un pago al folio es dinero ya recibido en el mostrador.
        status: 'completed',
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        reference: input.reference,
      })
      return { id: payment.id, status: payment.status }
    },
  })
}
