// payroll/tests/mark-as-paid.test.ts — markAsPaid asienta el historial por empleado.
//
// Regresión: payroll_payment_history existía con repo instanciado pero nadie la escribía. Al pagar
// sólo quedaba `status:'paid'` en la cabecera del run, sin rastro de cuánto cobró cada empleado.

import { describe, it, expect } from 'bun:test'
import { PayrollRunUseCase } from '../usecases/runs'

const silentLog = { info() {}, warn() {}, error() {}, debug() {}, child() { return this } } as any

function makeRepo(rows: any[] = []) {
  const store = [...rows]
  return {
    store,
    findById: async (id: string) => store.find((r) => r.id === id) ?? null,
    findOne: async (f: Record<string, any>) => store.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null,
    findMany: async (f: Record<string, any> = {}) => store.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)),
    create: async (d: any) => { const row = { id: `id-${store.length + 1}`, ...d }; store.push(row); return row },
    update: async (id: string, d: any) => { const r = store.find((x) => x.id === id); Object.assign(r, d); return r },
    delete: async (id: string) => { const i = store.findIndex((x) => x.id === id); if (i >= 0) store.splice(i, 1); return true },
    count: async () => store.length,
    paginate: async () => ({ data: store, total: store.length, limit: 20, offset: 0, pages: 1 }),
  } as any
}

function build(runStatus: string) {
  const runRepo = makeRepo([{ id: 'run1', hotelId: 'h1', period: '2026-07', status: runStatus }])
  const detailRepo = makeRepo([
    { id: 'd1', runId: 'run1', employeeId: 'e1', netPay: 1400, status: 'approved' },
    { id: 'd2', runId: 'run1', employeeId: 'e2', netPay: 2100, status: 'approved' },
  ])
  const payslipRepo = makeRepo()
  const historyRepo = makeRepo()
  const configRepo = makeRepo()
  const runs = new PayrollRunUseCase(runRepo, detailRepo, payslipRepo, historyRepo, configRepo, silentLog)
  return { runs, historyRepo, runRepo }
}

describe('PayrollRunUseCase.markAsPaid', () => {
  it('escribe una fila de historial por empleado con su neto', async () => {
    const { runs, historyRepo } = build('approved')
    await runs.markAsPaid('run1', undefined, 'transfer')
    expect(historyRepo.store).toHaveLength(2)
    expect(historyRepo.store.map((h: any) => h.amount).sort()).toEqual([1400, 2100])
    expect(historyRepo.store.every((h: any) => h.hotelId === 'h1' && h.method === 'transfer' && h.runId === 'run1')).toBe(true)
  })

  it('pagar dos veces no duplica el historial', async () => {
    const { runs, historyRepo } = build('approved')
    await runs.markAsPaid('run1', undefined, 'cash')
    // El segundo intento falla porque el run ya está 'paid' (no 'approved'): igualmente el historial no crece.
    await runs.markAsPaid('run1').catch(() => {})
    expect(historyRepo.store).toHaveLength(2)
  })

  it('un run no aprobado no escribe historial', async () => {
    const { runs, historyRepo } = build('draft')
    await runs.markAsPaid('run1').catch(() => {})
    expect(historyRepo.store).toHaveLength(0)
  })
})
