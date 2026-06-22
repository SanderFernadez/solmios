// facturas/usecases/invoice-number.ts
// Genera el siguiente número secuencial de factura: "{prefix}-{year}-{NNNN}".
// Extraído del service para mantenerlo <200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FacturasDTO } from '../types'

/**
 * Extrae el sufijo numérico más alto del formato "{prefix}-{year}-{NNNN}" entre las facturas
 * reales (type 'invoice') del hotel y devuelve el siguiente. Fallback a timestamp si falla.
 */
export async function nextInvoiceNumber(
  repo: RepositoryAdapter<FacturasDTO>,
  hotelId: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear()
  try {
    const invoices = await repo.findMany({ hotelId, type: 'invoice' })
    const safePrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${safePrefix}-${year}-(\\d+)$`)
    const maxSeq = invoices.reduce((max, inv: any) => {
      const m = re.exec(String(inv.invoiceNumber || ''))
      return m ? Math.max(max, Number(m[1])) : max
    }, 0)
    return `${prefix}-${year}-${(maxSeq + 1).toString().padStart(4, '0')}`
  } catch {
    return `${prefix}-${year}-${Date.now()}`
  }
}
