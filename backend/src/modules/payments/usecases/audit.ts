// payments/usecases/audit.ts — Puerto de auditoría del dinero (SC-05).
//
// El módulo payments NO importa auditlog: declara el puerto y el connector `payments-auditlog`
// inyecta la implementación (regla del framework, sin imports cross-módulo).
//
// Acá se audita PLATA: cobros con tarjeta, reembolsos, y depósitos de garantía retenidos o
// devueltos. Cada una de esas operaciones mueve dinero de un huésped y hasta ahora no dejaba
// ningún rastro de QUIÉN la ejecutó. Auditar nunca puede tumbar el cobro: si el registro falla,
// se loguea y la operación sigue (`auditSafely`).

import type { AuditEntry, AuditPort } from '../../../shared/usecases/audit'
import type { PaymentDTO, DepositDTO } from '../types'

export type { AuditEntry, AuditPort }
export { auditSafely } from '../../../shared/usecases/audit'

const money = (amount: number, currency?: string): string => `${amount} ${currency ?? 'USD'}`

/** Actor de la operación. El webhook de Stripe no tiene usuario: lo ejecuta el proveedor. */
export type Actor = { id?: string; role?: string } | undefined

export function chargeEntry(payment: PaymentDTO, actor: Actor): AuditEntry {
  return {
    hotelId: payment.hotelId,
    userId: actor?.id,
    action: 'payment.charge',
    entity: 'payment',
    entityId: payment.id,
    detail: `Cobro con tarjeta · ${money(payment.amount, payment.currency)}` +
      `${payment.description ? ` · ${payment.description}` : ''}`,
  }
}

export function refundEntry(refunded: PaymentDTO, amount: number | undefined, actor: Actor): AuditEntry {
  const total = amount === undefined
  return {
    hotelId: refunded.hotelId,
    userId: actor?.id,
    action: 'payment.refund',
    entity: 'payment',
    entityId: refunded.id,
    detail: `Reembolso ${total ? 'total' : 'parcial'} · ${money(amount ?? refunded.amount, refunded.currency)}`,
  }
}

/** El webhook lo dispara Stripe, no un usuario: queda sin userId a propósito. */
export function webhookCompletedEntry(payment: PaymentDTO): AuditEntry {
  return {
    hotelId: payment.hotelId,
    action: 'payment.completed',
    entity: 'payment',
    entityId: payment.id,
    detail: `Pago confirmado por Stripe (webhook) · ${money(payment.amount, payment.currency)}`,
  }
}

export function depositRefundEntry(deposit: DepositDTO, actor: Actor): AuditEntry {
  return {
    hotelId: deposit.hotelId,
    userId: actor?.id,
    action: 'deposit.refund',
    entity: 'deposit',
    entityId: deposit.id,
    detail: `Depósito devuelto · ${money(deposit.amount, deposit.currency)}`,
  }
}

export function depositReleaseEntry(deposit: DepositDTO, actor: Actor): AuditEntry {
  return {
    hotelId: deposit.hotelId,
    userId: actor?.id,
    action: 'deposit.release',
    entity: 'deposit',
    entityId: deposit.id,
    detail: `Depósito liberado · ${money(deposit.amount, deposit.currency)}`,
  }
}
