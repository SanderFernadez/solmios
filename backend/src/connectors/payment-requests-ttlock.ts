// connectors/payment-requests-ttlock.ts — Genera el código de cerradura TTLock al pagarse la seña.
//
// Estilo MisterPlan: cuando el huésped paga el Link de Pago de la seña (evento `onPaymentRequestPaid`,
// emitido por el webhook de Stripe tras asentar el cobro y garantizar la reserva), se emite el PIN de
// acceso automáticamente — sin depender de que alguien toque el botón manual (que sigue existiendo).
//
// El connector solo DELEGA: resuelve `ttlock` y llama a `generateCodeIfAbsent` (la idempotencia y la
// generación viven en el service, no acá). No importa el módulo directo.

import type { ConnectorContext, Logger } from 'arckode-framework'

interface TtlockModule {
  generateCodeIfAbsent: (hotelId: string, reservationId: string) => Promise<unknown>
}

interface PaymentRequestPaid {
  hotelId?: string
  reservationId?: string
}

export function paymentRequestsTtlockConnector(logger: Logger): (ctx: ConnectorContext) => void {
  const log = logger.child('payment-requests-ttlock')
  return (ctx: ConnectorContext) => {
    const paymentRequests = ctx.resolveModule<{ setSockets: (s: Record<string, unknown>) => void }>('payment-requests')
    paymentRequests.setSockets({
      onPaymentRequestPaid: async (pr: PaymentRequestPaid) => {
        if (!pr?.hotelId || !pr?.reservationId) return
        // Un fallo acá NO puede tumbar el webhook: si el handler tira, Stripe devuelve 500 y reintenta
        // en loop. Casos esperados que solo se loguean: ttlock no registrado en este despliegue, la
        // habitación sin cerradura asignada, o el hotel sin TTLock conectado.
        try {
          const ttlock = ctx.resolveModule<TtlockModule>('ttlock')
          await ttlock.generateCodeIfAbsent(pr.hotelId, pr.reservationId)
        } catch (e) {
          log.info(`No se generó código TTLock para la reserva ${pr.reservationId}: ${e instanceof Error ? e.message : String(e)}`)
        }
      },
    })
  }
}
