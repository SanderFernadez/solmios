// treasury/tests/service.test.ts — Tests del módulo de tesorería (liquidez + proveedores).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { TreasuryService } from '../service'
import type { SupplierDTO, CurrentUser } from '../types'
import { cashFlow, receivables, payables } from '../usecases/liquidity'

const log = silentLogger()
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth
const user: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function repoOf(rows: any[] = []): RepositoryAdapter<any> {
  return {
    findMany: async () => rows, findById: async () => rows[0] ?? null, findOne: async () => rows[0] ?? null,
    create: async (d: any) => ({ id: 'new', ...d }), update: async (id: string, d: any) => ({ id, ...d }), delete: async () => true,
    count: async () => rows.length, paginate: async () => ({ data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 }),
  } as any
}
const liq = (pays: any[], exps: any[], invs: any[]) => ({ payments: repoOf(pays), expenses: repoOf(exps), invoices: repoOf(invs) })
const DAY = 86_400_000

describe('treasury — flujo de caja (TES-2)', () => {
  it('cobrado neto = charge − refund; depósitos y pending excluidos', async () => {
    const pays = [
      { type: 'charge', status: 'completed', amount: 200, processedAt: '2026-07-10' },
      { type: 'refund', status: 'completed', amount: 50, processedAt: '2026-07-10' },   // baja el efectivo
      { type: 'deposit', status: 'completed', amount: 500, processedAt: '2026-07-10' }, // excluido (garantía)
      { type: 'charge', status: 'pending', amount: 99, processedAt: '2026-07-10' },      // excluido (no completado)
    ]
    const exps = [{ paid: 1, amount: 80, date: '2026-07-12' }, { paid: 0, amount: 30, date: '2026-07-12' }]
    const cf = await cashFlow(liq(pays, exps, []), 'h1', undefined, undefined, 'month')
    expect(cf.totalIn).toBe(150)   // 200 − 50 refund
    expect(cf.totalOut).toBe(80)
    expect(cf.net).toBe(70)
  })

  it('el filtro `to` date-only NO pierde los cobros del último día (processedAt ISO completo)', async () => {
    const pays = [{ type: 'charge', status: 'completed', amount: 100, processedAt: '2026-07-31T14:30:00.000Z' }]
    const cf = await cashFlow(liq(pays, [], []), 'h1', '2026-07-01', '2026-07-31', 'day')
    expect(cf.totalIn).toBe(100)   // antes daba 0 por comparar ISO vs date-only
  })
})

describe('treasury — cuentas por cobrar AR (TES-3)', () => {
  it('agrupa por huésped el saldo pendiente con aging', async () => {
    const now = Date.parse('2026-07-31')
    const invs = [
      { type: 'invoice', guestId: 'g1', amount: 100, amountPaid: 40, dueDate: '2026-07-25' }, // 60 pendiente, 6 días → 1-30
      { type: 'invoice', guestId: 'g1', amount: 50, amountPaid: 50, dueDate: '2026-07-01' },   // saldado → excluido
      { type: 'payment', guestId: 'g2', amount: 999, amountPaid: 0 },                          // no es factura → excluido
      { type: 'invoice', guestId: 'g2', amount: 200, amountPaid: 0, dueDate: '2026-04-01' },   // 200, ~120 días → 90+
    ]
    const ar = await receivables(liq([], [], invs), 'h1', now)
    expect(ar.total).toBe(260)          // 60 + 200
    expect(ar.aging['1-30']).toBe(60)
    expect(ar.aging['90+']).toBe(200)
    expect(ar.rows.find(r => r.guestId === 'g1')?.outstanding).toBe(60)
  })
})

describe('treasury — cuentas por pagar AP (TES-4)', () => {
  it('agrupa por proveedor los gastos impagos con aging', async () => {
    const now = Date.parse('2026-07-31')
    const exps = [
      { paid: 0, amount: 300, provider: 'Lavandería', date: '2026-07-20' },   // 11 días → 1-30
      { paid: 1, amount: 999, provider: 'Lavandería', date: '2026-07-20' },   // pagado → excluido
      { paid: 0, amount: 150, provider: 'Eléctrica', date: '2026-05-01' },    // ~90 días → 61-90
    ]
    const ap = await payables(liq([], exps, []), 'h1', now)
    expect(ap.total).toBe(450)
    expect(ap.aging['1-30']).toBe(300)
    expect(ap.rows.find(r => r.provider === 'Lavandería')?.owed).toBe(300)
  })
})

describe('treasury — proveedores CRUD (TES-4)', () => {
  function svc(suppliers: RepositoryAdapter<SupplierDTO>) {
    const userRepo = { ...repoOf([{ id: 'u1', hotelId: 'h1' }]), findById: async () => ({ id: 'u1', hotelId: 'h1' }) } as any
    return new TreasuryService(suppliers, userRepo, passAuth, log, repoOf(), repoOf(), repoOf())
  }
  it('crea un proveedor forzando el hotelId del JWT', async () => {
    let created: any = null
    const suppliers = repoOf() as any; suppliers.create = async (d: any) => { created = d; return { id: 's1', ...d } }
    const s = await svc(suppliers).createSupplier({ name: 'Lavandería' } as any, user)
    expect(s.id).toBe('s1'); expect(created.hotelId).toBe('h1')
  })
  it('deleteSupplier lanza NotFound si no existe', async () => {
    const suppliers = repoOf() as any; suppliers.findById = async () => null
    await expect(svc(suppliers).deleteSupplier('no', user)).rejects.toThrow(/no encontrado/i)
  })
})
