// cancellation/tests/service.test.ts — Tests del CRUD service (F1 plan #627).
// RepositoryAdapter mock — sin dependencia de SQLite ni Postgres. Los tests de cálculo
// de penalidad viven en cancellation-math.test.ts.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { CancellationService } from '../service'
import type { CancellationPolicyDTO } from '../types'
import { PRESET_TIERS } from '../../../shared/usecases/cancellation-math'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<CancellationPolicyDTO>> = {}): RepositoryAdapter<CancellationPolicyDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as CancellationPolicyDTO),
    update: async (id, data) => ({ id, ...data } as CancellationPolicyDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

const sampleDto = {
  id: '1', hotelId: 'h1', scope: 'base' as const, scopeId: '', name: 'Base',
  tiers: PRESET_TIERS.moderate, priority: 0, active: true, createdAt: '', updatedAt: '',
} as CancellationPolicyDTO

describe('CancellationService', () => {
  describe('getById', () => {
    it('lanza NotFound si la política no existe', async () => {
      const service = new CancellationService(makeRepo(), log, silentCache)
      await expect(service.getById('no-existe')).rejects.toThrow('Política de cancelación no encontrada')
    })

    it('retorna la política si existe', async () => {
      const service = new CancellationService(makeRepo({ findOne: async () => sampleDto }), log, silentCache)
      expect(await service.getById('1')).toEqual(sampleDto)
    })
  })

  describe('create', () => {
    it('crea y retorna la política', async () => {
      const service = new CancellationService(makeRepo(), log, silentCache)
      const result = await service.create({ hotelId: 'h1', scope: 'base', tiers: PRESET_TIERS.flexible })
      expect(result.id).toBe('test-id')
    })
  })

  describe('delete', () => {
    it('lanza NotFound si la política no existe', async () => {
      const service = new CancellationService(makeRepo({ delete: async () => false }), log, silentCache)
      await expect(service.delete('no-existe')).rejects.toThrow('Política de cancelación no encontrada')
    })
  })
})
