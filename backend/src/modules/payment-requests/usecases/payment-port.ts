// payment-requests/usecases/payment-port.ts — Puerto hacia el módulo de pagos.
//
// Un cobro por Stripe Checkout escribe TRES cosas, con roles distintos:
//   1. `payment_requests.status = 'paid'`   → estado de la solicitud
//   2. reserva + línea en `folio_charges`   → libro auxiliar: baja el saldo del huésped
//   3. una fila en `payments`               → asiento del dinero: conciliación bancaria
//
// La tercera faltaba: el webhook parcheaba reserva y folio con repos crudos, así que un cobro por
// Stripe nunca aparecía en `payments` y quedaba invisible para la conciliación. (Deuda F10.)
//
// No impacta caja: `payments-caja` solo asienta el efectivo. Un cobro Stripe ya está bancarizado.
//
// `payment-requests` no importa `payments`: el conector `payment-requests-payments` inyecta la
// implementación.

import type { Logger } from 'arckode-framework'

export interface RecordStripePaymentInput {
  hotelId: string
  amount: number
  currency: string
  /** Sesión de Checkout: identidad del cobro, y clave de deduplicación entre reintentos. */
  stripeSessionId: string
  stripePaymentId?: string
  folioId?: string
  description?: string
  reference?: string
}

export interface RecordedPayment {
  id: string
  status: string
}

export interface StripePaymentPort {
  recordPayment(input: RecordStripePaymentInput): Promise<RecordedPayment>
  findBySession(hotelId: string, stripeSessionId: string): Promise<RecordedPayment | null>
}

export interface RecordStripePaymentResult {
  payment: RecordedPayment | null
  /** true si el cobro ya estaba asentado: es un reintento del webhook, no un cobro nuevo. */
  alreadyRecorded: boolean
}

/**
 * NO es best-effort: si el dinero no se puede asentar, el webhook falla y Stripe reintenta. Un cobro
 * que baja el saldo del folio pero no aparece en la conciliación es peor que un webhook fallido.
 */
export async function recordStripePayment(
  port: StripePaymentPort | null,
  logger: Logger,
  input: RecordStripePaymentInput,
): Promise<RecordStripePaymentResult> {
  if (!port) {
    logger.warn('Cobro Stripe sin asentar: el conector payment-requests-payments no está registrado', {
      stripeSessionId: input.stripeSessionId, amount: input.amount,
    })
    return { payment: null, alreadyRecorded: false }
  }

  const existing = await port.findBySession(input.hotelId, input.stripeSessionId)
  if (existing) {
    logger.info('Cobro Stripe ya asentado, se omite', { paymentId: existing.id, stripeSessionId: input.stripeSessionId })
    return { payment: existing, alreadyRecorded: true }
  }

  const payment = await port.recordPayment(input)
  logger.info('Cobro Stripe registrado en payments', {
    paymentId: payment.id, stripeSessionId: input.stripeSessionId, amount: input.amount,
  })
  return { payment, alreadyRecorded: false }
}
