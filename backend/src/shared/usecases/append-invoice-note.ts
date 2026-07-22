// shared/usecases/append-invoice-note.ts — Appendea el aviso de "factura pagada" a las notas de la
// reserva. La dispara el connector facturas-reservas desde onFacturasUpdated. Vive acá (no en el
// connector) porque los connectors solo deben WIREAR.

interface ReservasPort {
  getById: (id: string, user: any) => Promise<any>
  update: (id: string, data: any, user: any) => Promise<any>
}

export async function appendInvoiceNoteToReservation(reservas: ReservasPort, factura: any): Promise<void> {
  // Solo si la factura tiene reserva vinculada y cambió a pagada.
  if (!factura?.reservationId || factura.status !== 'paid') return

  // Actor de sistema: el update lo dispara el pago de una factura, no un usuario del panel.
  // role 'super_admin' bypassa el ownership check (reservas/usecases/crud.ts:46,95).
  const sysUser = { id: 'system', role: 'super_admin', hotelId: factura.hotelId }

  // Appendea preservando notas previas del huésped/habitación (NO las pisa). Antes leía de
  // `(ctx as any).orm` (inexistente en ConnectorContext) → prevNotes siempre vacío; ahora usa el
  // método público reservas.getById.
  const prev = await reservas.getById(factura.reservationId, sysUser).catch(() => null)
  const prevNotes = String(prev?.notes ?? '').trim()
  const note = `Factura ${factura.invoiceNumber} pagada — $${factura.amount} ${factura.currency}`
  const notes = prevNotes ? `${prevNotes}\n${note}` : note

  // BUG FIX: antes se llamaba update(id, dto) con 2 args; el 3ro (currentUser) es obligatorio y su
  // ausencia lanzaba TypeError (currentUser.id) que el catch del connector tragaba → la reserva
  // NUNCA se actualizaba (connector no-op silencioso).
  await reservas.update(factura.reservationId, { notes }, sysUser)
}
