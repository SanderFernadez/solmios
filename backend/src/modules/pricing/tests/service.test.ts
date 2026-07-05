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

  // ─── Filter-aware ORM with in-memory store (for upsert/dedup tests) ───
  function makeRatesStoreOrm(initial: any[]) {
    const store: any[] = [...initial]
    const created: any[] = []
    const updated: any[] = []
    return {
      store, created, updated,
      orm: {
        findMany: async (_table: string, filter: any) => {
          if (!filter || _table !== 'RoomRates') return [...store]
          return store.filter((r) =>
            (filter.hotelId === undefined || r.hotelId === filter.hotelId) &&
            (filter.roomType === undefined || r.roomType === filter.roomType) &&
            (filter.occupancy === undefined || r.occupancy === filter.occupancy) &&
            (filter.season === undefined || r.season === filter.season),
          )
        },
        create: async (_table: string, data: any) => { store.push(data); created.push(data); return data },
        update: async (_table: string, id: string, data: any) => {
          const r = store.find((x) => x.id === id)
          if (r) Object.assign(r, data)
          updated.push({ id, data })
        },
        delete: async () => {},
      },
    }
  }

  function makeServiceFromOrm(orm: any) {
    const mk = (table: string) => ({
      findMany: async (filter: any) => orm.findMany(table, filter),
      findById: async () => null,
      findOne: async (filter: any) => { const rows = await orm.findMany(table, filter); return rows[0] || null },
      create: async (data: any) => orm.create(table, data),
      update: async (id: string, data: any) => orm.update(table, id, data),
      delete: async () => {},
      count: async () => 0,
      paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    })
    return new PricingService(mk('Seasons'), mk('RoomRates'), mk('RoomBlocks'), mk('RateRestrictions'), log)
  }

  describe('updateRates', () => {
    it('calculates price = basePrice * (1 + percentage/100) and updates existing', async () => {
      const { orm, updated } = makeRatesStoreOrm([
        { id: 'r1', hotelId: 'h1', roomType: 'standard', occupancy: 2, season: 'Summer', basePrice: 100, percentage: 0, price: 100, closed: 0 },
      ])
      const svc = makeServiceFromOrm(orm)
      const count = await svc.updateRates('h1', [
        { roomType: 'standard', occupancy: 2, season: 'Summer', basePrice: 100, percentage: 20, closed: false },
      ])
      expect(count).toBe(1)
      expect(updated).toHaveLength(1)
      expect(updated[0].id).toBe('r1')
      expect(updated[0].data.price).toBe(120)
      expect(updated[0].data.basePrice).toBe(100)
      expect(updated[0].data.percentage).toBe(20)
      expect(updated[0].data.closed).toBe(0)
    })

    it('creates a new rate when combination does not exist', async () => {
      const { orm, store, created } = makeRatesStoreOrm([])
      const svc = makeServiceFromOrm(orm)
      const count = await svc.updateRates('h1', [
        { roomType: 'suite', occupancy: 1, season: 'Winter', basePrice: 80, percentage: 0, closed: true },
      ])
      expect(count).toBe(1)
      expect(created).toHaveLength(1)
      const created0 = created[0]
      expect(created0.roomType).toBe('suite')
      expect(created0.season).toBe('Winter')
      expect(created0.price).toBe(80)
      expect(created0.closed).toBe(1)
      expect(store.find((r) => r.roomType === 'suite' && r.season === 'Winter')).toBeTruthy()
    })

    it('skips rates missing roomType/season/occupancy', async () => {
      const { orm } = makeRatesStoreOrm([])
      const svc = makeServiceFromOrm(orm)
      const count = await svc.updateRates('h1', [
        { occupancy: 2, season: 'Summer', basePrice: 100, percentage: 0 } as any, // missing roomType
      ])
      expect(count).toBe(0)
    })
  })

  describe('copyRatesNextYear', () => {
    it('copies rates to next year when target does not exist', async () => {
      const nextYear = new Date().getFullYear() + 1
      const { orm, store } = makeRatesStoreOrm([
        { id: 'r1', hotelId: 'h1', roomType: 'standard', occupancy: 2, season: 'Summer2026', basePrice: 100, percentage: 0, price: 100 },
      ])
      const svc = makeServiceFromOrm(orm)
      const result = await svc.copyRatesNextYear('h1')
      expect(result.total).toBe(1)
      expect(result.copied).toBe(1)
      expect(store.find((r) => r.season === `Summer${nextYear}`)).toBeTruthy()
    })

    it('skips when target year already exists (no duplicate)', async () => {
      const nextYear = new Date().getFullYear() + 1
      const { orm, store } = makeRatesStoreOrm([
        { id: 'r1', hotelId: 'h1', roomType: 'standard', occupancy: 2, season: 'Summer2026', basePrice: 100, percentage: 0, price: 100 },
        { id: 'r2', hotelId: 'h1', roomType: 'standard', occupancy: 2, season: `Summer${nextYear}`, basePrice: 100, percentage: 0, price: 100 },
      ])
      const svc = makeServiceFromOrm(orm)
      const result = await svc.copyRatesNextYear('h1')
      expect(result.total).toBe(2)
      expect(result.copied).toBe(0)
      expect(store.filter((r) => r.season === `Summer${nextYear}`)).toHaveLength(1)
    })
  })
})
