// payments/usecases/charge-card.ts — Cobro con tarjeta vía Stripe Checkout.
//
// Orden que importa: el payment se asienta ANTES de abrir la sesión de Stripe, así el cobro
// queda registrado aunque el huésped abandone el checkout (el estado 'processing' lo refleja).
// Si Stripe no está configurado, falla explícito: cobrar con tarjeta sin proveedor no es un
// caso silencioso.

import { ValidationError } from 'arckode-framework'
import type { ChargeCardDTO, CreatePaymentDTO, PaymentDTO } from '../types'
import type { StripeUseCase } from './stripe'
import type { PaymentCrudUseCase } from './payment-crud'

export interface ChargeCardDeps {
  stripe: StripeUseCase
  crud: PaymentCrudUseCase
  createPayment: (dto: CreatePaymentDTO) => Promise<PaymentDTO>
}

export async function chargeCard(
  deps: ChargeCardDeps,
  dto: ChargeCardDTO,
): Promise<{ payment: PaymentDTO; checkoutUrl: string }> {
  const payment = await deps.createPayment({
    hotelId: dto.hotelId,
    type: 'charge',
    method: 'card',
    amount: dto.amount,
    currency: dto.currency,
    description: dto.description,
    folioId: dto.folioId,
    guestId: dto.guestId,
  } as CreatePaymentDTO)

  // La pasarela se resuelve para ESTE hotel: cobra contra su cuenta, no contra una global.
  if (!(await deps.stripe.isConfigured(dto.hotelId))) {
    throw new ValidationError('El hotel no tiene pasarela de pago configurada — usá efectivo o transferencia')
  }

  const session = await deps.stripe.createCheckoutSession({
    hotelId: dto.hotelId,
    amount: dto.amount,
    currency: dto.currency ?? 'USD',
    description: dto.description,
    reference: payment.id,
    metadata: { paymentId: payment.id, hotelId: dto.hotelId },
    successUrl: dto.successUrl,
    cancelUrl: dto.cancelUrl,
  })

  await deps.crud.updateStatus(payment.id, 'processing')

  return { payment, checkoutUrl: session.url }
}
