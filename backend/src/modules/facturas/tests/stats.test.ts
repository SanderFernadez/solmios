// facturas/tests/stats.test.ts — Contabilidad de las tarjetas del panel de facturación.
// Regresión: `pay()` marca la factura como paid Y crea un comprobante `type:'payment'` con el
// mismo monto en la misma tabla. Sumar ambos duplicaba cada cobro en los ingresos.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { getFacturasStats } from '../usecases/stats'
import type { FacturasDTO } from '../types'

const today = new Date().toISOString().split('T')[0]

function invoice(over: Partial<FacturasDTO>): FacturasDTO {
  return {
    id: 'i1', hotelId: 'h1', invoiceNumber: 'INV-1', type: 'invoice', amount: 100, taxes: 0,
    currency: 'USD', status: 'pending', issueDate: today, createdAt: today, updatedAt: today,
    ...over,
  } as FacturasDTO
}

/** Repo que respeta el filtro por `type` (como hace el ORM real). */
const repoWith = (rows: FacturasDTO[]): RepositoryAdapter<FacturasDTO> => ({
  findMany: async (filter: any) =>
    rows.filter((r) => Object.entries(filter ?? {}).every(([k, v]) => (r as any)[k] === v)),
} as unknown as RepositoryAdapter<FacturasDTO>)

describe('getFacturasStats', () => {
  it('no cuenta dos veces un cobro: la factura paid y su comprobante payment', async () => {
    const rows = [
      invoice({ id: 'i1', status: 'paid', amount: 100, amountPaid: 100 }),
      // comprobante que deja `pay()` — mismo monto, mismo día
      invoice({ id: 'p1', type: 'payment', invoiceNumber: 'PAY-1', status: 'paid', amount: 100 }),
    ]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.monthlyRevenue).toBe(100)
    expect(stats.todayRevenue).toBe(100)
    expect(stats.total).toBe(1)   // 1 factura, no 2 documentos
    expect(stats.paid).toBe(1)
  })

  it('"Pendiente" acumula el saldo, no el total facturado', async () => {
    const rows = [invoice({ status: 'pending', amount: 100, amountPaid: 80 })]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.pendingAmount).toBe(20)
  })

  it('una factura vencida con pago parcial pesa solo su saldo', async () => {
    const rows = [invoice({ status: 'overdue', amount: 250, amountPaid: 100 })]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.overdueAmount).toBe(150)
  })

  it('nunca reporta saldo negativo por un sobrepago', async () => {
    const rows = [invoice({ status: 'pending', amount: 100, amountPaid: 130 })]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.pendingAmount).toBe(0)
  })

  it('ignora los cargos de folio al contar facturas emitidas', async () => {
    const rows = [
      invoice({ id: 'i1' }),
      invoice({ id: 'f1', type: 'folio', invoiceNumber: 'CHG-1', amount: 40 }),
    ]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.total).toBe(1)
  })

  it('un ingreso de un mes anterior no suma a monthlyRevenue', async () => {
    const rows = [invoice({ status: 'paid', amount: 500, amountPaid: 500, issueDate: '2020-01-15' })]
    const stats = await getFacturasStats(repoWith(rows), { hotelId: 'h1' })

    expect(stats.monthlyRevenue).toBe(0)
    expect(stats.todayRevenue).toBe(0)
    expect(stats.paid).toBe(1)
  })
})
