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

  // El balance y los cargos vienen del folio enriquecido (getById los computa). No hay getBalance().
  const folioAfterPayment = await folios.getById(folio.id, user)
  const chargesTotal = Number(folioAfterPayment?.chargesTotal ?? 0)

  // Folio sin cargos (roomRate 0 y sin extras): no hay nada que facturar → se cierra sin comprobante.
  if (chargesTotal <= 0) {
    await folios.close(folio.id, user)
    return {
      folioId: folio.id,
      invoiceId: null,
      balance: 0,
      amountPaid: settle?.amount || 0,
      invoiceNumber: null,
    }
  }

  // Con cargos, SIEMPRE se emite comprobante — haya o no saldo pendiente. Antes, si el pago saldaba
  // el folio (balance <= 0) se cerraba con `folios.close()` SIN factura, y una estadía pagada al 100%
  // quedaba sin comprobante para el huésped. `closeAndCreateInvoice` hereda el pago ya asentado
  // (`amountPaid = paymentsTotal`, close-and-invoice.ts) SIN volver a moverlo en caja/conciliación.
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
