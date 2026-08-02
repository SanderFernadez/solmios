// facturas/usecases/policy-text.ts
// Lee el texto de políticas de cancelación/reembolso que el hotel configuró para imprimir en la factura.

import type { RepositoryAdapter } from 'arckode-framework'

/**
 * Devuelve el texto de políticas de cancelación y reembolso del hotel
 * (configuration key='invoice_policy_text'). undefined si no hay texto configurado.
 */
export async function getInvoicePolicyText(
  configRepo: RepositoryAdapter<any>,
  hotelId: string,
): Promise<string | undefined> {
  try {
    const row = await configRepo.findOne({ key: 'invoice_policy_text', hotelId })
    const val = row?.value
    return (typeof val === 'string' && val.trim()) ? val.trim() : undefined
  } catch {
    return undefined
  }
}
