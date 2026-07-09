// payments/tests/reconciliation.test.ts — Conciliación bancaria.
// Regresión: sin `entries` reventaba con "Spread syntax requires ...iterable", y con rango de
// fechas bindeaba un objeto `{$gte,$lte}` al driver ("Binding expected string...").

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { ReconciliationUseCase } from '../usecases/reconciliation'
import type { PaymentDTO, ReconciliationEntry } from '../types'

function payment(over: Partial<PaymentDTO>): PaymentDTO {
  return {
    id: 'p1', hotelId: 'h1', type: 'charge', method: 'transfer', status: 'completed',
    amount: 100, currency: 'USD', description: '', reference: '', stripePaymentId: '',
    stripeSessionId: '', metadata: {}, createdAt: '2026-07-09T10:00:00Z', updatedAt: '',
    ...over,
  } as PaymentDTO
}

const repoWith = (rows: PaymentDTO[]): RepositoryAdapter<PaymentDTO> => ({
  // El WHERE real solo soporta igualdad; el mock replica eso a propósito.
  findMany: async (f: any) => rows.filter((r) => Object.entries(f ?? {}).every(([k, v]) => (r as any)[k] === v)),
} as unknown as RepositoryAdapter<PaymentDTO>)

const bank = (over: Partial<ReconciliationEntry>): ReconciliationEntry => ({
  date: '2026-07-09', description: 'transf', amount: 100, type: 'credit', ...over,
})

describe('ReconciliationUseCase', () => {
  it('sin extracto bancario devuelve todos los pagos como no conciliados', async () => {
    const uc = new ReconciliationUseCase(repoWith([payment({ amount: 100 })]))
    const r = await uc.reconcile('h1')

    expect(r.matched).toHaveLength(0)
    expect(r.unmatchedSystem).toHaveLength(1)
    expect(r.difference).toBe(-100)
  })

  it('no explota si `entries` llega null o no es array', async () => {
    const uc = new ReconciliationUseCase(repoWith([]))
    expect((await uc.reconcile('h1', null as any)).matched).toHaveLength(0)
    expect((await uc.reconcile('h1', undefined as any)).matched).toHaveLength(0)
  })

  it('cruza un movimiento del banco con el pago del mismo monto', async () => {
    const uc = new ReconciliationUseCase(repoWith([payment({ amount: 100 })]))
    const r = await uc.reconcile('h1', [bank({ amount: 100 })])

    expect(r.matched).toHaveLength(1)
    expect(r.unmatchedBank).toHaveLength(0)
    expect(r.unmatchedSystem).toHaveLength(0)
    expect(r.difference).toBe(0)
  })

  it('deja suelto lo que no cruza, de los dos lados', async () => {
    const uc = new ReconciliationUseCase(repoWith([payment({ amount: 100 })]))
    const r = await uc.reconcile('h1', [bank({ amount: 55 })])

    expect(r.matched).toHaveLength(0)
    expect(r.unmatchedBank).toHaveLength(1)
    expect(r.unmatchedSystem).toHaveLength(1)
    expect(r.difference).toBe(-45)
  })

  it('exige que la referencia coincida cuando el banco la trae', async () => {
    const uc = new ReconciliationUseCase(repoWith([payment({ amount: 100, reference: 'ABC' })]))

    expect((await uc.reconcile('h1', [bank({ amount: 100, reference: 'XYZ' })])).matched).toHaveLength(0)
    expect((await uc.reconcile('h1', [bank({ amount: 100, reference: 'ABC' })])).matched).toHaveLength(1)
  })

  it('un débito del banco cruza contra el pago por su valor absoluto', async () => {
    const uc = new ReconciliationUseCase(repoWith([payment({ amount: 100 })]))
    const r = await uc.reconcile('h1', [bank({ amount: -100, type: 'debit' })])

    expect(r.matched).toHaveLength(1)
  })

  it('el rango de fechas filtra en memoria, sin romper el WHERE', async () => {
    const uc = new ReconciliationUseCase(repoWith([
      payment({ id: 'viejo', createdAt: '2020-01-01T10:00:00Z' }),
      payment({ id: 'nuevo', createdAt: '2026-07-09T10:00:00Z' }),
    ]))
    const r = await uc.reconcile('h1', [], '2026-01-01', '2026-12-31')

    expect(r.unmatchedSystem).toHaveLength(1)
    expect(r.unmatchedSystem[0].id).toBe('nuevo')
  })

  it('cada movimiento del banco consume un solo pago', async () => {
    const uc = new ReconciliationUseCase(repoWith([
      payment({ id: 'a', amount: 100 }),
      payment({ id: 'b', amount: 100 }),
    ]))
    const r = await uc.reconcile('h1', [bank({ amount: 100 })])

    expect(r.matched).toHaveLength(1)
    expect(r.unmatchedSystem).toHaveLength(1)
  })
})
