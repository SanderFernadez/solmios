// attendance/tests/service.test.ts
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AttendanceService } from '../service'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true, count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('AttendanceService', () => {
  describe('clockIn', () => {
    it('ficha entrada correctamente', async () => {
      const svc = new AttendanceService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const r = await svc.clockIn('e1', 'h1', 'pin')
      expect(r.status).toBe('present')
    })

    it('rechaza doble entrada', async () => {
      const recordMock = makeRepo({ findOne: async () => ({ id: 'r1', employeeId: 'e1', date: new Date().toISOString().slice(0,10), clockIn: '2026-01-01T08:00:00Z' }) })
      const svc = new AttendanceService(recordMock, makeRepo(), makeRepo(), log, silentCache)
      await expect(svc.clockIn('e1', 'h1')).rejects.toThrow('ya registrada')
    })
  })

  describe('clockOut', () => {
    it('rechaza salida sin entrada', async () => {
      const svc = new AttendanceService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      await expect(svc.clockOut('e1', 'h1')).rejects.toThrow('entrada primero')
    })
  })

  describe('getConfig', () => {
    it('retorna config existente', async () => {
      const configMock = makeRepo({ findOne: async () => ({ id: 'c1', hotelId: 'h1', autoClockOut: 1, overtimeMultiplier: 1.5 }) })
      const svc = new AttendanceService(makeRepo(), makeRepo(), configMock, log, silentCache)
      const c = await svc.getConfig('h1')
      expect(c.autoClockOut).toBe(1)
      expect(c.overtimeMultiplier).toBe(1.5)
    })
  })

  describe('createSchedule', () => {
    it('crea horario', async () => {
      const svc = new AttendanceService(makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const s = await svc.createSchedule({ hotelId: 'h1', name: 'Mañana', startTime: '06:00', endTime: '14:00' })
      expect(s.name).toBe('Mañana')
    })
  })
})
