// facturas/usecases/pay-invoice.ts — Aplicación de un pago sobre una factura.
// Extraído del service para mantenerlo < 200 líneas.
//
// Soporta pagos parciales: acumula `amountPaid` y solo pasa a `paid` cuando cubre el total.
// Además del update, deja un comprobante `type: 'payment'` (ver payment-record.ts) que es
// rastro contable, NO un ingreso extra — `stats.ts` solo suma documentos `type: 'invoice'`.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { NotFoundError } from 'arckode-framework'
import type { FacturasDTO, PayFacturasDTO } from '../types'
import { createPaymentRecord } from './payment-record'

export interface PayInvoiceResult {
  updated: FacturasDTO
  applied: number
  amountPaid: number
  balance: number
  status: string
}

export async function payInvoice(
  repo: RepositoryAdapter<FacturasDTO>,
  logger: Logger,
  invoice: FacturasDTO,
  dto: PayFacturasDTO,
): Promise<PayInvoiceResult> {
  const total = Number(invoice.amount) || 0
  const applied = Number(dto.amount) || total
  const amountPaid = (Number(invoice.amountPaid) || 0) + applied
  const status = amountPaid >= total ? 'paid' : 'pending'
  const balance = Math.max(0, total - amountPaid)

  const updated = await repo.update(invoice.id, {
    status,
    amountPaid,
    paymentMethod: dto.method ?? invoice.paymentMethod ?? null,
    notes: dto.notes ? `${invoice.notes ?? ''}\n${dto.notes}`.trim() : invoice.notes,
    updatedAt: new Date().toISOString(),
  } as any)
  if (!updated) throw new NotFoundError('Factura no encontrada')

  await createPaymentRecord(repo, invoice, dto, logger)

  logger.info('Pago aplicado a factura', {
    id: invoice.id, invoiceNumber: invoice.invoiceNumber, applied, amountPaid, total, balance, status,
  })

  return { updated, applied, amountPaid, balance, status }
}
