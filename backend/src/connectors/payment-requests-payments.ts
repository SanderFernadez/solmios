// connectors/payment-requests-payments.ts — Conector entre módulos
// Cobrar un Link de Pago por Stripe asienta el dinero en `payments`, además de bajar el saldo del
// folio y actualizar el depósito de la reserva.
//
// Sin este conector, un cobro por Stripe existía solo en `payment_requests` y `folio_charges`:
// nunca aparecía en `payments`, así que quedaba fuera de la conciliación bancaria. (Deuda F10.)
//
// No impacta caja: `payments-caja` solo asienta el efectivo, y un cobro Stripe ya está bancarizado.

import type { ConnectorContext } from 'arckode-framework'
import type { RecordStripePaymentInput } from '../modules/payment-requests'

interface PaymentDoc {
  id: string
  status: string
}

interface PaymentsModule {
  createPayment: (dto: Record<string, unknown>) => Promise<PaymentDoc>
  findByStripeSession: (hotelId: string, stripeSessionId: string) => Promise<PaymentDoc | null>
}

export function paymentRequestsPaymentsConnector(ctx: ConnectorContext): void {
  const paymentRequests = ctx.resolveModule<{ setPaymentDeps: (p: any) => void }>('payment-requests')
  const payments = ctx.resolveModule<PaymentsModule>('payments')

  paymentRequests.setPaymentDeps({
    paymentPort: {
      findBySession: async (hotelId: string, stripeSessionId: string) => {
        const found = await payments.findByStripeSession(hotelId, stripeSessionId)
        return found ? { id: found.id, status: found.status } : null
      },

      recordPayment: async (input: RecordStripePaymentInput) => {
        const payment = await payments.createPayment({
          hotelId: input.hotelId,
          folioId: input.folioId ?? undefined,
          type: 'charge',
          // El cobro entra por un Link de Pago, no por una tarjeta pasada en el mostrador.
          method: 'link',
          // Stripe ya confirmó el cobro: es dinero recibido, no una intención de pago.
          status: 'completed',
          amount: input.amount,
          currency: input.currency,
          description: input.description,
          reference: input.reference,
          stripeSessionId: input.stripeSessionId,
          stripePaymentId: input.stripePaymentId,
        })
        return { id: payment.id, status: payment.status }
      },
    },
  })
}
