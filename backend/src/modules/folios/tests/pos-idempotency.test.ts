// folios/tests/pos-idempotency.test.ts — el mismo cargo a habitación del POS, pedido dos veces,
// asienta UN cargo (idempotencia-settlement-pos). Mismo patrón que
// payments/tests/pos-idempotency.test.ts: se emula la barrera atómica real (UNIQUE index parcial
// `folio_charges_pos_ref` sobre hotelId+reference WHERE source='pos', creado en migrate-db.ts) en
// el mock del chargeRepo, y se prueba que `postCharge` (claim-first) captura la violación y
// devuelve el cargo existente en vez de fallar o duplicarlo en el folio del huésped.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { postCharge } from '../usecases/folio-entries'
import type { PostChargeDTO, CurrentUser } from '../types'

const log = silentLogger()
const user: CurrentUser = { id: 'u1', hotelId: 'h1' }
const openFolio = { id: 'f1', hotelId: 'h1', status: 'open', guestId: 'g1', currency: 'USD' }

/** chargeRepo con la MISMA barrera que el UNIQUE index parcial: (hotelId,reference) único para source='pos'. */
function makeDeps() {
  const rows: any[] = []
  const chargeRepo = {
    create: async (data: any) => {
      if (data.source === 'pos' && typeof data.reference === 'string') {
        const dup = rows.find((r) => r.hotelId === data.hotelId && r.reference === data.reference)
        if (dup) throw new Error('duplicate key value violates unique constraint "folio_charges_pos_ref"')
      }
      const row = { id: `ch_${rows.length + 1}`, ...data }
      rows.push(row)
      return row
    },
    findMany: async (filter: any = {}) =>
      rows.filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
  }
  const deps: any = {
    folioRepo: { findById: async () => ({ ...openFolio }) },
    chargeRepo,
    configRepo: { findOne: async () => null },
    userRepo: { findById: async () => ({ hotelId: 'h1' }) },
    auth: { assertOwnership: () => {} },
    logger: log,
    paymentPort: null,
  }
  return { deps, rows }
}

const posChargeDto = (reference?: string): PostChargeDTO => ({
  description: 'Restaurante · comanda CMD-1', amount: 20, quantity: 1, category: 'restaurant', source: 'pos', reference,
})

describe('postCharge — idempotencia POS (idempotencia-settlement-pos)', () => {
  it('reintento SECUENCIAL con la misma reference (crash entre chargeToFolio y orders.update) → NO duplica, devuelve el cargo existente', async () => {
    const { deps, rows } = makeDeps()
    const dto = posChargeDto('pos:order-1')

    const r1 = await postCharge(deps, 'f1', dto, user)
    const r2 = await postCharge(deps, 'f1', dto, user) // reintento: mismo orderId, mismo reference

    expect(rows.filter((r) => r.kind === 'charge')).toHaveLength(1)
    expect(r2.charge.id).toBe(r1.charge.id)
  })

  it('doble click CONCURRENTE (misma orden) → 1 solo cargo (el segundo reclamado)', async () => {
    const { deps, rows } = makeDeps()
    const dto = posChargeDto('pos:order-2')

    const [r1, r2] = await Promise.all([postCharge(deps, 'f1', dto, user), postCharge(deps, 'f1', dto, user)])

    expect(rows.filter((r) => r.kind === 'charge')).toHaveLength(1)
    expect(r1.charge.id).toBe(r2.charge.id)
  })

  it('órdenes DISTINTAS (reference distinto) → 2 cargos, uno por orden', async () => {
    const { deps, rows } = makeDeps()

    await postCharge(deps, 'f1', posChargeDto('pos:order-3'), user)
    await postCharge(deps, 'f1', posChargeDto('pos:order-4'), user)

    expect(rows.filter((r) => r.kind === 'charge')).toHaveLength(2)
  })

  it('cargo manual sin reference (no-POS) → el dedup NO aplica, cada postCharge es independiente', async () => {
    const { deps, rows } = makeDeps()
    const dto: PostChargeDTO = { description: 'Minibar', amount: 10, quantity: 1 }

    await postCharge(deps, 'f1', dto, user)
    await postCharge(deps, 'f1', dto, user)

    expect(rows.filter((r) => r.kind === 'charge')).toHaveLength(2) // comportamiento preexistente
  })
})
