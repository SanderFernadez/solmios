// Tests de appendInvoiceNoteToReservation — el bug era: update() se llamaba con 2 args (faltaba
// currentUser) → TypeError tragado → no-op silencioso. Estos tests lo blindan.
import { describe, it, expect } from 'bun:test'
import { appendInvoiceNoteToReservation } from '../append-invoice-note'

function makeReservas(prevNotes?: string) {
  const calls: Array<{ id: string; data: any; user: any }> = []
  return {
    calls,
    port: {
      getById: async (_id: string, _user: any) => ({ id: _id, notes: prevNotes ?? '' }),
      update: async (id: string, data: any, user: any) => { calls.push({ id, data, user }); return { id, ...data } },
    },
  }
}
const factura = (over: any = {}) => ({ reservationId: 'r1', status: 'paid', hotelId: 'h1', invoiceNumber: 'INV-001', amount: 100, currency: 'USD', ...over })

describe('appendInvoiceNoteToReservation', () => {
  it('actualiza la reserva con currentUser (3er arg) — el bug del no-op', async () => {
    const { port, calls } = makeReservas()
    await appendInvoiceNoteToReservation(port, factura())
    expect(calls).toHaveLength(1)
    expect(calls[0].id).toBe('r1')
    expect(calls[0].user).toBeDefined()            // el 3er arg NO es undefined (antes crasheaba)
    expect(calls[0].user.role).toBe('super_admin')  // bypassa ownership
    expect(calls[0].data.notes).toContain('INV-001')
  })

  it('appendea preservando las notas previas (no las pisa)', async () => {
    const { port, calls } = makeReservas('Huésped alérgico al maní')
    await appendInvoiceNoteToReservation(port, factura())
    expect(calls[0].data.notes).toBe('Huésped alérgico al maní\nFactura INV-001 pagada — $100 USD')
  })

  it('no hace nada si la factura no está pagada', async () => {
    const { port, calls } = makeReservas()
    await appendInvoiceNoteToReservation(port, factura({ status: 'pending' }))
    expect(calls).toHaveLength(0)
  })

  it('no hace nada si la factura no tiene reserva vinculada', async () => {
    const { port, calls } = makeReservas()
    await appendInvoiceNoteToReservation(port, factura({ reservationId: null }))
    expect(calls).toHaveLength(0)
  })
})
