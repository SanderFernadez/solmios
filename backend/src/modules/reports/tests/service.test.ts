import { describe, it, expect } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { ReportsService } from '../service'
import { ReportQueries } from '../usecases/report-queries'
import { csvValue } from '../helpers'

const log = silentLogger()

function makeOrm(overrides: Partial<Record<string, any>> = {}) {
  return {
    findMany: async (table: string, _filter: any) => {
      if (table === 'Reservations') return [{ id: 'r1', totalAmount: 200, status: 'checked_in', checkIn: '2026-06-01', checkOut: '2026-06-03', channel: 'booking' }]
      if (table === 'Rooms') return [{ id: 'rm1', type: 'standard', status: 'occupied' }]
      if (table === 'Guests') return [{ id: 'g1', name: 'Guest', totalSpent: 200 }]
      if (table === 'Expenses') return []
      if (table === 'FolioCharges') return []
      if (table === 'RoomBlocks') return []
      if (table === 'Hotels') return [{ id: 'h1', taxRate: 18 }]
      if (table === 'Users') return [{ id: 'u1', hotelId: 'h1' }]
      return []
    },
    ...overrides,
  }
}

describe('ReportsService', () => {
  describe('getReports', () => {
    it('returns report summary', async () => {
      const svc = new ReportsService(log, new ReportQueries(makeOrm()))
      const result = await svc.getReports({ user: { id: 'u1', role: 'hotel_admin' }, query: {} })
      expect(result.totalRevenue).toBe(200)
    })
  })

  describe('csvValue', () => {
    it('escapes CSV values correctly', () => {
      expect(csvValue('simple')).toBe('simple')
      expect(csvValue('with,comma')).toBe('"with,comma"')
      expect(csvValue(null)).toBe('')
    })
  })
})
