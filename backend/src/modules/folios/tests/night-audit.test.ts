import { describe, it, expect } from 'bun:test'
import { postNightAuditRoomCharges } from '../usecases/night-audit'

// QA-05 (#305): night audit — postea el cargo de habitación a los folios de las reservas
// in-house, una vez por día (dedup por fecha en la descripción del cargo).
const TODAY = new Date().toISOString().slice(0, 10)
function shift(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function setup(opts: { reservations: any[]; rooms: any[]; existingFolios?: any[]; existingCharges?: Record<string, any[]> }) {
  const posted: any[] = []
  const folios: any[] = [...(opts.existingFolios || [])]
  const charges = opts.existingCharges || {}
  const orm = {
    findMany: async (table: string, filter: any) => {
      if (table === 'Reservations') return opts.reservations
      if (table === 'Rooms') return opts.rooms
      if (table === 'Hotels') return [{ id: 'h1' }]
      if (table === 'FolioCharges') {
        const list = charges[filter.folioId] || []
        const needle = filter?.description?.contains
        return needle ? list.filter((c: any) => String(c.description).includes(needle)) : list
      }
      return []
    },
  }
  const listFolios = async (q: any) => ({ data: folios.filter((f) => f.reservationId === q.reservationId && f.status === q.status) })
  const openFolio = async (d: any) => { const f = { id: 'folio-' + d.reservationId, ...d, status: 'open' }; folios.push(f); return f }
  const postCharge = async (folioId: string, charge: any) => { posted.push({ folioId, ...charge }) }
  return { orm, listFolios, openFolio, postCharge, posted }
}

const user = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

describe('night audit — postNightAuditRoomCharges (QA-05)', () => {
  it('postea el cargo de habitación a una reserva in-house (checked_in, hoy en rango)', async () => {
    const s = setup({
      reservations: [{ id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', status: 'checked_in', checkIn: shift(-1), checkOut: shift(2) }],
      rooms: [{ id: 'rm1', number: '101', basePrice: 100 }],
    })
    const result = await postNightAuditRoomCharges(s.orm, s.listFolios, s.openFolio, s.postCharge, user)
    expect(result.posted).toBe(1)
    expect(s.posted).toHaveLength(1)
    expect(s.posted[0].amount).toBe(100)
    expect(s.posted[0].category).toBe('room')
    expect(s.posted[0].source).toBe('night_audit')
    expect(String(s.posted[0].description)).toContain(TODAY)
  })

  it('NO postea a reservas que no están in-house (checked_out, pendiente o fuera de rango)', async () => {
    const s = setup({
      reservations: [
        { id: 'r1', hotelId: 'h1', roomId: 'rm1', status: 'checked_out', checkIn: shift(-3), checkOut: shift(-1) },
        { id: 'r2', hotelId: 'h1', roomId: 'rm1', status: 'confirmed', checkIn: shift(1), checkOut: shift(3) },
      ],
      rooms: [{ id: 'rm1', number: '101', basePrice: 100 }],
    })
    const result = await postNightAuditRoomCharges(s.orm, s.listFolios, s.openFolio, s.postCharge, user)
    expect(result.posted).toBe(0)
    expect(s.posted).toHaveLength(0)
  })

  it('dedup por fecha: no vuelve a postear si el folio ya tiene el cargo de hoy', async () => {
    const s = setup({
      reservations: [{ id: 'r1', hotelId: 'h1', roomId: 'rm1', status: 'checked_in', checkIn: shift(-1), checkOut: shift(2) }],
      rooms: [{ id: 'rm1', number: '101', basePrice: 100 }],
      existingFolios: [{ id: 'f1', reservationId: 'r1', status: 'open' }],
      existingCharges: { f1: [{ description: `Habitación 101 — ${TODAY}` }] },
    })
    const result = await postNightAuditRoomCharges(s.orm, s.listFolios, s.openFolio, s.postCharge, user)
    expect(result.posted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(s.posted).toHaveLength(0)
  })

  it('abre el folio si la reserva in-house no tiene uno abierto', async () => {
    const s = setup({
      reservations: [{ id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', status: 'checked_in', checkIn: shift(0), checkOut: shift(3) }],
      rooms: [{ id: 'rm1', number: '205', basePrice: 150 }],
    })
    const result = await postNightAuditRoomCharges(s.orm, s.listFolios, s.openFolio, s.postCharge, user)
    expect(result.posted).toBe(1)
    expect(s.posted[0].folioId).toBe('folio-r1')  // se abrió el folio y se le posteó
    expect(s.posted[0].amount).toBe(150)
  })
})
