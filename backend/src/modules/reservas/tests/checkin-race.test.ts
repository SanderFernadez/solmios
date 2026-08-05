// checkin-race.test.ts — Doble check-in: la estadía cargada dos veces al folio.
//
// `checkinValidation` rechaza una reserva que ya tiene check-in, pero eso ocurre en OTRA función y
// FUERA de la transacción de `executeCheckin`. Dos llamadas concurrentes (doble click en el
// mostrador, dos recepcionistas, un reintento del cliente) pasaban las dos: se creaban DOS folios
// y DOS cargos de habitación, así que el huésped terminaba con la noche cobrada dos veces.
// Reproducido antes del fix: 2 folios, 2 cargos, total 200 en vez de 100.
//
// El guardián es un UPDATE condicional (`id` + estado esperado) al principio de la transacción:
// solo una logra mover la reserva a `checked_in`; la otra ve 0 filas afectadas y aborta con 409.
import { describe, it, expect } from 'bun:test'
import { executeCheckin } from '../usecases/checkin'

function makeWorld(reservationStatus = 'confirmed') {
  const rooms: any[] = [{ id: 'room-1', hotelId: 'h1', number: '101', basePrice: 100, status: 'available' }]
  const reservations: any[] = [{
    id: 'res-1', hotelId: 'h1', roomId: 'room-1', guestId: 'g1',
    checkIn: '2026-12-01', checkOut: '2026-12-03',
    status: reservationStatus, totalAmount: 200, currency: 'USD',
  }]
  const folios: any[] = []
  const charges: any[] = []

  const pick = (m: string) =>
    m === 'Rooms' ? rooms : m === 'Reservations' ? reservations
    : m === 'Folios' ? folios : m === 'FolioCharges' ? charges : []
  const match = (row: any, f: any) => Object.entries(f ?? {}).every(([k, v]) => row[k] === v)

  const orm: any = {
    async findMany(model: string, filter: any = {}) {
      await new Promise(r => setTimeout(r, 0))   // permite que las dos corridas se intercalen
      return pick(model).filter((r: any) => match(r, filter))
    },
    async findOne(model: string, filter: any = {}) {
      return (await orm.findMany(model, filter))[0] ?? null
    },
    async transaction(fn: (tx: any) => Promise<void>) {
      const tx = {
        async create(model: string, data: any) { const row = { ...data }; pick(model).push(row); return row },
        async update(model: string, id: string, patch: any) {
          const row = pick(model).find((r: any) => r.id === id)
          if (row) Object.assign(row, patch)
          return row ?? null
        },
        async updateMany(model: string, filter: any, patch: any) {
          const hit = pick(model).filter((r: any) => match(r, filter))
          hit.forEach((r: any) => Object.assign(r, patch))
          return hit.length
        },
        async findOne(model: string, filter: any = {}) { return pick(model).filter((r: any) => match(r, filter))[0] ?? null },
        async findMany(model: string, filter: any = {}) { return pick(model).filter((r: any) => match(r, filter)) },
      }
      await fn(tx)
    },
  }

  return { orm, reservations, folios, charges }
}

const USER = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }
const deps = (orm: any) => ({ orm, logger: { info() {}, warn() {}, error() {} }, repo: {} as any })

describe('executeCheckin — doble check-in concurrente', () => {
  it('cobra la habitación UNA sola vez y abre UN solo folio', async () => {
    const w = makeWorld()
    const reserva = w.reservations[0]

    const results = await Promise.allSettled([
      executeCheckin(reserva, USER, deps(w.orm)),
      executeCheckin(reserva, USER, deps(w.orm)),
    ])

    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1)
    expect(w.folios).toHaveLength(1)
    expect(w.charges).toHaveLength(1)
    expect(w.charges[0].amount).toBe(100)
  })

  it('el check-in normal (sin concurrencia) sigue funcionando', async () => {
    const w = makeWorld()
    await executeCheckin(w.reservations[0], USER, deps(w.orm))

    expect(w.folios).toHaveLength(1)
    expect(w.charges).toHaveLength(1)
    expect(w.reservations[0].status).toBe('checked_in')
    expect(w.reservations[0].folioId).toBe(w.folios[0].id)
  })

  it('una reserva pending también se puede registrar (no solo confirmed)', async () => {
    const w = makeWorld('pending')
    await executeCheckin(w.reservations[0], USER, deps(w.orm))

    expect(w.reservations[0].status).toBe('checked_in')
    expect(w.charges).toHaveLength(1)
  })
})
