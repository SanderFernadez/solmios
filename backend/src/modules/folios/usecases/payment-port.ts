// folios/usecases/payment-port.ts — Puerto hacia el módulo de pagos.
//
// Postear un pago al folio escribe DOS cosas, con roles distintos:
//   1. una línea en `folio_charges` (kind='payment') → libro auxiliar, calcula el saldo del folio
//   2. una fila en `payments`                        → asiento del dinero: caja y conciliación
//
// La primera ya existía. La segunda faltaba, así que un pago en efectivo contra el folio nunca
// entraba al arqueo de caja. Ver openspec/changes/billing-money-consolidation.
//
// `folios` no importa `payments`: el connector `folios-payments` inyecta la implementación.

import type { Logger } from 'arckode-framework'

export type CanonicalMethod = 'card' | 'cash' | 'transfer' | 'link' | 'deposit' | 'other'

export interface RecordFolioPaymentInput {
  hotelId: string
  folioId: string
  guestId?: string | null
  amount: number
  currency: string
  method: CanonicalMethod
  reference?: string
  description?: string
}

export interface FolioPaymentPort {
  recordPayment(input: RecordFolioPaymentInput): Promise<{ id: string; status: string }>
}

const METHOD_ALIASES: Record<string, CanonicalMethod> = {
  card: 'card', tarjeta: 'card', 'credit card': 'card', credito: 'card', crédito: 'card',
  cash: 'cash', efectivo: 'cash', contado: 'cash',
  transfer: 'transfer', transferencia: 'transfer', wire: 'transfer',
  link: 'link', 'link de pago': 'link', 'payment link': 'link',
  deposit: 'deposit', deposito: 'deposit', depósito: 'deposit',
  other: 'other', otro: 'other',
}

/** El método llega con etiquetas heredadas ("Efectivo"); `payments.method` es un enum cerrado. */
export function normalizeFolioPaymentMethod(method: string | null | undefined): CanonicalMethod {
  if (!method) return 'other'
  return METHOD_ALIASES[String(method).trim().toLowerCase()] ?? 'other'
}

/**
 * NO es best-effort: si el dinero no se puede asentar, el pago entero falla. Un pago que baja el
 * saldo del folio pero no aparece en caja es peor que un pago rechazado.
 */
export async function recordFolioPayment(
  port: FolioPaymentPort | null,
  logger: Logger,
  input: RecordFolioPaymentInput,
): Promise<{ id: string; status: string } | null> {
  if (!port) {
    logger.warn('Pago de folio sin asentar: el conector folios-payments no está registrado', {
      folioId: input.folioId, amount: input.amount,
    })
    return null
  }
  const payment = await port.recordPayment(input)
  logger.info('Pago de folio registrado en payments', {
    paymentId: payment.id, folioId: input.folioId, amount: input.amount, method: input.method,
  })
  return payment
}
