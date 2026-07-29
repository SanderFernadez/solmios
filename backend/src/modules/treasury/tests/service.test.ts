// treasury/tests/service.test.ts — Tests del módulo de tesorería (liquidez + proveedores).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { TreasuryService } from '../service'
import type { SupplierDTO, CurrentUser } from '../types'
import { cashFlow, receivables, payables } from '../usecases/liquidity'
import { reconcile, importMovements, updateBankAccount } from '../usecases/bank'
import { budgetVsActual } from '../usecases/budget'

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

describe('treasury — conciliación bancaria (TES-1)', () => {
  const userRepo = { ...repoOf([{ id: 'u1', hotelId: 'h1' }]), findById: async () => ({ id: 'u1', hotelId: 'h1' }) } as any
  it('import dedup: no re-crea un movimiento ya importado', async () => {
    const existing = [{ id: 'm0', bankAccountId: 'b1', date: '2026-07-10', amount: 100, reference: 'REF1' }]
    const mov = repoOf(existing) as any; let created = 0; mov.create = async (d: any) => { created++; return { id: 'x', ...d } }
    const deps = { bankAccounts: repoOf([{ id: 'b1', hotelId: 'h1' }]), bankMovements: mov, payments: repoOf(), userRepo, auth: passAuth }
    const res = await importMovements(deps as any, 'b1', [
      { date: '2026-07-10', amount: 100, reference: 'REF1' },   // duplicado → salta
      { date: '2026-07-11', amount: 200, reference: 'REF2' },   // nuevo
    ], user)
    expect(res.created).toBe(1)
  })

  it('reconcile matchea un movimiento con un pago de igual monto y fecha cercana', async () => {
    const movs = [
      { id: 'm1', bankAccountId: 'b1', hotelId: 'h1', date: '2026-07-10', amount: 100, reconciled: 0 },
      { id: 'm2', bankAccountId: 'b1', hotelId: 'h1', date: '2026-07-20', amount: 999, reconciled: 0 },  // sin match
    ]
    const mov = repoOf(movs) as any; const marked: any[] = []; mov.update = async (id: string, d: any) => { marked.push({ id, ...d }); return d }
    const pays = repoOf([{ id: 'p1', hotelId: 'h1', status: 'completed', amount: 100, processedAt: '2026-07-11' }])
    const deps = { bankAccounts: repoOf([{ id: 'b1', hotelId: 'h1' }]), bankMovements: mov, payments: pays, userRepo, auth: passAuth }
    const res = await reconcile(deps as any, 'b1', user)
    expect(res.matched).toBe(1)
    expect(res.unmatchedCount).toBe(1)
    expect(marked[0]).toMatchObject({ id: 'm1', reconciled: 1, paymentId: 'p1' })
  })

  it('un egreso bancario (−80) NO concilia contra un cobro entrante (+80) — matching por signo', async () => {
    const movs = [{ id: 'm1', bankAccountId: 'b1', hotelId: 'h1', date: '2026-07-10', amount: -80, reconciled: 0 }]
    const mov = repoOf(movs) as any; mov.update = async (id: string, d: any) => ({ id, ...d })
    const pays = repoOf([{ id: 'p1', hotelId: 'h1', status: 'completed', type: 'charge', amount: 80, processedAt: '2026-07-10' }])
    const deps = { bankAccounts: repoOf([{ id: 'b1', hotelId: 'h1' }]), bankMovements: mov, payments: pays, userRepo, auth: passAuth }
    const res = await reconcile(deps as any, 'b1', user)
    expect(res.matched).toBe(0)          // charge (+80) no matchea un egreso (−80)
  })

  it('un mismo pago NO concilia dos movimientos (anti doble-match)', async () => {
    const movs = [
      { id: 'm1', bankAccountId: 'b1', hotelId: 'h1', date: '2026-07-10', amount: 100, reconciled: 0 },
      { id: 'm2', bankAccountId: 'b1', hotelId: 'h1', date: '2026-07-10', amount: 100, reconciled: 0 },
    ]
    const mov = repoOf(movs) as any; mov.update = async (id: string, d: any) => ({ id, ...d })
    const pays = repoOf([{ id: 'p1', hotelId: 'h1', status: 'completed', amount: 100, processedAt: '2026-07-10' }])
    const deps = { bankAccounts: repoOf([{ id: 'b1', hotelId: 'h1' }]), bankMovements: mov, payments: pays, userRepo, auth: passAuth }
    const res = await reconcile(deps as any, 'b1', user)
    expect(res.matched).toBe(1)          // solo un movimiento matchea el único pago
    expect(res.unmatchedCount).toBe(1)
  })

  // DT-19 → DT-16: currentBalance ya no queda clavado en openingBalance para siempre.
  it('DT-16: importar movimientos recalcula currentBalance = opening + suma firmada', async () => {
    const acc = { id: 'b1', hotelId: 'h1', openingBalance: 1000, currentBalance: 1000 }
    const accRepo = repoOf([acc]) as any
    accRepo.update = async (id: string, d: any) => { Object.assign(acc, d); return acc }
    const mov = repoOf([]) as any
    const created: any[] = []
    mov.create = async (d: any) => { const row = { id: `m${created.length + 1}`, ...d }; created.push(row); return row }
    mov.findMany = async () => created   // recalcBalance lee lo recién creado
    const deps = { bankAccounts: accRepo, bankMovements: mov, payments: repoOf(), userRepo, auth: passAuth }

    await importMovements(deps as any, 'b1', [
      { date: '2026-07-10', amount: 200, reference: 'R1' },   // entrada
      { date: '2026-07-11', amount: -50, reference: 'R2' },   // salida
    ], user)

    expect(acc.currentBalance).toBe(1150)   // 1000 + 200 - 50
  })

  it('DT-16: re-importar el mismo CSV (0 nuevos) NO dispara un recálculo de más', async () => {
    const acc = { id: 'b1', hotelId: 'h1', openingBalance: 1000, currentBalance: 1000 }
    const accRepo = repoOf([acc]) as any
    let updateCalls = 0
    accRepo.update = async (id: string, d: any) => { updateCalls++; Object.assign(acc, d); return acc }
    const existing = [{ id: 'm0', bankAccountId: 'b1', date: '2026-07-10', amount: 100, reference: 'REF1' }]
    const mov = repoOf(existing) as any
    const deps = { bankAccounts: accRepo, bankMovements: mov, payments: repoOf(), userRepo, auth: passAuth }

    await importMovements(deps as any, 'b1', [{ date: '2026-07-10', amount: 100, reference: 'REF1' }], user) // duplicado

    expect(updateCalls).toBe(0)
    expect(acc.currentBalance).toBe(1000)   // sin tocar
  })

  it('DT-16: cambiar openingBalance recalcula currentBalance con el nuevo delta', async () => {
    const acc = { id: 'b1', hotelId: 'h1', openingBalance: 1000, currentBalance: 1200 } // ya tenía +200 de movimientos
    const accRepo = repoOf([acc]) as any
    accRepo.update = async (id: string, d: any) => { Object.assign(acc, d); return acc }
    const mov = repoOf([{ id: 'm1', bankAccountId: 'b1', date: '2026-07-10', amount: 200 }]) as any
    const deps = { bankAccounts: accRepo, bankMovements: mov, payments: repoOf(), userRepo, auth: passAuth }

    await updateBankAccount(deps as any, 'b1', { openingBalance: 500 }, user)

    expect(acc.currentBalance).toBe(700)   // 500 (nuevo opening) + 200 (movimientos)
  })
})

describe('treasury — presupuesto vs real (TES-5)', () => {
  const userRepo = { ...repoOf([{ id: 'u1', hotelId: 'h1' }]), findById: async () => ({ id: 'u1', hotelId: 'h1' }) } as any
  it('compara presupuesto vs gasto real por categoría y señala sobre-ejecución', async () => {
    const budgets = repoOf([{ hotelId: 'h1', period: '2026-07', category: 'Limpieza', budgetedAmount: 100 }])
    const exps = repoOf([
      { hotelId: 'h1', category: 'Limpieza', amount: 130, date: '2026-07-05' },   // sobre presupuesto
      { hotelId: 'h1', category: 'Limpieza', amount: 999, date: '2026-06-05' },    // otro mes → excluido
    ])
    const deps = { budgets, expenses: exps, userRepo, auth: passAuth }
    const bva = await budgetVsActual(deps as any, user, '2026-07')
    const row = bva.rows.find(r => r.category === 'Limpieza')!
    expect(row.budgeted).toBe(100)
    expect(row.actual).toBe(130)
    expect(row.variance).toBe(30)
    expect(row.overBudget).toBe(true)
    expect(row.pctExecuted).toBe(130)
  })

  it('gasto en una categoría SIN presupuesto se marca sobre-ejecutado (descontrol)', async () => {
    const budgets = repoOf([])   // sin presupuestos
    const exps = repoOf([{ hotelId: 'h1', category: 'Varios', amount: 70, date: '2026-07-05' }])
    const bva = await budgetVsActual({ budgets, expenses: exps, userRepo, auth: passAuth } as any, user, '2026-07')
    const row = bva.rows.find(r => r.category === 'Varios')!
    expect(row.budgeted).toBe(0)
    expect(row.actual).toBe(70)
    expect(row.overBudget).toBe(true)     // gasto sin partida asignada = descontrol
    expect(row.pctExecuted).toBeNull()
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
