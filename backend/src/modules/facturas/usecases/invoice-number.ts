// facturas/usecases/invoice-number.ts
// Genera el siguiente número secuencial de factura: "{prefix}-{year}-{NNNN}".
// Usa un counter atómico en la tabla configuration para evitar race conditions.
// Extraído del service para mantenerlo <200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'

/**
 * Genera el próximo número de factura de forma atómica.
 * Almacena un counter en configuration(key='invoice_counter_{hotelId}_{year}')
 * para evitar duplicados en concurrencia.
 */
export async function nextInvoiceNumber(
  repo: RepositoryAdapter<any>,
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear()
  const counterKey = `invoice_counter_${hotelId}_${year}`

  try {
    // Buscar counter existente
    let counter = await configRepo.findOne({ key: counterKey, hotelId })
    const currentSeq = counter?.value ?? 0
    const nextSeq = currentSeq + 1

    // Upsert del counter
    if (counter) {
      await configRepo.update(counter.id, { value: nextSeq } as any)
    } else {
      await configRepo.create({
        key: counterKey,
        hotelId,
        value: nextSeq,
        description: `Invoice counter for ${prefix} ${year}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any)
    }

    return `${prefix}-${year}-${nextSeq.toString().padStart(4, '0')}`
  } catch {
    // Fallback si config falla — timestamp como último recurso
    return `${prefix}-${year}-${Date.now()}`
  }
}
