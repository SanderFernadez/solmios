// facturas/usecases/payment-record.ts — Registro de comprobante de pago.
// Extraído del service para mantenerlo < 200 líneas.
//
// El comprobante `type: 'payment'` es el rastro del cobro, NO un ingreso adicional:
// la factura ya suma a los ingresos cuando pasa a `paid`. Por eso `usecases/stats.ts`
// contabiliza únicamente `type: 'invoice'` — sumar ambos duplicaba cada cobro.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO, PayFacturasDTO } from '../types'

export interface PaymentRecordLogger {
  info: (msg: string, ctx?: any) => void
  error: (msg: string, ctx?: any) => void
}

/**
 * Crea un registro de tipo 'payment' como comprobante del pago aplicado.
 * Best-effort: si falla, la factura ya quedó cobrada, así que se loguea como ERROR
 * (no warn) — hay un cobro sin comprobante y alguien tiene que reconciliarlo a mano.
 * Devuelve el id del comprobante, o null si no se pudo crear.
 */
export async function createPaymentRecord(
  repo: RepositoryAdapter<FacturasDTO>,
  invoice: FacturasDTO,
  dto: PayFacturasDTO,
  logger: PaymentRecordLogger,
): Promise<string | null> {
  const amount = Number(dto.amount) || Number(invoice.amount)
  try {
    const record = await repo.create({
      hotelId: invoice.hotelId,
      reservationId: invoice.reservationId ?? null,
      guestId: invoice.guestId ?? null,
      invoiceNumber: `PAY-${Date.now()}`,
      type: 'payment',
      amount,
      taxes: 0,
      currency: invoice.currency,
      status: 'paid',
      issueDate: new Date().toISOString().split('T')[0],
      paymentMethod: dto.method ?? null,
      notes: `Pago de ${invoice.invoiceNumber}${dto.reference ? ` | Ref: ${dto.reference}` : ''}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any)
    logger.info('Comprobante de pago registrado', {
      paymentId: record.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount,
    })
    return record.id
  } catch (e) {
    logger.error('Cobro sin comprobante: no se pudo registrar el pago', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      hotelId: invoice.hotelId,
      amount,
      method: dto.method ?? null,
      reference: dto.reference ?? null,
      error: (e as Error).message,
    })
    return null
  }
}
