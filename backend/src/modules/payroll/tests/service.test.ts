// payroll/tests/service.test.ts
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PayrollService } from '../service'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data }),
    update: async (id, data) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('PayrollService', () => {
  describe('getConfig', () => {
    it('crea config por defecto si no existe', async () => {
      const svc = new PayrollService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const config = await svc.getConfig('h1')
      expect(config.currency).toBe('DOP')
      expect(config.paymentFrequency).toBe('monthly')
    })
  })

  describe('createRun', () => {
    it('crea una liquidación nueva', async () => {
      const svc = new PayrollService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const run = await svc.createRun({ hotelId: 'h1', period: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30', paymentDate: '2026-07-05' })
      expect(run.status).toBe('draft')
      expect(run.period).toBe('2026-06')
    })

    it('rechaza período duplicado', async () => {
      const runMock = makeRepo({ findOne: async () => ({ id: 'r1', period: '2026-06', hotelId: 'h1' }) })
      const svc = new PayrollService(makeRepo(), makeRepo(), runMock, makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      await expect(svc.createRun({ hotelId: 'h1', period: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30', paymentDate: '2026-07-05' })).rejects.toThrow('already exists')
    })
  })

  describe('listConcepts', () => {
    it('retorna conceptos del hotel', async () => {
      const svc = new PayrollService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const concepts = await svc.listConcepts('h1')
      expect(Array.isArray(concepts)).toBe(true)
    })
  })

  describe('createConcept', () => {
    it('crea un concepto', async () => {
      const svc = new PayrollService(makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), makeRepo(), log, silentCache)
      const c = await svc.createConcept({ hotelId: 'h1', code: 'BONUS2', name: 'Bono extra', type: 'earning', calculationMethod: 'fixed', value: 200 })
      expect(c.code).toBe('BONUS2')
      expect(c.type).toBe('earning')
    })
  })
})
