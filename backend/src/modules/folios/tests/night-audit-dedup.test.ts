// night-audit-dedup.test.ts — El cron nocturno no puede cobrar la misma noche dos veces.
//
// El cron corre CADA 3 HORAS sobre todos los hoteles. La dedup se hacía con
// `findMany('FolioCharges', { folioId, description: { contains: hoy } })`, pero el `buildWhere`
// del framework (kernel/db/orm-utils.ts) no soporta operadores: traduce cada clave a `campo = ?`.
// El `{ contains }` viajaba como objeto, no matcheaba nunca, y cada pasada posteaba otro cargo de
// habitación: 8 cargos por noche y por folio abierto.
//
// El mock de `findMany` de acá imita `buildWhere` A PROPÓSITO — solo igualdad estricta. Un mock
// más permisivo (que resolviera `{contains}`) haría pasar el test con el bug adentro.
import { describe, it, expect } from 'bun:test'
import { postNightAuditRoomCharges } from '../usecases/night-audit'

const TODAY = new Date().toISOString().split('T')[0]
const ROOM_RATE = 100

function makeWorld(existingCharges: any[] = []) {
  const hotels = [{ id: 'h1', name: 'Demo' }]
  const rooms = [{ id: 'room-1', hotelId: 'h1', number: '101', basePrice: ROOM_RATE }]
  const reservations = [{
    id: 'res-1', hotelId: 'h1', roomId: 'room-1', guestId: 'g1',
    status: 'checked_in', checkIn: TODAY, checkOut: '2099-01-01',
  }]
  const charges: any[] = [...existingCharges]
  const folios = [{ id: 'folio-1', hotelId: 'h1', reservationId: 'res-1', status: 'open' }]

  const orm: any = {
    async findMany(model: string, filter: any = {}) {
      const src = model === 'Hotels' ? hotels : model === 'Rooms' ? rooms
        : model === 'Reservations' ? reservations : model === 'FolioCharges' ? charges : []
      // Igualdad estricta, igual que buildWhere: sin operadores.
      return src.filter((r: any) => Object.entries(filter ?? {}).every(([k, v]) => r[k] === v))
    },
  }

  const listFolios = async () => ({ data: folios })
  const openFolio = async () => folios[0]
  const postCharge = async (folioId: string, dto: any) => {
    const row = { id: 'c' + (charges.length + 1), folioId, ...dto }
    charges.push(row)
    return row
  }

  return { orm, listFolios, openFolio, postCharge, charges }
}

const SYSTEM = { id: 'system', role: 'super_admin', hotelId: 'h1' }

describe('postNightAuditRoomCharges — dedup del cargo nocturno', () => {
  it('tres pasadas del cron cobran la noche UNA sola vez', async () => {
    const w = makeWorld()

    const r1 = await postNightAuditRoomCharges(w.orm, w.listFolios, w.openFolio, w.postCharge, SYSTEM, {})
    const r2 = await postNightAuditRoomCharges(w.orm, w.listFolios, w.openFolio, w.postCharge, SYSTEM, {})
    const r3 = await postNightAuditRoomCharges(w.orm, w.listFolios, w.openFolio, w.postCharge, SYSTEM, {})

    expect(r1.posted).toBe(1)
    expect(r2.posted).toBe(0)
    expect(r2.skipped).toBe(1)
    expect(r3.posted).toBe(0)
    expect(w.charges).toHaveLength(1)
    expect(w.charges.reduce((a, c) => a + (c.amount || 0), 0)).toBe(ROOM_RATE)
  })

  it('no vuelve a cobrar la noche que ya se cargó en el check-in', async () => {
    // `checkin.ts` postea "Habitación 101 — <fecha>" al registrar al huésped. Si el cron no lo
    // reconociera, la primera noche de cada estadía se cobraría dos veces.
    const w = makeWorld([
      { id: 'c0', folioId: 'folio-1', description: `Habitación 101 — ${TODAY}`, amount: ROOM_RATE, source: 'checkin' },
    ])

    const res = await postNightAuditRoomCharges(w.orm, w.listFolios, w.openFolio, w.postCharge, SYSTEM, {})

    expect(res.posted).toBe(0)
    expect(res.skipped).toBe(1)
    expect(w.charges).toHaveLength(1)
  })

  it('un cargo de OTRO día no bloquea el de hoy', async () => {
    const w = makeWorld([
      { id: 'c0', folioId: 'folio-1', description: 'Habitación 101 — 2020-01-01', amount: ROOM_RATE, source: 'night_audit' },
    ])

    const res = await postNightAuditRoomCharges(w.orm, w.listFolios, w.openFolio, w.postCharge, SYSTEM, {})

    expect(res.posted).toBe(1)
    expect(w.charges).toHaveLength(2)
  })
})
