// facturas/tests/email-invoice.test.ts — Tests del envío de factura por email.
import { describe, it, expect } from 'bun:test'
import { sendInvoiceByEmail, type InvoiceEmailPort } from '../usecases/email-invoice'
import type { FacturasDTO } from '../types'

const makePort = (capture: { last: any }): InvoiceEmailPort => ({
  enqueue: async (input) => { capture.last = input; return 'msg-id-1' },
  isConfigured: async () => true,
})

describe('sendInvoiceByEmail', () => {
  it('encola el email con subject y html correctos y retorna configured:true', async () => {
    const capture = { last: null as any }
    const port = makePort(capture)
    const invoice = { id: 'inv1', invoiceNumber: 'INV-2026-0001', type: 'invoice', hotelId: 'h1', amount: 120 } as FacturasDTO
    const result = await sendInvoiceByEmail({ invoice, to: 'guest@test.com', emailPort: port })

    expect(result.sent).toBe(true)
    expect(result.configured).toBe(true)
    expect(result.messageId).toBe('msg-id-1')
    expect(result.to).toBe('guest@test.com')
    expect(capture.last.to).toBe('guest@test.com')
    expect(capture.last.hotelId).toBe('h1')
    expect(capture.last.subject).toContain('INV-2026-0001')
    expect(capture.last.html).toContain('INV-2026-0001')
  })

  it('usa el nombre del hotel resuelto en subject y html', async () => {
    const capture = { last: null as any }
    const port = makePort(capture)
    const hotelRepo = { findById: async () => ({ id: 'h1', name: 'Caribe Paradise' }) } as any
    const invoice = { id: 'inv1', invoiceNumber: 'INV-X', type: 'invoice', hotelId: 'h1', amount: 10 } as FacturasDTO
    await sendInvoiceByEmail({ invoice, to: 'g@t.com', hotelRepo, emailPort: port })
    expect(capture.last.subject).toContain('Caribe Paradise')
  })
})
