// payments/usecases/refund.ts — Devolución de un cobro con tarjeta.
//
// Una devolución NO borra ni edita el cobro original: asienta un `payment` nuevo de tipo `refund`.
// El rastro de los dos movimientos es lo que permite conciliar contra el extracto del banco, donde
// el cobro y la devolución también figuran por separado.

import { ValidationError } from 'arckode-framework'
import type { PaymentDTO, CreatePaymentDTO } from '../types'
import type { PaymentCrudUseCase } from './payment-crud'
import type { StripeUseCase } from './stripe'

export interface RefundDeps {
  crud: PaymentCrudUseCase
  stripe: StripeUseCase
  createPayment(dto: CreatePaymentDTO): Promise<PaymentDTO>
}

export async function refundPayment(
  deps: RefundDeps,
  paymentId: string,
  amount?: number,
  user?: { id?: string; role?: string },
): Promise<PaymentDTO> {
  const payment = await deps.crud.getById(paymentId, user?.id, user?.role)
  if (payment.status !== 'completed') throw new ValidationError('Payment not completed')
  if (payment.method !== 'card') throw new ValidationError('Only card payments can be refunded via Stripe')
  // El reembolso sale de la cuenta DEL HOTEL que cobró, no de una cuenta global.
  if (!(await deps.stripe.isConfigured(payment.hotelId))) {
    throw new ValidationError('El hotel no tiene pasarela de pago configurada')
  }

  const refund = await deps.stripe.refund({
    hotelId: payment.hotelId,
    paymentId: payment.stripePaymentId,
    amount,
  })

  // El reembolso ya está confirmado por Stripe síncronamente (deps.stripe.refund retornó con
  // refund.id acá arriba), así que el documento de reembolso nace `completed`. Si cayera al default
  // (`pending` por method=card) nunca llegaría a `completed` — el webhook sólo actúa en `paid` (ver
  // settle-webhook.ts) — y entonces el cashFlow y los reportes (ambos filtran status==='completed')
  // no lo restarían → ingresos inflados: un cobro de 1000 con devolución de 1000 figuraba como 1000.
  const refundPaymentDoc = await deps.createPayment({
    hotelId: payment.hotelId,
    type: 'refund',
    method: 'card',
    status: 'completed',
    amount: amount ?? payment.amount,
    currency: payment.currency,
    description: `Refund for payment ${paymentId}`,
    reference: refund.id,
    folioId: payment.folioId,
    guestId: payment.guestId,
  })

  // Una devolución parcial deja el cobro original `completed`: todavía queda dinero retenido.
  if (!amount || amount >= payment.amount) {
    await deps.crud.updateStatus(paymentId, 'refunded')
  }

  return refundPaymentDoc
}
