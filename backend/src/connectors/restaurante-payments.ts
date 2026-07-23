// connectors/restaurante-payments.ts — POS → payments (RES-5). SOLO cablea: el cobro directo de una
// comanda crea un payment `completed` por el total bruto. La caja y el asiento de caja los hace
// payments (onPaymentCompleted); el ingreso "Ventas Restaurante" lo reconoce RES-6.
import type { ConnectorContext } from 'arckode-framework'
import type { RecordPaymentInput } from '../modules/restaurant'

interface PaymentsModule {
  createPayment: (dto: Record<string, unknown>) => Promise<{ id: string }>
}

export function restaurantePaymentsConnector(ctx: ConnectorContext): void {
  const restaurant = ctx.resolveModule<{ setSettlementDeps: (p: any) => void }>('restaurant')
  const payments = () => ctx.resolveModule<PaymentsModule>('payments')

  restaurant.setSettlementDeps({
    recordPayment: async (input: RecordPaymentInput) => {
      const payment = await payments().createPayment({
        hotelId: input.hotelId,
        type: 'charge',
        method: input.method,
        status: 'completed',   // dinero recibido en el mostrador
        amount: input.amount,
        currency: input.currency,   // moneda del hotel (M3); si undefined, payments defaultea
        description: input.description,
        folioId: input.folioId,
      })
      return { paymentId: payment.id }
    },
  })
}
