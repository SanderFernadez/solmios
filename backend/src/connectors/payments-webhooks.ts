// connectors/payments-webhooks.ts — payments emite sus sockets (ver modules/payments/sockets.ts,
// eventos reales: `onPaymentCompleted`, `onPaymentFailed`, `onRefundProcessed`) → eventos de
// webhook saliente. Mismo patrón que reservas-webhooks.ts: solo delega, best-effort.

import type { ConnectorContext } from 'arckode-framework'

interface WebhooksPort { dispatch: (hotelId: string, event: string, payload: unknown) => Promise<void> }

export function paymentsWebhooksConnector(ctx: ConnectorContext): void {
  const payments = ctx.resolveModule<{ setSockets: (s: any) => void }>('payments')
  const webhooks = ctx.resolveModule<WebhooksPort>('webhooks')

  payments.setSockets({
    onPaymentCompleted: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'payment.completed', data)
    },
    onPaymentFailed: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'payment.failed', data)
    },
    onRefundProcessed: async (data: any) => {
      await webhooks.dispatch(data.hotelId, 'payment.refunded', data)
    },
  })
}
