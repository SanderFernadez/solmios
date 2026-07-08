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

export async function settleFolioAtCheckout(
  folios: any,
  facturas: any,
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
  const { folio: closedFolio, invoice } = await folios.closeAndCreateInvoice(folio.id, user)

  let amountPaid = 0
  if (settle && settle.amount > 0) {
    await facturas.pay(invoice.id, {
      amount: settle.amount,
      method: settle.method,
      reference: settle.reference,
    }, user)
    amountPaid = settle.amount
  }

  return {
    folioId: closedFolio?.id || folio.id,
    invoiceId: invoice.id,
    balance: (invoice.amount ?? 0) - amountPaid,
    amountPaid,
    invoiceNumber: invoice.invoiceNumber || '',
  }
}
