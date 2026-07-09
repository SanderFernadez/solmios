// facturas/usecases/deletable.ts — Regla contable: qué factura se puede borrar.
//
// Una factura con efectos contables no se borra: se anula con una nota de crédito
// (POST /:id/credit-note). Borrarla deja el libro de ventas sin respaldo y abre un hueco
// en la correlatividad del numerador. Solo se elimina lo que nunca llegó a existir
// contablemente: una factura recién creada, sin cobros y sin comprobante fiscal emitido.
//
// ⚠ El NCF no sirve como criterio por sí solo: hoy `create()` asigna `NCF-{número}` a toda
// factura aunque el hotel no tenga facturación electrónica activa (ver usecases/fiscal.ts,
// que define buildNcf pero no está cableado). Por eso el criterio fiscal es la config
// `electronic_invoicing.enabled` del hotel, no la mera presencia del campo `ncf`.

import { ConflictError } from 'arckode-framework'
import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'

/** Estados en los que la factura ya produjo efectos contables. */
const ISSUED_STATUSES = new Set(['paid', 'overdue', 'cancelled'])

/** ¿El hotel emite comprobantes fiscales? Entonces ninguna factura suya es borrable. */
export async function isElectronicInvoicingEnabled(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<boolean> {
  try {
    const cfg = await configRepo.findOne({ hotelId, key: 'electronic_invoicing' })
    return Boolean(cfg?.value?.enabled)
  } catch {
    return false
  }
}

export function assertDeletable(invoice: FacturasDTO, fiscalEnabled: boolean): void {
  // Los comprobantes de pago y los cargos de folio no son documentos fiscales.
  if (invoice.type !== 'invoice') return

  const anular = 'Anulala con una nota de crédito.'

  if (fiscalEnabled) {
    throw new ConflictError(
      `La factura ${invoice.invoiceNumber} es un comprobante fiscal emitido (${invoice.ncf ?? 'sin NCF'}). ${anular}`,
    )
  }
  if (ISSUED_STATUSES.has(String(invoice.status))) {
    throw new ConflictError(
      `La factura ${invoice.invoiceNumber} está en estado "${invoice.status}" y no puede eliminarse. ${anular}`,
    )
  }
  if ((Number(invoice.amountPaid) || 0) > 0) {
    throw new ConflictError(
      `La factura ${invoice.invoiceNumber} tiene pagos aplicados. ${anular}`,
    )
  }
}
