// mantenimiento/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { MantenimientoService } from '../service'
import type { MantenimientoDTO } from '../types'

// silentLogger es una factory function — SIEMPRE llamarla con ()
const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, clear: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<MantenimientoDTO>> = {}): RepositoryAdapter<MantenimientoDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as MantenimientoDTO),
    update: async (id, data) => ({ id, ...data } as MantenimientoDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('MantenimientoService', () => {
  describe('getById', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new MantenimientoService(makeRepo(), log, silentCache)
      await expect(service.getById('no-existe')).rejects.toThrow('Mantenimiento no encontrado')
    })

    it('retorna el item si existe', async () => {
      const item = { id: '1' } as MantenimientoDTO
      const service = new MantenimientoService(makeRepo({ findById: async () => item }), log, silentCache)
      expect(await service.getById('1')).toEqual(item)
    })
  })

  describe('create', () => {
    it('crea y retorna el item', async () => {
      const service = new MantenimientoService(makeRepo(), log, silentCache)
      const result = await service.create({} as any)
      expect(result.id).toBe('test-id')
    })
  })

  describe('delete', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new MantenimientoService(makeRepo({ delete: async () => false }), log, silentCache)
      await expect(service.delete('no-existe')).rejects.toThrow('Mantenimiento no encontrado')
    })
  })
})
