// connectors/tests/financieros-connectors.test.ts — TC-02: conectores financieros.
//
// Cubre facturas-*, folios-* , payments-caja y reembolsos-gastos. Un conector solo DELEGA:
// se verifica que cablee el puerto correcto y mapee bien los campos al módulo destino.
//
// Dos invariantes de plata que estos tests fijan:
//   1. SOLO el efectivo mueve la caja (una tarjeta no abre el cajón).
//   2. Un satélite caído (caja, gastos, reservas) NO tumba el cobro.

import { describe, it, expect } from 'bun:test'
import type { ConnectorContext } from 'arckode-framework'
import { facturasAuditlogConnector } from '../facturas-auditlog'
import { facturasPaymentsConnector } from '../facturas-payments'
import { facturasReservasConnector } from '../facturas-reservas'
import { foliosFacturasConnector } from '../folios-facturas'
import { foliosPaymentsConnector } from '../folios-payments'
import { paymentsCajaConnector } from '../payments-caja'
import { reembolsosGastosConnector } from '../reembolsos-gastos'

/** ctx mock: `hosts` son los módulos que reciben la inyección; el resto son satélites. */
function makeCtx(hosts: string[], modules: Record<string, any> = {}) {
  const captured: any = { sockets: {}, payment: {}, invoicing: {}, audit: {} }
  const hostStub = {
    setSockets: (s: any) => Object.assign(captured.sockets, s),
    setPaymentDeps: (p: any) => Object.assign(captured.payment, p),
    setInvoicingDeps: (p: any) => Object.assign(captured.invoicing, p),
    setAuditDeps: (p: any) => Object.assign(captured.audit, p),
  }
  const ctx = {
    resolveModule: (name: string) => {
      if (hosts.includes(name)) return { ...hostStub, ...(modules[name] ?? {}) }
      if (name in modules) return modules[name]
      throw new Error(`módulo desconocido: ${name}`)
    },
  } as unknown as ConnectorContext
  return { ctx, captured }
}

describe('facturasAuditlogConnector', () => {
  it('delega el registro al auditlog con entity=invoice', async () => {
    const entries: any[] = []
    const { ctx, captured } = makeCtx(['facturas'], { auditlog: { create: async (d: any) => { entries.push(d); return d } } })
    facturasAuditlogConnector(ctx)
    await captured.audit.record({ hotelId: 'h1', userId: 'u1', action: 'invoice.pay', entityId: 'inv1', detail: 'cobrada' })

    expect(entries[0].entity).toBe('invoice')
    expect(entries[0].action).toBe('invoice.pay')
    expect(entries[0].entityId).toBe('inv1')
    expect(entries[0].hotelId).toBe('h1')
  })
})

describe('facturasPaymentsConnector', () => {
  it('asienta el cobro de la factura en payments (completed, ligado al invoiceId)', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['facturas'], {
      payments: { createPayment: async (d: any) => { created.push(d); return { id: 'pay1', status: 'completed' } } },
    })
    facturasPaymentsConnector(ctx)
    await captured.payment.recordPayment({ hotelId: 'h1', invoiceId: 'inv1', method: 'cash', amount: 150, currency: 'USD' })

    expect(created[0].invoiceId).toBe('inv1')
    expect(created[0].amount).toBe(150)
    expect(created[0].method).toBe('cash')
    expect(created[0].status).toBe('completed')
  })
})

describe('facturasReservasConnector', () => {
  it('anota en la reserva cuando la factura queda PAGADA', async () => {
    const updates: any[] = []
    // Mock con la firma REAL de ReservasService: getById(id,user) + update(id,data,user). El bug
    // vivía porque el mock viejo tenía update(id,data) de 2 args y no exigía el currentUser.
    const { ctx, captured } = makeCtx(['facturas'], {
      reservas: {
        getById: async (_id: string, _user: any) => ({ id: _id, notes: '' }),
        update: async (id: string, data: any, user: any) => { updates.push({ id, data, user }); return {} },
      },
    })
    facturasReservasConnector(ctx)
    await captured.sockets.onFacturasUpdated({ reservationId: 'res1', status: 'paid', invoiceNumber: 'INV-1', amount: 100, currency: 'USD' })

    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('res1')
    expect(updates[0].data.notes).toContain('INV-1')
    expect(updates[0].user?.role).toBe('super_admin')   // el 3er arg (currentUser) SÍ se pasa — blinda el bug
  })

  it('NO anota si la factura no está pagada, ni si no tiene reserva', async () => {
    const updates: any[] = []
    const { ctx, captured } = makeCtx(['facturas'], {
      reservas: { update: async (id: string, data: any) => { updates.push({ id, data }); return {} } },
    })
    facturasReservasConnector(ctx)
    await captured.sockets.onFacturasUpdated({ reservationId: 'res1', status: 'pending', invoiceNumber: 'INV-1' })
    await captured.sockets.onFacturasUpdated({ status: 'paid', invoiceNumber: 'INV-2' }) // sin reservationId
    expect(updates).toHaveLength(0)
  })
})

describe('foliosFacturasConnector', () => {
  it('emite la factura del folio delegando en facturas.create', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['folios'], {
      facturas: { create: async (d: any) => { created.push(d); return { id: 'inv1', invoiceNumber: 'INV-1' } } },
    })
    foliosFacturasConnector(ctx)
    const out = await captured.invoicing.createInvoice(
      { hotelId: 'h1', guestId: 'g1', reservationId: 'res1', type: 'invoice', amount: 300, status: 'pending', notes: 'estadía' },
      { id: 'u1' },
    )
    expect(created[0].hotelId).toBe('h1')
    expect(created[0].amount).toBe(300)
    expect(created[0].reservationId).toBe('res1')
    expect(out.id).toBe('inv1')
  })
})

describe('foliosPaymentsConnector', () => {
  it('asienta el pago del folio en payments (completed, ligado al folioId)', async () => {
    const created: any[] = []
    const { ctx, captured } = makeCtx(['folios'], {
      payments: { createPayment: async (d: any) => { created.push(d); return { id: 'pay1', status: 'completed' } } },
    })
    foliosPaymentsConnector(ctx)
    await captured.payment.recordPayment({ hotelId: 'h1', folioId: 'f1', method: 'card', amount: 80 })

    expect(created[0].folioId).toBe('f1')
    expect(created[0].amount).toBe(80)
    expect(created[0].status).toBe('completed')
  })
})

describe('paymentsCajaConnector', () => {
  it('SOLO el efectivo mueve la caja', async () => {
    const income: any[] = []
    const { ctx, captured } = makeCtx(['payments'], {
      caja: { registerPaymentIncome: async (i: any) => { income.push(i); return i } },
    })
    paymentsCajaConnector(ctx)

    await captured.sockets.onPaymentCompleted({ id: 'p1', hotelId: 'h1', method: 'cash', amount: 100, folioId: 'f1' })
    await captured.sockets.onPaymentCompleted({ id: 'p2', hotelId: 'h1', method: 'card', amount: 200 })
    await captured.sockets.onPaymentCompleted({ id: 'p3', hotelId: 'h1', method: 'transfer', amount: 300 })

    expect(income).toHaveLength(1) // la tarjeta y la transferencia NO abren el cajón
    expect(income[0].paymentId).toBe('p1')
    expect(income[0].amount).toBe(100)
    expect(income[0].method).toBe('cash')
  })

  it('si la caja está caída, el cobro NO se rompe', async () => {
    const { ctx, captured } = makeCtx(['payments'], {
      caja: { registerPaymentIncome: async () => { throw new Error('caja caída') } },
    })
    paymentsCajaConnector(ctx)
    await expect(
      captured.sockets.onPaymentCompleted({ id: 'p1', hotelId: 'h1', method: 'cash', amount: 100 }),
    ).resolves.toBeUndefined()
  })
})

describe('reembolsosGastosConnector', () => {
  it('si gastos está caído, el pago del reembolso NO se rompe', async () => {
    const { ctx, captured } = makeCtx(['reembolsos'], {
      gastos: { create: async () => { throw new Error('gastos caído') } },
    })
    reembolsosGastosConnector(ctx)
    await expect(captured.sockets.onClaimPaid({ id: 'c1', hotelId: 'h1', amount: 50 } as any)).resolves.toBeUndefined()
  })
})
