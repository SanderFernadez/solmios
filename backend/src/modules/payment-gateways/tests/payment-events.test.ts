// payment-events.test.ts — la barrera anti-doble-cobro.

import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PaymentEventStore, type PaymentEventRow } from '../../../services/payment-gateway/payment-events'

const log = silentLogger()

/**
 * Repo en memoria que impone la PK única, igual que la base real: dos inserts con el mismo id
 * fallan. Es exactamente lo que da la atomicidad.
 */
function memRepo() {
  const rows = new Map<string, PaymentEventRow>()
  return {
    rows,
    create: async (d: any) => {
      if (rows.has(d.id)) throw new Error('UNIQUE constraint failed: payment_events.id')
      rows.set(d.id, d)
      return d
    },
    delete: async (id: string) => { rows.delete(id) },
    findById: async (id: string) => rows.get(id) ?? null,
    findMany: async () => [...rows.values()],
    update: async () => {},
    count: async () => rows.size,
  } as any
}

function store() {
  const repo = memRepo()
  return { st: new PaymentEventStore(repo, log, () => '2026-07-15T00:00:00.000Z'), repo }
}

describe('PaymentEventStore — idempotencia de cobros', () => {
  it('corre el efecto una vez y asienta el evento', async () => {
    const { st, repo } = store()
    let asentado = 0
    const r = await st.settleOnce('h1', 'stripe', 'evt_1', { amountMinor: 5000 }, async () => { asentado++ })
    expect(r.outcome).toBe('processed')
    expect(asentado).toBe(1)
    expect(repo.rows.has('stripe:evt_1')).toBe(true)
  })

  it('un reintento del MISMO evento NO vuelve a asentar', async () => {
    const { st } = store()
    let asentado = 0
    const effect = async () => { asentado++ }
    await st.settleOnce('h1', 'stripe', 'evt_1', {}, effect)
    const segundo = await st.settleOnce('h1', 'stripe', 'evt_1', {}, effect)
    expect(segundo.outcome).toBe('duplicate')
    expect(asentado).toBe(1) // una sola vez, aunque el webhook llegó dos veces
  })

  it('dos webhooks CONCURRENTES del mismo evento → un solo asiento', async () => {
    const { st } = store()
    let asentado = 0
    const effect = async () => { await Promise.resolve(); asentado++ }
    // Sin await entre medio: los dos claims corren "a la vez".
    const [a, b] = await Promise.all([
      st.settleOnce('h1', 'stripe', 'evt_dup', {}, effect),
      st.settleOnce('h1', 'stripe', 'evt_dup', {}, effect),
    ])
    const outcomes = [a.outcome, b.outcome].sort()
    expect(outcomes).toEqual(['duplicate', 'processed'])
    expect(asentado).toBe(1) // la barrera de PK evitó el doble cobro
  })

  it('si el efecto FALLA, libera la reserva para que el reintento reprocese', async () => {
    const { st, repo } = store()
    // Primer intento: el asiento falla (ej. la base se cayó a mitad).
    await expect(
      st.settleOnce('h1', 'stripe', 'evt_2', {}, async () => { throw new Error('DB caída') }),
    ).rejects.toThrow('DB caída')
    // La reserva NO quedó: el evento puede reprocesarse.
    expect(repo.rows.has('stripe:evt_2')).toBe(false)

    // Reintento de Stripe con el mismo evento: ahora sí asienta.
    let ok = false
    const r = await st.settleOnce('h1', 'stripe', 'evt_2', {}, async () => { ok = true })
    expect(r.outcome).toBe('processed')
    expect(ok).toBe(true)
  })

  it('el mismo eventId en proveedores distintos NO colisiona', async () => {
    const { st } = store()
    const r1 = await st.settleOnce('h1', 'stripe', 'evt_x', {}, async () => {})
    const r2 = await st.settleOnce('h1', 'paypal', 'evt_x', {}, async () => {})
    expect(r1.outcome).toBe('processed')
    expect(r2.outcome).toBe('processed') // id = provider:eventId, no colisionan
  })

  it('sin eventId corre el efecto pero sin barrera (y avisa)', async () => {
    const { st, repo } = store()
    let asentado = 0
    const r = await st.settleOnce('h1', 'stripe', '', {}, async () => { asentado++ })
    expect(r.outcome).toBe('processed')
    expect(asentado).toBe(1)
    expect(repo.rows.size).toBe(0) // nada que reservar sin id
  })

  it('un error REAL de base (no duplicado) se propaga, no se traga como duplicado', async () => {
    const repo = memRepo()
    repo.create = async () => { throw new Error('connection refused') }
    const st = new PaymentEventStore(repo, log, () => 'x')
    await expect(st.settleOnce('h1', 'stripe', 'evt_9', {}, async () => {})).rejects.toThrow('connection refused')
  })
})
