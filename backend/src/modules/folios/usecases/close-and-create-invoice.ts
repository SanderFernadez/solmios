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
  /**
   * Compensación: vuelve el folio a `open` si la factura falla después del cierre. Opcional para
   * no romper callers viejos — sin ella el folio queda cerrado y sin factura, que es justamente
   * el estado trabado que esto viene a evitar (se avisa por log).
   */
  reopenFolio?(folioId: string, user: CurrentUser): Promise<unknown>
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

  // Son tres escrituras sin transacción común (folio y factura viven en módulos distintos y se
  // cruzan por connector). Si la factura falla DESPUÉS del cierre, el folio queda cerrado y sin
  // factura — y como cerrar exige `status === 'open'`, no hay forma de reintentar: el folio queda
  // trabado y hay que tocar la base a mano. Por eso se compensa reabriéndolo, y se propaga el
  // error ORIGINAL (el usuario tiene que ver por qué falló la factura, no un error de rollback).
  let invoice: IssuedInvoice
  try {
    invoice = await deps.port.createInvoice(invoiceData, user)
  } catch (e: any) {
    try {
      await deps.reopenFolio?.(folioId, user)
    } catch (reopenErr: any) {
      deps.logger.warn('No se pudo reabrir el folio tras fallar la factura — revisar a mano', {
        folioId, error: reopenErr?.message,
      })
    }
    throw e
  }

  // Acá la factura YA existe. Reabrir el folio dejaría una factura huérfana y, al reintentar, se
  // emitiría una SEGUNDA por la misma estadía (y el numerador fiscal no se puede reusar). Se deja
  // cerrado y se avisa: es reconciliación manual, no reintento automático.
  let linked: FolioDTO
  try {
    linked = await deps.setInvoice(folio.id, invoice.id, user)
  } catch (e: any) {
    deps.logger.warn('Folio cerrado y facturado pero SIN vincular — reconciliar a mano', {
      folioId, invoiceId: invoice.id, error: e?.message,
    })
    throw e
  }
  deps.logger.info('Folio cerrado y facturado', {
    folioId: folio.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoiceData.amount,
    items: invoiceData.items?.length ?? 0,
  })
  return { folio: linked, invoice }
}
