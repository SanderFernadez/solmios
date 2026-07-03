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

describe('AmenitiesService', () => {
  describe('getStaticCatalog', () => {
    it('returns categorized amenities', () => {
      const svc = new AmenitiesService({} as any, log)
      const catalog = svc.getStaticCatalog()
      expect(catalog.interior).toContain('ac')
      expect(catalog.interior).toContain('wifi')
      expect(catalog.exterior).toContain('pool')
      expect(catalog.services).toContain('room_service')
    })
  })

  describe('listHotelAmenities', () => {
    it('returns hotel amenities', async () => {
      const svc = new AmenitiesService(makeOrm(), log)
      const result = await svc.listHotelAmenities('h1')
      expect(result).toHaveLength(1)
      expect(result[0].amenityKey).toBe('wifi')
    })
  })

  describe('listRoomAmenities', () => {
    it('returns room amenities', async () => {
      const svc = new AmenitiesService(makeOrm(), log)
      const result = await svc.listRoomAmenities('rm1')
      expect(result).toHaveLength(1)
      expect(result[0].amenityKey).toBe('ac')
    })
  })
})
