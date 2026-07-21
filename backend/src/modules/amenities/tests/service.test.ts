import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { AmenitiesService } from '../service'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'HotelAmenities') return [{ id: 'h1', hotelId: 'h1', amenityKey: 'wifi', isActive: 1 }]
      if (table === 'RoomAmenities') return [{ id: 'r1', roomId: 'rm1', amenityKey: 'ac', isActive: 1 }]
      return []
    },
    create: async (_table: string, data: any) => data,
    update: async (_table: string, _id: string, _data: any) => {},
    ...overrides,
  }
}

function makeRepo(orm: any, table: string) {
  return {
    findMany: async (filter: any) => orm.findMany(table, filter),
    findById: async (id: string) => orm.findById?.(table, id),
    findOne: async (filter: any) => { const rows = await orm.findMany(table, filter); return rows[0] || null },
    create: async (data: any) => orm.create(table, data),
    update: async (id: string, data: any) => orm.update(table, id, data),
    delete: async (id: string) => orm.delete(table, id),
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

describe('AmenitiesService', () => {
  describe('getStaticCatalog', () => {
    it('returns categorized amenities', () => {
      const svc = new AmenitiesService({} as any, {} as any, log)
      const catalog = svc.getStaticCatalog()
      expect(catalog.interior).toContain('ac')
      expect(catalog.interior).toContain('wifi')
      expect(catalog.exterior).toContain('pool')
      expect(catalog.services).toContain('room_service')
    })
  })

  describe('listHotelAmenities', () => {
    it('returns hotel amenities', async () => {
      const orm = makeOrm()
      const svc = new AmenitiesService(makeRepo(orm, 'HotelAmenities'), makeRepo(orm, 'RoomAmenities'), log)
      const result = await svc.listHotelAmenities('h1')
      expect(result).toHaveLength(1)
      expect(result[0].amenityKey).toBe('wifi')
    })
  })

  describe('listRoomAmenities', () => {
    it('returns room amenities', async () => {
      const orm = makeOrm()
      const svc = new AmenitiesService(makeRepo(orm, 'HotelAmenities'), makeRepo(orm, 'RoomAmenities'), log)
      const result = await svc.listRoomAmenities('rm1')
      expect(result).toHaveLength(1)
      expect(result[0].amenityKey).toBe('ac')
    })
  })

  describe('updateRoomAmenities → onRoomAmenitiesUpdated (sync CSV)', () => {
    it('emite onRoomAmenitiesUpdated con las keys asignadas', async () => {
      const orm = makeOrm({ findMany: async () => [] })  // sin existentes → todas se crean
      const svc = new AmenitiesService(makeRepo(orm, 'HotelAmenities'), makeRepo(orm, 'RoomAmenities'), log)
      let payload: { roomId: string; keys: string[] } | null = null
      svc.setSockets({ onRoomAmenitiesUpdated: async (roomId, keys) => { payload = { roomId, keys } } })
      await svc.updateRoomAmenities('rm1', ['wifi', 'pool', 'tv'])
      expect(payload).not.toBeNull()
      expect(payload!.roomId).toBe('rm1')
      expect(payload!.keys).toEqual(['wifi', 'pool', 'tv'])
    })
  })
})
