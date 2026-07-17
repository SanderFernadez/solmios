import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { applyPayment } from '../usecases/folio-entries'
import { computeTotals } from '../usecases/folio-math'
import type { FolioPaymentPort, RecordFolioPaymentInput } from '../usecases/payment-port'

const log = silentLogger()

const openFolio = { id: 'f1', hotelId: 'h1', status: 'open', guestId: 'g1', currency: 'USD' }

function makeDeps(charges: any[], port?: FolioPaymentPort) {
  const created: any[] = []
  return {
    deps: {
      folioRepo: { findById: async () => ({ ...openFolio }) },
      chargeRepo: {
        findMany: async () => charges,
        create: async (c: any) => { created.push(c); return c },
      },
      configRepo: { findOne: async () => null },
      userRepo: { findById: async () => ({ hotelId: 'h1' }) },
      auth: { assertOwnership: () => {} },
      logger: log,
      paymentPort: port ?? null,
    } as any,
    created,
  }
}

describe('applyPayment — asiento del dinero en payments (BM-2.3 / BM-2.4)', () => {
  it('BM-2.4: el pago aparece en payments con folioId y method normalizado', async () => {
    const calls: RecordFolioPaymentInput[] = []
    const port: FolioPaymentPort = { recordPayment: async (input) => { calls.push(input); return { id: 'pay-1', status: 'completed' } } }
    const { deps } = makeDeps([{ folioId: 'f1', kind: 'charge', total: 100 }], port)

    await applyPayment(deps, 'f1', { amount: 40, method: 'efectivo' }, { id: 'u1' } as any)

    expect(calls).toHaveLength(1)
    expect(calls[0].folioId).toBe('f1')
    expect(calls[0].amount).toBe(40)
    expect(calls[0].method).toBe('cash')
    expect(calls[0].hotelId).toBe('h1')
  })

  it('BM-2.3: el saldo baja por la línea auxiliar (kind=payment, total negativo), sin doble descuento', async () => {
    const calls: RecordFolioPaymentInput[] = []
    const port: FolioPaymentPort = { recordPayment: async (input) => { calls.push(input); return { id: 'pay-1', status: 'completed' } } }
    const cargo = { folioId: 'f1', kind: 'charge', total: 100 }
    const { deps, created } = makeDeps([cargo], port)

    await applyPayment(deps, 'f1', { amount: 40, method: 'cash' }, { id: 'u1' } as any)

    // La línea auxiliar se crea en folio_charges (kind=payment, total -40): es la que mueve el saldo.
    const payLine = created.find((c) => c.kind === 'payment')
    expect(payLine).toBeTruthy()
    expect(payLine.total).toBe(-40)

    // Saldo recalculado con computeTotals de producción: 100 - 40 = 60 (NO 20 = doble descuento).
    // El pago a `payments` (puerto) es ortogonal al saldo del folio.
    expect(computeTotals([cargo, payLine]).balance).toBe(60)
    expect(calls).toHaveLength(1)
  })

  it('rechaza un pago mayor que el saldo pendiente', async () => {
    const calls: RecordFolioPaymentInput[] = []
    const port: FolioPaymentPort = { recordPayment: async (input) => { calls.push(input); return { id: 'pay-1', status: 'completed' } } }
    const { deps } = makeDeps([{ folioId: 'f1', kind: 'charge', total: 100 }], port)

    await expect(
      applyPayment(deps, 'f1', { amount: 150, method: 'cash' }, { id: 'u1' } as any),
    ).rejects.toThrow(/excede el saldo/)
    expect(calls).toHaveLength(0)
  })
})
