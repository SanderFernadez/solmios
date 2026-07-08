// facturas/usecases/create-invoice.ts — Alta de factura / cargo / comprobante de pago.
// Extraído del service para mantenerlo < 200 líneas.
//
// `dto.amount` es la BASE (subtotal). Solo el tipo `invoice` aplica impuestos y consume el
// numerador fiscal; los demás tipos (payment/folio) llevan número correlativo por timestamp.

import type { RepositoryAdapter, Logger } from 'arckode-framework'
import type { FacturasDTO, CreateFacturasDTO } from '../types'
import { taxRateFor, applyTax, buildInvoiceRecord } from './billing'
import { nextInvoiceNumber } from './invoice-number'
import { persistItems, assertItemsSum } from './invoice-items'

const PREFIX_BY_TYPE: Record<string, string> = { payment: 'PAY', folio: 'CHG' }

export interface CreateInvoiceDeps {
  repo: RepositoryAdapter<FacturasDTO>
  configRepo: RepositoryAdapter<any>
  itemRepo: RepositoryAdapter<any>
  logger: Logger
}

export interface CreateInvoiceResult {
  item: FacturasDTO
  invoiceNumber: string
  amount: number
  currency: string
}

export async function createInvoice(
  deps: CreateInvoiceDeps,
  dto: CreateFacturasDTO,
  hotelId: string,
): Promise<CreateInvoiceResult> {
  const { repo, configRepo, itemRepo, logger } = deps
  logger.info('Creando factura/cargo/pago', { type: dto.type, hotelId })

  const type = dto.type ?? 'invoice'
  const base = Number(dto.amount) || 0
  let taxes = 0
  let amount = base
  let invoiceNumber = dto.invoiceNumber
  let ncf = dto.ncf

  if (type === 'invoice') {
    const rate = await taxRateFor(configRepo, hotelId)
    const t = applyTax(base, rate)
    taxes = t.tax
    amount = t.total
    if (!invoiceNumber) invoiceNumber = await nextInvoiceNumber(repo, configRepo, hotelId, 'INV')
    // ⚠ El NCF se asigna siempre, incluso sin facturación electrónica activa. Ver usecases/fiscal.ts
    // (buildNcf) — cablearlo a configuration(key='electronic_invoicing') está pendiente.
    if (!ncf) ncf = `NCF-${invoiceNumber}`
  } else if (!invoiceNumber) {
    invoiceNumber = `${PREFIX_BY_TYPE[type] ?? 'DOC'}-${Date.now()}`
  }

  if (dto.items?.length) assertItemsSum(dto.items, base)
  const record = buildInvoiceRecord({ hotelId, type, taxes, amount, invoiceNumber, ncf: ncf ?? null, dto })
  const item = await repo.create(record as any)
  if (dto.items?.length) await persistItems(itemRepo, item.id, hotelId, dto.items)

  logger.info('Factura creada', { id: item.id, invoiceNumber, type, amount, taxes, hotelId })
  return { item, invoiceNumber, amount, currency: record.currency }
}
