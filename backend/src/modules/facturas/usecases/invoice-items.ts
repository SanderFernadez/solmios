// facturas/usecases/invoice-items.ts — Persistencia y carga de líneas de factura.
// Extraído del service para mantenerlo < 200 líneas (God Object check de arckode analyze).
import type { RepositoryAdapter } from 'arckode-framework'
import type { InvoiceItem, FacturasDTO } from '../types'

/** Persiste las líneas de factura en invoice_items (1 fila por item, con sortOrder). */
export async function persistItems(
  itemRepo: RepositoryAdapter<any>,
  invoiceId: string,
  hotelId: string,
  items: InvoiceItem[],
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const qty = Number(it.quantity) || 1
    const unit = Number(it.unitPrice) || (qty ? Number(it.amount) / qty : Number(it.amount)) || 0
    const amount = Number(it.amount) || qty * unit || 0
    await itemRepo.create({
      invoiceId, hotelId,
      description: String(it.description ?? ''),
      quantity: qty,
      unitPrice: unit,
      amount,
      sortOrder: typeof it.sortOrder === 'number' ? it.sortOrder : i,
    } as any)
  }
}

/** Adjunta las líneas persistidas al DTO. Si no hay items en tabla, devuelve la factura intacta
 *  (el template cae al fallback de parsear notes → compatibilidad con facturas previas). */
export async function attachItems(
  itemRepo: RepositoryAdapter<any>,
  invoice: FacturasDTO,
): Promise<FacturasDTO> {
  try {
    const rows = await itemRepo.findMany({ invoiceId: invoice.id })
    if (!rows.length) return invoice
    const items = (rows as any[]).map((r) => ({
      description: String(r.description ?? ''),
      amount: Number(r.amount) || 0,
      quantity: Number(r.quantity) || 1,
      unitPrice: Number(r.unitPrice) || 0,
    }))
    return { ...invoice, items }
  } catch {
    return invoice
  }
}

/** Consistencia financiera: la suma de items debe coincidir con el monto base (tolerancia 1 por redondeo). */
export function assertItemsSum(items: InvoiceItem[], base: number): void {
  const sum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  if (Math.abs(sum - base) > 1) {
    throw new Error(`Inconsistencia financiera: el monto (${base}) no coincide con la suma de los items (${sum})`)
  }
}

/** Borra las líneas de una factura (cascade manual — el FK de invoice_items no tiene ON DELETE CASCADE). */
export async function deleteItems(itemRepo: RepositoryAdapter<any>, invoiceId: string): Promise<void> {
  const rows = await itemRepo.findMany({ invoiceId })
  await Promise.all((rows as any[]).map((r) => itemRepo.delete(r.id)))
}
