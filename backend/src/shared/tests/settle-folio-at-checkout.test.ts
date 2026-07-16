import { describe, it, expect } from 'bun:test'
import { settleFolioAtCheckout } from '../usecases/settle-folio-at-checkout'

// QA-01 (#293): settlement al check-out. El dinero se asienta UNA vez (applyPayment → payments);
// la factura se emite al cerrar el folio y hereda el monto como amountPaid.
function makeFolios(opts: { existingFolio?: any; balanceAfter: number; invoiceAmount?: number }) {
  const calls: Record<string, any[]> = { applyPayment: [], close: [], closeAndCreateInvoice: [], open: [] }
  const folios = {
    list: async () => ({ data: opts.existingFolio ? [opts.existingFolio] : [] }),
    open: async (d: any) => { const f = { id: 'f1', ...d, status: 'open' }; calls.open.push(f); return f },
    applyPayment: async (id: string, p: any) => { calls.applyPayment.push({ id, ...p }) },
    getById: async (id: string) => ({ id, balance: opts.balanceAfter }),
    close: async (id: string) => { calls.close.push(id); return { id, status: 'closed' } },
    closeAndCreateInvoice: async (id: string) => {
      calls.closeAndCreateInvoice.push(id)
      return { folio: { id, status: 'closed' }, invoice: { id: 'inv1', amount: opts.invoiceAmount ?? 100, invoiceNumber: 'A-001' } }
    },
  }
  return { folios, calls }
}

const user = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }
const base = { reservationId: 'r1', hotelId: 'h1', guestId: 'g1', roomId: 'rm1' }

describe('settleFolioAtCheckout (QA-01)', () => {
  it('el pago cubre todo (balance ≤ 0): cierra el folio SIN factura', async () => {
    const { folios, calls } = makeFolios({ existingFolio: { id: 'f1', status: 'open' }, balanceAfter: 0 })
    const result = await settleFolioAtCheckout(folios, { ...base, settle: { amount: 100, method: 'cash' } }, user)
    expect(calls.applyPayment).toHaveLength(1)
    expect(calls.applyPayment[0].amount).toBe(100)
    expect(calls.close).toHaveLength(1)                 // se cierra directo
    expect(calls.closeAndCreateInvoice).toHaveLength(0) // sin factura
    expect(result.invoiceId).toBeNull()
    expect(result.amountPaid).toBe(100)
  })

  it('queda saldo (balance > 0): cierra Y emite factura con amountPaid heredado', async () => {
    const { folios, calls } = makeFolios({ existingFolio: { id: 'f1', status: 'open' }, balanceAfter: 50, invoiceAmount: 100 })
    const result = await settleFolioAtCheckout(folios, { ...base, settle: { amount: 50, method: 'card' } }, user)
    expect(calls.applyPayment).toHaveLength(1)
    expect(calls.closeAndCreateInvoice).toHaveLength(1) // emite factura (un solo paso)
    expect(calls.close).toHaveLength(0)                 // no usa close directo
    expect(result.invoiceId).toBe('inv1')
    expect(result.invoiceNumber).toBe('A-001')
    expect(result.balance).toBe(50)                     // 100 factura - 50 pagado
  })

  it('sin settle: no aplica pago', async () => {
    const { folios, calls } = makeFolios({ existingFolio: { id: 'f1', status: 'open' }, balanceAfter: 0 })
    const result = await settleFolioAtCheckout(folios, { ...base, settle: null }, user)
    expect(calls.applyPayment).toHaveLength(0)
    expect(result.invoiceId).toBeNull()
  })

  it('abre el folio si la reserva no tiene uno abierto', async () => {
    const { folios, calls } = makeFolios({ existingFolio: null, balanceAfter: 0 })
    const result = await settleFolioAtCheckout(folios, { ...base, settle: { amount: 100, method: 'cash' } }, user)
    expect(calls.open).toHaveLength(1)
    expect(result.folioId).toBe('f1')
  })
})
