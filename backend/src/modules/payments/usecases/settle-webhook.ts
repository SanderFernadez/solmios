// payments/usecases/settle-webhook.ts — Asienta un cobro confirmado por webhook, una sola vez.
//
// Verifica la firma (vía StripeUseCase), y si el evento es un pago, corre el asiento a través del
// PaymentEventStore para que un reintento o un webhook concurrente no lo cuenten dos veces.

import type { StripeUseCase } from './stripe'
import type { PaymentCrudUseCase } from './payment-crud'
import type { PaymentEventStore } from '../../../services/payment-gateway/payment-events'
import { webhookCompletedEntry, type AuditEntry } from './audit'
import type { PaymentDTO } from '../types'

export interface SettleWebhookDeps {
  stripe: StripeUseCase
  crud: PaymentCrudUseCase
  events: PaymentEventStore
  audit: (entry: AuditEntry) => Promise<void>
  onCompleted?: (payment: PaymentDTO) => Promise<void>
  // fix-refund-pos-card: checkout.session.expired — la sesión se agotó sin cobrar. Simétrico a
  // onCompleted, pero para el payment que quedó `cancelled` en vez de `completed`.
  onExpired?: (payment: PaymentDTO) => Promise<void>
}

export type SettleWebhookResult = { type: string; paymentId?: string } | null

/**
 * `hotelId` viene en la RUTA, no en el body: para verificar la firma hay que saber de qué hotel
 * es el secreto ANTES de confiar en el contenido. Devuelve null si la firma no valida → 400 y no
 * se mueve un peso.
 */
export async function settleStripeWebhook(
  deps: SettleWebhookDeps,
  hotelId: string,
  payload: Buffer | string,
  signature: string,
): Promise<SettleWebhookResult> {
  const outcome = await deps.stripe.handleWebhook(hotelId, payload, signature)
  if (!outcome) return null // firma inválida o evento que no nos interesa

  if (outcome.status === 'paid' && outcome.reference) {
    const paymentId = outcome.reference

    const result = await deps.events.settleOnce(
      hotelId, 'stripe', outcome.eventId,
      { providerRef: outcome.providerRef, reference: paymentId, status: 'paid',
        amountMinor: outcome.amountMinor, currency: outcome.currency },
      async () => {
        await deps.crud.updateStatus(paymentId, 'completed', outcome.providerRef || '')
        const payment = await deps.crud.getById(paymentId)
        await deps.audit(webhookCompletedEntry(payment))
        await deps.onCompleted?.(payment)
      },
    )
    if (result.outcome === 'duplicate') return { type: 'already_processed', paymentId }
    return { type: 'payment_completed', paymentId }
  }

  // fix-refund-pos-card: checkout.session.expired — mismo mecanismo de idempotencia (settleOnce),
  // status distinto ('expired' en vez de 'paid') y efecto distinto (cancelled + onExpired en vez de
  // completed + onCompleted). NO toca el path 'paid' de arriba.
  if (outcome.status === 'expired' && outcome.reference) {
    const paymentId = outcome.reference

    const result = await deps.events.settleOnce(
      hotelId, 'stripe', outcome.eventId,
      { providerRef: outcome.providerRef, reference: paymentId, status: 'expired',
        amountMinor: outcome.amountMinor, currency: outcome.currency },
      async () => {
        await deps.crud.updateStatus(paymentId, 'cancelled')
        const payment = await deps.crud.getById(paymentId)
        await deps.onExpired?.(payment)
      },
    )
    if (result.outcome === 'duplicate') return { type: 'already_processed', paymentId }
    return { type: 'payment_expired', paymentId }
  }

  return { type: outcome.status }
}
