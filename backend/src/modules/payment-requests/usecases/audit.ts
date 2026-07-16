// payment-requests/usecases/audit.ts — Puerto de auditoría de las solicitudes de pago (SC-05).
//
// El módulo NO importa auditlog: declara el puerto y el connector `payment-requests-auditlog`
// inyecta la implementación (regla del framework, sin imports cross-módulo).
//
// Se audita: el borrado de una solicitud, todo cambio de estado hecho a mano (marcarla pagada o
// cancelada sin pasar por Stripe es la forma más fácil de "perdonar" una deuda) y la confirmación
// del webhook. Auditar nunca puede tumbar la operación (`auditSafely`).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'
import type { PaymentRequestDTO } from '../types'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

export type Actor = { id?: string; role?: string } | undefined

/** Estados que cambian el saldo debido de la reserva: marcarlos a mano necesita rastro. */
const SENSITIVE_STATUS = new Set(['paid', 'cancelled', 'expired', 'refunded'])

export function isSensitiveStatus(status?: string): boolean {
  return !!status && SENSITIVE_STATUS.has(status)
}

const money = (pr: PaymentRequestDTO): string => `${Number(pr.amount || 0).toFixed(2)} ${pr.currency || 'USD'}`

export function deleteEntry(pr: PaymentRequestDTO, actor: Actor): AuditEntry {
  return {
    hotelId: pr.hotelId,
    userId: actor?.id,
    action: 'payment_request.delete',
    entity: 'payment_request',
    entityId: pr.id,
    detail: `Solicitud de pago borrada · ${money(pr)} · estado ${pr.status}` +
      `${pr.reservationId ? ` · reserva ${String(pr.reservationId).slice(0, 8)}` : ''}`,
  }
}

/** Cambio de estado manual (desde el panel, sin Stripe). */
export function statusChangeEntry(pr: PaymentRequestDTO, previous: string, actor: Actor): AuditEntry {
  return {
    hotelId: pr.hotelId,
    userId: actor?.id,
    action: `payment_request.${pr.status}`,
    entity: 'payment_request',
    entityId: pr.id,
    detail: `Solicitud de pago marcada "${pr.status}" a mano (antes "${previous}") · ${money(pr)}`,
  }
}

/** Lo dispara Stripe, no un usuario: queda sin userId a propósito. */
export function webhookPaidEntry(pr: PaymentRequestDTO, amountPaid: number): AuditEntry {
  return {
    hotelId: pr.hotelId,
    action: 'payment_request.paid',
    entity: 'payment_request',
    entityId: pr.id,
    detail: `Solicitud de pago confirmada por Stripe (webhook) · ${amountPaid.toFixed(2)} ${pr.currency || 'USD'}`,
  }
}

/**
 * Cobro fallido reportado por Stripe (`payment_intent.payment_failed`). Sin userId: lo dispara
 * Stripe, no un usuario. hotelId sale del metadata del intent con fallback al hotel de la ruta
 * (que es quien autentica el webhook), así el rastro nunca queda sin tenant.
 */
export function webhookFailedEntry(hotelId: string, intent: any): AuditEntry {
  const amount = Math.abs(Number(intent?.amount ?? 0)) / 100
  const currency = String(intent?.currency ?? 'usd').toUpperCase()
  const reason = intent?.last_payment_error?.message || intent?.cancellation_reason || 'motivo desconocido'
  const paymentRequestId = intent?.metadata?.paymentRequestId
  return {
    hotelId: intent?.metadata?.hotelId || hotelId,
    action: 'payment_request.payment_failed',
    entity: 'payment_request',
    entityId: paymentRequestId || intent?.id,
    detail: `Cobro Stripe fallido · ${amount.toFixed(2)} ${currency} · intent ${String(intent?.id || '').slice(0, 16)} · ${reason}`,
  }
}

/** El merchant abrió una sesión de checkout de Stripe para cobrar la solicitud (rastro del cobro iniciado). */
export function checkoutSessionCreatedEntry(pr: PaymentRequestDTO, sessionId: string, actor: Actor): AuditEntry {
  return {
    hotelId: pr.hotelId,
    userId: actor?.id,
    action: 'payment_request.checkout_session_created',
    entity: 'payment_request',
    entityId: pr.id,
    detail: `Sesión de checkout Stripe creada · ${money(pr)} · sesión ${String(sessionId).slice(0, 20)}`,
  }
}
