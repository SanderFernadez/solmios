import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { PricingService } from '../service'
import { PricingQueries } from '../usecases/pricing-queries'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Seasons') return [{ id: 's1', hotelId: 'h1', name: 'Summer', startDate: '2026-06-01', endDate: '2026-08-31', sortOrder: 0 }]
      if (table === 'RoomRates') return [{ id: 'r1', hotelId: 'h1', roomType: 'standard', season: 'Summer', occupancy: 2, basePrice: 100, price: 120 }]
      if (table === 'RoomBlocks') return []
      if (table === 'RateRestrictions') return []
      if (table === 'Reservations') return [{ id: 'res1', channel: 'booking', totalAmount: 200, checkIn: '2026-06-01', checkOut: '2026-06-03' }]
      if (table === 'Rooms') return [{ id: 'rm1', type: 'standard' }]
      return []
    },
    create: async (_table: string, data: any) => data,
    update: async (_table: string, _id: string, _data: any) => {},
    delete: async (_table: string, _id: string) => {},
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

function makeService(ormOverride?: any) {
  const orm = ormOverride || makeOrm()
  const seasonsRepo = makeRepo(orm, 'Seasons')
  const ratesRepo = makeRepo(orm, 'RoomRates')
  const blocksRepo = makeRepo(orm, 'RoomBlocks')
  const restrictionsRepo = makeRepo(orm, 'RateRestrictions')
  const queries = new PricingQueries(orm)
  return new PricingService(seasonsRepo, ratesRepo, blocksRepo, restrictionsRepo, log, queries)
}

describe('PricingService', () => {
  describe('listSeasons', () => {
    it('returns seasons sorted by sortOrder', async () => {
      const svc = makeService()
      const result = await svc.listSeasons('h1')
      expect(result).toHaveLength(1)
    })
  })

  describe('listRates', () => {
    it('returns room rates', async () => {
      const svc = makeService()
      const result = await svc.listRates('h1')
      expect(result).toHaveLength(1)
    })
  })

  describe('getChannelMetrics', () => {
    it('returns grouped metrics', async () => {
      const svc = makeService()
      const result = await svc.getChannelMetrics('h1')
      expect(result).toHaveLength(1)
      expect(result[0].channel).toBe('booking')
    })
  })
})
