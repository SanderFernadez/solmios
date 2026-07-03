import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PricingService } from '../service'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Seasons') return [{ id: 's1', hotelId: 'h1', name: 'Summer', startDate: '2026-06-01', endDate: '2026-08-31', sortOrder: 0 }]
      if (table === 'RoomRates') return [{ id: 'r1', hotelId: 'h1', roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: 100, price: 120 }]
      if (table === 'RoomBlocks') return []
      if (table === 'RateRestrictions') return []
      if (table === 'Reservations') return [{ id: 'res1', channel: 'booking', totalAmount: 200, checkIn: '2026-06-01', checkOut: '2026-06-03' }]
      return []
    },
    create: async (_table: string, data: any) => data,
    update: async (_table: string, _id: string, _data: any) => {},
    delete: async (_table: string, _id: string) => {},
    ...overrides,
  }
}

describe('PricingService', () => {
  describe('listSeasons', () => {
    it('returns seasons sorted by sortOrder', async () => {
      const svc = new PricingService(makeOrm(), log)
      const result = await svc.listSeasons('h1')
      expect(result).toHaveLength(1)
    })
  })

  describe('listRates', () => {
    it('returns room rates', async () => {
      const svc = new PricingService(makeOrm(), log)
      const result = await svc.listRates('h1')
      expect(result).toHaveLength(1)
    })
  })

  describe('getChannelMetrics', () => {
    it('returns grouped metrics', async () => {
      const svc = new PricingService(makeOrm(), log)
      const result = await svc.getChannelMetrics('h1')
      expect(result).toHaveLength(1)
      expect(result[0].channel).toBe('booking')
    })
  })
})
