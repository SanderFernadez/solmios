// accounting/tests/reports.test.ts — #661: revertir un asiento debe dejar saldo CERO, no un
// fantasma en sentido contrario. Ver comentario en usecases/reports.ts (postedLines).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import type { AccountDTO } from '../types'
import { trialBalance } from '../usecases/reports'

function makeFindManyRepo<T extends object>(rows: T[]): RepositoryAdapter<T> {
  return {
    findMany: async (query: Record<string, unknown> = {}) =>
      rows.filter((r: any) => Object.entries(query).every(([k, v]) => v === undefined || r[k] === v)),
  } as unknown as RepositoryAdapter<T>
}

describe('trialBalance — reversión de asientos (#661)', () => {
  const ts = { createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }
  const caja: AccountDTO = { id: 'caja', hotelId: 'h1', code: '1.1.01', name: 'Caja', type: 'asset', ...ts }
  const ingresos: AccountDTO = { id: 'ing', hotelId: 'h1', code: '4.1.01', name: 'Ingresos', type: 'income', ...ts }

  it('un asiento posteado y luego revertido no deja saldo (original + espejo = 0)', async () => {
    // Asiento original: Caja debe 100 / Ingresos haber 100 — luego revertido (status 'reversed').
    // Asiento espejo: creado por reverseEntry, invertido (Caja haber 100 / Ingresos debe 100), 'posted'.
    const entries = [
      { id: 'e1', hotelId: 'h1', status: 'reversed', period: '2026-08' },
      { id: 'e1-rev', hotelId: 'h1', status: 'posted', period: '2026-08', reversalOf: 'e1' },
    ]
    const lines = [
      { id: 'l1', entryId: 'e1', accountId: 'caja', debit: 100, credit: 0 },
      { id: 'l2', entryId: 'e1', accountId: 'ing', debit: 0, credit: 100 },
      { id: 'l1r', entryId: 'e1-rev', accountId: 'caja', debit: 0, credit: 100 },
      { id: 'l2r', entryId: 'e1-rev', accountId: 'ing', debit: 100, credit: 0 },
    ]
    const deps = {
      accounts: makeFindManyRepo([caja, ingresos]),
      entries: makeFindManyRepo(entries),
      lines: makeFindManyRepo(lines),
    }
    const { rows, totalDebit, totalCredit, balanced } = await trialBalance(deps as any, 'h1')
    for (const row of rows) {
      expect(row.balance).toBe(0)   // ANTES del fix: caja quedaba en -100, ingresos en +100 (fantasma)
    }
    // Original (100/100) + espejo (100/100) = 200/200 en total — cuadrado, aunque el NETO por cuenta sea 0.
    expect(totalDebit).toBe(200)
    expect(totalCredit).toBe(200)
    expect(balanced).toBe(true)
  })

  it('un asiento posteado SIN revertir sí deja su saldo real', async () => {
    const entries = [{ id: 'e2', hotelId: 'h1', status: 'posted', period: '2026-08' }]
    const lines = [
      { id: 'l3', entryId: 'e2', accountId: 'caja', debit: 50, credit: 0 },
      { id: 'l4', entryId: 'e2', accountId: 'ing', debit: 0, credit: 50 },
    ]
    const deps = {
      accounts: makeFindManyRepo([caja, ingresos]),
      entries: makeFindManyRepo(entries),
      lines: makeFindManyRepo(lines),
    }
    const { rows } = await trialBalance(deps as any, 'h1')
    const cajaRow = rows.find((r) => r.code === caja.code)
    expect(cajaRow?.balance).toBe(50)
  })
})
