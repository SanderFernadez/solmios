// Tests de syncRoomAmenitiesCsv — denormaliza RoomAmenities → Rooms.amenities (CSV).
import { describe, it, expect } from 'bun:test'
import { syncRoomAmenitiesCsv } from '../sync-room-amenities-csv'

function makeOrm() {
  const updates: Array<{ model: string; id: string; data: any }> = []
  return { updates, orm: { update: async (model: string, id: string, data: any) => { updates.push({ model, id, data }); return data } } }
}

describe('syncRoomAmenitiesCsv', () => {
  it('escribe el CSV en Rooms.amenities con las keys unidas por coma', async () => {
    const { orm, updates } = makeOrm()
    await syncRoomAmenitiesCsv(orm, 'rm1', ['wifi', 'pool', 'tv'])
    expect(updates).toEqual([{ model: 'Rooms', id: 'rm1', data: { amenities: 'wifi,pool,tv' } }])
  })

  it('con lista vacía escribe CSV vacío (no rompe)', async () => {
    const { orm, updates } = makeOrm()
    await syncRoomAmenitiesCsv(orm, 'rm1', [])
    expect(updates[0].data.amenities).toBe('')
  })
})
