import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { executeCheckin } from '../usecases/checkin'

// QA-01 (#293): al hacer check-in se abre el folio y se auto-postea el cargo de la habitación
// (source='checkin'), se marca la reserva checked_in y la habitación occupied — todo en una tx.
function makeDeps(opts: { room?: any; hotel?: any; taxConfig?: any }) {
  const created: Record<string, any[]> = { Folios: [], FolioCharges: [], Guests: [] }
  const updated: Record<string, any[]> = { Reservations: [], Rooms: [] }
  const tx = {
    create: async (table: string, data: any) => { (created[table] ||= []).push(data); return data },
    update: async (table: string, id: string, data: any) => { (updated[table] ||= []).push({ id, ...data }) },
  }
  const orm = {
    findMany: async (table: string) => {
      if (table === 'Rooms') return opts.room ? [opts.room] : []
      if (table === 'Hotels') return opts.hotel ? [opts.hotel] : []
      if (table === 'Configuration') return opts.taxConfig ? [opts.taxConfig] : []
      return []
    },
    transaction: async (fn: any) => fn(tx),
  }
  return { deps: { orm, logger: silentLogger(), repo: {}, queries: null }, created, updated }
}

const user = { id: 'u1', role: 'hotel_admin', hotelId: 'h1' }

describe('executeCheckin — auto-post room charge (QA-01)', () => {
  it('crea folio + cargo de habitación (source=checkin) y ocupa la habitación', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', checkIn: '2026-06-01', checkOut: '2026-06-03', currency: 'USD' }
    const { deps, created, updated } = makeDeps({ room: { id: 'rm1', number: '101', basePrice: 120 } })
    const result = await executeCheckin(r, user, deps)
    expect(result.ok).toBe(true)
    expect(created.Folios).toHaveLength(1)
    expect(created.FolioCharges).toHaveLength(1)
    expect(created.FolioCharges[0].amount).toBe(120)
    expect(created.FolioCharges[0].category).toBe('room')
    expect(created.FolioCharges[0].source).toBe('checkin')
    expect(updated.Reservations[0].status).toBe('checked_in')
    expect(updated.Rooms[0].status).toBe('occupied')
    expect(result.roomCharge).toBe(120)
  })

  it('no postea cargo si la tarifa es 0 (pero abre el folio igual)', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', checkIn: '2026-06-01', checkOut: '2026-06-03', totalAmount: 0 }
    const { deps, created } = makeDeps({ room: { id: 'rm1', number: '101', basePrice: 0 } })
    await executeCheckin(r, user, deps)
    expect(created.FolioCharges).toHaveLength(0)
    expect(created.Folios).toHaveLength(1)
  })

  // Bug encontrado facturando de punta a punta en un hotel recién registrado: el cargo
  // automático del check-in se posteaba con `taxes: 0` fijo en el código, sin mirar la
  // configuración del hotel — el folio arrancaba sin impuesto desde el primer cargo.
  it('aplica el impuesto de hotels.taxRate al cargo automático de habitación', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', checkIn: '2026-06-01', checkOut: '2026-06-03' }
    const { deps, created } = makeDeps({
      room: { id: 'rm1', number: '101', basePrice: 100 },
      hotel: { id: 'h1', taxRate: 18 },
    })
    await executeCheckin(r, user, deps)
    expect(created.FolioCharges[0].amount).toBe(100)
    expect(created.FolioCharges[0].taxes).toBe(18)
    expect(created.FolioCharges[0].total).toBe(118)
  })

  it('la config explícita de impuestos gana sobre hotels.taxRate', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', checkIn: '2026-06-01', checkOut: '2026-06-03' }
    const { deps, created } = makeDeps({
      room: { id: 'rm1', number: '101', basePrice: 100 },
      hotel: { id: 'h1', taxRate: 18 },
      taxConfig: { hotelId: 'h1', key: 'taxes', value: [{ tasa: 10, activo: true }] },
    })
    await executeCheckin(r, user, deps)
    expect(created.FolioCharges[0].taxes).toBe(10)
  })

  it('hotel sin tasa configurada: cargo sin impuesto, no NaN', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: 'g1', checkIn: '2026-06-01', checkOut: '2026-06-03' }
    const { deps, created } = makeDeps({ room: { id: 'rm1', number: '101', basePrice: 100 } })
    await executeCheckin(r, user, deps)
    expect(created.FolioCharges[0].taxes).toBe(0)
    expect(created.FolioCharges[0].total).toBe(100)
  })

  it('crea un guest si la reserva no tiene guestId', async () => {
    const r = { id: 'r1', hotelId: 'h1', roomId: 'rm1', guestId: null, checkIn: '2026-06-01', checkOut: '2026-06-03' }
    const { deps, created } = makeDeps({ room: { id: 'rm1', number: '101', basePrice: 100 } })
    const result = await executeCheckin(r, user, deps)
    expect(created.Guests).toHaveLength(1)
    expect(result.guestId).toBe(created.Guests[0].id)
  })
})
