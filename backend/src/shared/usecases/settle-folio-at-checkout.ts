export interface SettleFolioParams {
  reservationId: string
  hotelId: string
  guestId: string | null
  roomId: string | null
  settle?: {
    amount: number
    method: string
    reference?: string
  } | null
}

export interface SettleFolioResult {
  folioId: string
  invoiceId: string | null
  balance: number
  amountPaid: number
  invoiceNumber: string | null
}

/**
 * Liquida la estadía al hacer check-out.
 *
 * El dinero se asienta UNA sola vez: `folios.applyPayment` lo registra en `payments` (caja +
 * conciliación) y la factura emitida al cerrar el folio hereda ese monto como `amountPaid`.
 * Ya no recibe `facturas`: la emisión la hace `folios.closeAndCreateInvoice` vía connector.
 */
export async function settleFolioAtCheckout(
  folios: any,
  params: SettleFolioParams,
  user: any,
): Promise<SettleFolioResult> {
  const { reservationId, hotelId, guestId, roomId, settle } = params

  const foliosList = await folios.list({ reservationId, status: 'open' }, user)
  let folio = foliosList.data?.[0]

  if (!folio) {
    folio = await folios.open({ hotelId, reservationId, guestId, roomId }, user)
  }

  if (settle && settle.amount > 0) {
    await folios.applyPayment(folio.id, {
      amount: settle.amount,
      method: settle.method,
      reference: settle.reference,
    }, user)
  }

  const balance = await folios.getBalance(folio.id, user)
  if (balance <= 0) {
    await folios.close(folio.id, user)
    return {
      folioId: folio.id,
      invoiceId: null,
      balance: 0,
      amountPaid: settle?.amount || 0,
      invoiceNumber: null,
    }
  }

  // Cierra el folio, emite la factura y las vincula. Un solo paso del lado del servicio.
  // El pago ya se posteó con `folios.applyPayment`, que asienta el dinero en `payments`. La factura
  // hereda ese monto como `amountPaid`. NO se llama a `facturas.pay()`: registraría el mismo dinero
  // una segunda vez en caja y conciliación.
  const { folio: closedFolio, invoice } = await folios.closeAndCreateInvoice(folio.id, user)

  const amountPaid = settle?.amount || 0

  return {
    folioId: closedFolio?.id || folio.id,
    invoiceId: invoice.id,
    balance: Math.max(0, (invoice.amount ?? 0) - amountPaid),
    amountPaid,
    invoiceNumber: invoice.invoiceNumber || '',
  }
}
