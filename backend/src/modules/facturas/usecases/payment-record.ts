// facturas/usecases/payment-record.ts — Registro de comprobante de pago.
// Extraído del service para mantenerlo < 200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO, PayFacturasDTO } from '../types'

/**
 * Crea un registro de tipo 'payment' como comprobante del pago aplicado.
 * Best-effort: si falla, solo loggea (no bloquea el pago principal).
 */
export async function createPaymentRecord(
  repo: RepositoryAdapter<FacturasDTO>,
  invoice: FacturasDTO,
  dto: PayFacturasDTO,
  logger: { warn: (msg: string, ctx?: any) => void },
): Promise<void> {
  try {
    await repo.create({
      hotelId: invoice.hotelId,
      reservationId: invoice.reservationId ?? null,
      guestId: invoice.guestId ?? null,
      invoiceNumber: `PAY-${Date.now()}`,
      type: 'payment',
      amount: Number(dto.amount) || Number(invoice.amount),
      taxes: 0,
      currency: invoice.currency,
      status: 'paid',
      issueDate: new Date().toISOString().split('T')[0],
      paymentMethod: dto.method ?? null,
      notes: `Pago de ${invoice.invoiceNumber}${dto.reference ? ` | Ref: ${dto.reference}` : ''}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)
  } catch (e) {
    logger.warn('No se pudo registrar el comprobante de pago', { error: (e as Error).message })
  }
}
