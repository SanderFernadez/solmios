// connectors/facturas-payments.ts — Conector entre módulos
// Cobrar una factura asienta el dinero en `payments`, la única fuente de verdad: es lo que alimenta
// el arqueo de caja (connector `payments-caja`) y la conciliación bancaria.
//
// Antes `facturas.pay()` escribía un comprobante `type:'payment'` dentro de `invoices` y no emitía
// ningún evento: un cobro en efectivo desde /panel/billing nunca entraba al turno de caja.
// Ver openspec/changes/billing-money-consolidation/proposal.md (reproducido en local).

import type { ConnectorContext } from 'arckode-framework'
import type { RecordPaymentInput, RecordedPayment } from '../modules/facturas'

interface PaymentsModule {
  createPayment: (dto: Record<string, unknown>) => Promise<{ id: string; status: string }>
}

export function facturasPaymentsConnector(ctx: ConnectorContext): void {
  const facturas = ctx.resolveModule<{ setPaymentDeps: (p: any) => void }>('facturas')
  const payments = ctx.resolveModule<PaymentsModule>('payments')

  facturas.setPaymentDeps({
    recordPayment: async (input: RecordPaymentInput): Promise<RecordedPayment> => {
      const payment = await payments.createPayment({
        hotelId: input.hotelId,
        invoiceId: input.invoiceId,
        guestId: input.guestId ?? undefined,
        type: 'charge',
        method: input.method,
        // Aplicar un pago a una factura es dinero ya recibido en el mostrador.
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
