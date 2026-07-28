// payments/tests/pos-idempotency.test.ts — el mismo cobro del POS, pedido dos veces, asienta UN
// payment (idempotencia-settlement-pos). Mismo patrón que webhook-idempotency.test.ts: se emula la
// barrera atómica real (UNIQUE index parcial `payments_pos_ref` sobre hotelId+reference WHERE
// reference LIKE 'pos:%', creado en migrate-db.ts) en el mock del repo, y se prueba que
// `PaymentCrudUseCase.create` (claim-first) captura la violación y devuelve el registro existente
// en vez de fallar o duplicar.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentCrudUseCase } from '../usecases/payment-crud'
import type { PaymentDTO, CreatePaymentDTO } from '../types'

const log = silentLogger()

/** Repo con la MISMA barrera que el UNIQUE index parcial: (hotelId,reference) único para 'pos:%'. */
function makePosAwareRepo(): RepositoryAdapter<PaymentDTO> & { rows: any[] } {
  const rows: any[] = []
  return {
    rows,
    findMany: async (filter: any = {}) =>
      rows.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
    findById: async (id: string) => rows.find((r) => r.id === id) ?? null,
    findOne: async (filter: any = {}) =>
      rows.find((r) => Object.entries(filter).every(([k, v]) => r[k] === v)) ?? null,
    create: async (data: any) => {
      if (typeof data.reference === 'string' && data.reference.startsWith('pos:')) {
        const dup = rows.find((r) => r.hotelId === data.hotelId && r.reference === data.reference)
        if (dup) throw new Error('duplicate key value violates unique constraint "payments_pos_ref"')
      }
      const row = { id: `pay_${rows.length + 1}`, ...data }
      rows.push(row)
      return row
    },
    update: async (id: string, data: any) => {
      const row = rows.find((r) => r.id === id)
      Object.assign(row, data)
      return row
    },
    delete: async () => true,
    count: async () => rows.length,
    paginate: async () => ({ data: rows, total: rows.length, limit: 20, offset: 0, pages: 1 }),
  } as any
}

const baseDto = (reference?: string): CreatePaymentDTO => ({
  hotelId: 'h1', type: 'charge', method: 'cash', amount: 23.6,
  description: 'Restaurante · comanda CMD-1', reference,
})

describe('PaymentCrudUseCase.create — idempotencia POS (idempotencia-settlement-pos)', () => {
  it('reintento SECUENCIAL con la misma reference (crash entre recordPayment y orders.update) → NO crea P2, devuelve P1', async () => {
    const repo = makePosAwareRepo()
    const uc = new PaymentCrudUseCase(repo, log)
    const dto = baseDto('pos:order-1')

    const p1 = await uc.create(dto)
    const p2 = await uc.create(dto) // reintento: mismo orderId, mismo reference

    expect(repo.rows).toHaveLength(1)
    expect(p2.id).toBe(p1.id)
  })

  it('doble click CONCURRENTE (misma orden) → 1 solo payment (el segundo reclamado)', async () => {
    const repo = makePosAwareRepo()
    const uc = new PaymentCrudUseCase(repo, log)
    const dto = baseDto('pos:order-2')

    const [p1, p2] = await Promise.all([uc.create(dto), uc.create(dto)])

    expect(repo.rows).toHaveLength(1)
    expect(p1.id).toBe(p2.id)
  })

  it('órdenes DISTINTAS (reference distinto) → 2 payments, uno por orden', async () => {
    const repo = makePosAwareRepo()
    const uc = new PaymentCrudUseCase(repo, log)

    const p1 = await uc.create(baseDto('pos:order-3'))
    const p2 = await uc.create(baseDto('pos:order-4'))

    expect(repo.rows).toHaveLength(2)
    expect(p1.id).not.toBe(p2.id)
  })

  it('sin reference pos: (payment normal, no-POS) → el dedup NO aplica, cada create es independiente', async () => {
    const repo = makePosAwareRepo()
    const uc = new PaymentCrudUseCase(repo, log)
    const dto = baseDto(undefined)

    await uc.create(dto)
    await uc.create(dto)

    expect(repo.rows).toHaveLength(2) // comportamiento preexistente: sin key, sin barrera
  })
})
