// payment-requests/sockets.ts — Hooks OPCIONALES hacia otros módulos (conectores).
// El módulo funciona sin ellos. Un conector puede pasar sockets para reaccionar a eventos.
// F10 (futuro): onPaymentRequestPaid reemplazará el puente directo a Reservations/FolioCharges
// que hoy hace handleWebhook dentro del service (deuda: acceso cross-table vía repos).

import type { PaymentRequestDTO } from './types'

export interface PaymentRequestsSockets {
  onPaymentRequestCreated?: (data: PaymentRequestDTO) => Promise<void> | void
  onPaymentRequestUpdated?: (data: PaymentRequestDTO) => Promise<void> | void
  onPaymentRequestDeleted?: (id: string) => Promise<void> | void
  /** Se emite cuando el webhook Stripe marca un PaymentRequest como 'paid' (tras aplicar el pago). */
  onPaymentRequestPaid?: (data: PaymentRequestDTO) => Promise<void> | void
}
