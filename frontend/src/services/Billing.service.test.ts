import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./http', () => ({
  http: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBlob: vi.fn() },
}))

import { BillingService, mapInvoice, isDeletable } from './Billing.service'
import type { Invoice } from './Billing.service'
import { http } from './http'

describe('Billing.service — mapInvoice', () => {
  it('deriva subtotal, taxRate y balance cuando el backend no los manda', () => {
    // amount=113, taxes=13 → subtotal=100, taxRate=13%, balance=113 (nada pagado)
    const inv = mapInvoice({ id: 'i1', amount: 113, taxes: 13, invoiceNumber: 'A-1', type: 'invoice', status: 'pending' })
    expect(inv.total).toBe(113)
    expect(inv.tax).toBe(13)
    expect(inv.subtotal).toBe(100)
    expect(inv.taxRate).toBe(13)
    expect(inv.balance).toBe(113)
    expect(inv.number).toBe('A-1')
  })

  it('respeta subtotal/taxRate/balance explícitos del backend', () => {
    const inv = mapInvoice({ id: 'i2', total: 200, tax: 18, subtotal: 182, taxRate: 10, amountPaid: 50, balance: 150 })
    expect(inv.subtotal).toBe(182)
    expect(inv.taxRate).toBe(10)
    expect(inv.balance).toBe(150)
    expect(inv.amountPaid).toBe(50)
  })

  it('normaliza type/status en español a los enums en inglés', () => {
    const inv = mapInvoice({ id: 'i3', amount: 100, type: 'factura', status: 'pagado' })
    expect(inv.type).toBe('invoice')
    expect(inv.status).toBe('paid')
  })

  it('cae a defaults cuando type/status son desconocidos o faltan', () => {
    const inv = mapInvoice({ id: 'i4', amount: 0, type: 'xxx', status: 'yyy' })
    expect(inv.type).toBe('invoice')
    expect(inv.status).toBe('pending')
    expect(inv.currency).toBe('USD')
  })

  it('genera un item sintético desde el type cuando no vienen items', () => {
    const inv = mapInvoice({ id: 'i5', amount: 90, type: 'folio' })
    expect(inv.items).toEqual([{ description: 'folio', amount: 90 }])
  })

  it('mapea ncf/fiscalSent/fiscalMessage tal cual los manda el backend', () => {
    const inv = mapInvoice({
      id: 'i6', amount: 118, type: 'invoice',
      ncf: 'E3100000000001', fiscalSent: false, fiscalMessage: 'Pendiente de envío a DGII',
    })
    expect(inv.ncf).toBe('E3100000000001')
    expect(inv.fiscalSent).toBe(false)
    expect(inv.fiscalMessage).toBe('Pendiente de envío a DGII')
  })

  it('sin ncf/fiscal en la respuesta: ncf null, fiscalSent false, fiscalMessage null (factura sin NCF fiscal)', () => {
    const inv = mapInvoice({ id: 'i7', amount: 100, type: 'invoice' })
    expect(inv.ncf).toBeNull()
    expect(inv.fiscalSent).toBe(false)
    expect(inv.fiscalMessage).toBeNull()
  })

  it('fiscalSent viene como 1/0 (INTEGER de la DB, no boolean real): se normaliza a boolean', () => {
    expect(mapInvoice({ id: 'i8', amount: 100, fiscalSent: 1 }).fiscalSent).toBe(true)
    expect(mapInvoice({ id: 'i9', amount: 100, fiscalSent: 0 }).fiscalSent).toBe(false)
  })
})

describe('Billing.service — isDeletable (regla contable)', () => {
  const base = (over: Partial<Invoice>): Invoice => ({
    id: 'x', number: '1', type: 'invoice', status: 'draft', subtotal: 0, taxRate: 0, tax: 0,
    total: 0, amountPaid: 0, balance: 0, currency: 'USD', guest: '', room: '', items: [],
    issueDate: '', dueDate: null, ...over,
  })

  it('un documento que no es invoice siempre es borrable', () => {
    // BM-4.1: 'payment' ya no es un InvoiceType válido (tipo muerto eliminado) — simula una fila
    // legacy de antes de billing-money-consolidation.
    expect(isDeletable(base({ type: 'payment' as any, status: 'paid', amountPaid: 100 }))).toBe(true)
  })

  it('una invoice pagada/vencida/cancelada NO es borrable', () => {
    expect(isDeletable(base({ status: 'paid' }))).toBe(false)
    expect(isDeletable(base({ status: 'overdue' }))).toBe(false)
    expect(isDeletable(base({ status: 'cancelled' }))).toBe(false)
  })

  it('una invoice draft/pending con pagos parciales NO es borrable', () => {
    expect(isDeletable(base({ status: 'pending', amountPaid: 20 }))).toBe(false)
  })

  it('una invoice draft sin pagos SÍ es borrable', () => {
    expect(isDeletable(base({ status: 'draft', amountPaid: 0 }))).toBe(true)
  })
})

describe('Billing.service — endpoints', () => {
  beforeEach(() => vi.clearAllMocks())

  it('list arma el querystring con page/limit y filtros, y mapea data', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [{ id: 'i1', amount: 100, type: 'invoice' }],
      total: 1, pages: 1, hasNext: false, hasPrev: false,
    } as any)

    const res = await BillingService.list({ hotelId: 'h1', type: 'invoice', status: 'paid', page: 2, limit: 50 })

    const url = vi.mocked(http.get).mock.calls[0][0] as string
    expect(url).toContain('/facturas?')
    expect(url).toContain('hotelId=h1')
    expect(url).toContain('type=invoice')
    expect(url).toContain('status=paid')
    expect(url).toContain('page=2')
    expect(url).toContain('limit=50')
    expect(res.invoices).toHaveLength(1)
    expect(res.total).toBe(1)
  })

  it('list usa page=1 y limit=20 por defecto y tolera data ausente', async () => {
    vi.mocked(http.get).mockResolvedValue({} as any)

    const res = await BillingService.list()

    const url = vi.mocked(http.get).mock.calls[0][0] as string
    expect(url).toContain('page=1')
    expect(url).toContain('limit=20')
    expect(res.invoices).toEqual([])
    expect(res.total).toBe(0)
    expect(res.pages).toBe(1)
  })

  it('pay pega a /facturas/:id/pay con el payload y mapea la respuesta', async () => {
    vi.mocked(http.post).mockResolvedValue({ id: 'i1', amount: 100, status: 'paid', type: 'invoice' } as any)

    const inv = await BillingService.pay('i1', { method: 'cash', amount: 100, reference: 'R1' })

    expect(http.post).toHaveBeenCalledWith('/facturas/i1/pay', { method: 'cash', amount: 100, reference: 'R1' })
    expect(inv.status).toBe('paid')
  })

  it('creditNote pega a /facturas/:id/credit-note con la razón', async () => {
    vi.mocked(http.post).mockResolvedValue({} as any)
    await BillingService.creditNote('i9', 'error de carga')
    expect(http.post).toHaveBeenCalledWith('/facturas/i9/credit-note', { reason: 'error de carga' })
  })

  it('stats pega a /facturas/stats', async () => {
    vi.mocked(http.get).mockResolvedValue({ total: 5 } as any)
    await BillingService.stats()
    expect(http.get).toHaveBeenCalledWith('/facturas/stats')
  })

  it('taxRate normaliza la respuesta a número y cae a 0', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ rate: 18 } as any)
    expect(await BillingService.taxRate()).toBe(18)
    vi.mocked(http.get).mockResolvedValueOnce({} as any)
    expect(await BillingService.taxRate()).toBe(0)
  })

  it('emailInvoice pega a /facturas/:id/email con el destinatario', async () => {
    vi.mocked(http.post).mockResolvedValue({ sent: true } as any)
    await BillingService.emailInvoice('i1', 'a@b.com')
    expect(http.post).toHaveBeenCalledWith('/facturas/i1/email', { to: 'a@b.com' })
  })

  it('exportCsv genera header + una fila por factura con montos formateados', () => {
    const inv = mapInvoice({ id: 'i1', invoiceNumber: 'F-1', amount: 113, taxes: 13, guest: 'Juan', room: '101', type: 'invoice', status: 'paid' })
    const csv = BillingService.exportCsv([inv])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Número')
    expect(lines[1]).toContain('F-1')
    expect(lines[1]).toContain('113.00')
  })
})
