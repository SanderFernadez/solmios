// folios/usecases/close-and-create-invoice.ts — Cierra el folio, emite la factura y las vincula.
//
// `close-and-invoice.ts` solo cierra el folio y devuelve los datos de la factura: quien lo
// llamaba tenía que crearla por su cuenta. El frontend lo hacía en dos requests, así que si la
// segunda fallaba el folio quedaba cerrado sin factura, y nunca se llamaba a `setInvoice`, por
// lo que `folio.invoiceId` quedaba en null (y el badge "✓ Facturado" nunca aparecía).
// Acá los tres pasos ocurren del lado del servidor.

import { ValidationError } from 'arckode-framework'
import type { Logger } from 'arckode-framework'
import type { FolioDTO, CurrentUser } from '../types'
import type { CloseAndInvoiceResult } from './close-and-invoice'

/** La factura emitida: `amount` es el TOTAL (subtotal + impuestos), no la base del folio. */
export interface IssuedInvoice {
  id: string
  invoiceNumber?: string
  amount?: number
}

/** Puerto de facturación. Lo inyecta el connector `folios-facturas` (folios no importa facturas). */
export interface FolioInvoicingPort {
  createInvoice(invoiceData: CloseAndInvoiceResult['invoiceData'], user: CurrentUser): Promise<IssuedInvoice>
}

export interface CloseAndCreateInvoiceResult {
  folio: FolioDTO
  invoice: IssuedInvoice
}

export interface CloseAndCreateInvoiceDeps {
  port: FolioInvoicingPort | null
  logger: Logger
  closeAndInvoice(folioId: string, user: CurrentUser): Promise<CloseAndInvoiceResult>
  setInvoice(folioId: string, invoiceId: string, user: CurrentUser): Promise<FolioDTO>
}

export async function closeAndCreateInvoice(
  deps: CloseAndCreateInvoiceDeps,
  folioId: string,
  user: CurrentUser,
): Promise<CloseAndCreateInvoiceResult> {
  if (!deps.port) {
    throw new ValidationError('Facturación no disponible: el conector folios-facturas no está registrado')
  }
  const { folio, invoiceData } = await deps.closeAndInvoice(folioId, user)
  const invoice = await deps.port.createInvoice(invoiceData, user)
  const linked = await deps.setInvoice(folio.id, invoice.id, user)
  deps.logger.info('Folio cerrado y facturado', {
    folioId: folio.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoiceData.amount,
    items: invoiceData.items?.length ?? 0,
  })
  return { folio: linked, invoice }
}
