import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { DashboardService } from '../service'
import { DashboardQueries } from '../usecases/dashboard-queries'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Rooms') return [
        { id: 'rm1', type: 'standard', status: 'occupied', number: '101' },
        { id: 'rm2', type: 'suite', status: 'vacant', number: '201' },
      ]
      if (table === 'Reservations') return [
        { id: 'r1', totalAmount: 200, status: 'checked_in', checkIn: new Date().toISOString(), checkOut: new Date(Date.now() + 86400000).toISOString(), roomId: 'rm1', guestId: 'g1' },
      ]
      if (table === 'Guests') return [{ id: 'g1', name: 'John', email: 'john@test.com' }]
      if (table === 'Users') return [{ id: 'u1', hotelId: 'h1' }]
      if (table === 'Hotels') return [{ id: 'h1' }]
      return []
    },
    ...overrides,
  }
}

describe('DashboardService', () => {
  describe('getDashboard', () => {
    it('returns aggregated dashboard data', async () => {
      const svc = new DashboardService(log, new DashboardQueries(makeOrm()))
      const result = await svc.getDashboard({ user: { id: 'u1' }, query: {} })
      expect(result.totalRooms).toBe(2)
      expect(result.occupied).toBe(1)
      expect(result.revenue).toBe(200)
    })

    it('excludes cancelled and no-show reservations from revenue', async () => {
      const orm = makeOrm({
        findMany: async (table: string) => {
          if (table === 'Reservations') return [
            { id: 'r1', totalAmount: 200, status: 'checked_in', checkIn: new Date().toISOString() },
            { id: 'r2', totalAmount: 500, status: 'cancelled', checkIn: new Date().toISOString() },
            { id: 'r3', totalAmount: 300, status: 'no_show', checkIn: new Date().toISOString() },
          ]
          if (table === 'Rooms') return [{ id: 'rm1', type: 'standard', status: 'occupied' }]
          if (table === 'Guests') return [{ id: 'g1', name: 'John' }]
          return []
        },
      })
      const svc = new DashboardService(log, new DashboardQueries(orm))
      const result = await svc.getDashboard({ query: { hotelId: 'h1' } })
      // Solo r1 (200) cuenta; cancelled (500) y no_show (300) se excluyen del dinero.
      expect(result.revenue).toBe(200)
      expect(result.revenueToday).toBe(200)
    })
  })

  describe('getPlanning', () => {
    it('returns rooms and enriched reservations', async () => {
      const svc = new DashboardService(log, new DashboardQueries(makeOrm()))
      const result = await svc.getPlanning({ user: { id: 'u1' }, query: {} })
      expect(result.rooms).toHaveLength(2)
      expect(result.reservas).toHaveLength(1)
    })
  })
})
