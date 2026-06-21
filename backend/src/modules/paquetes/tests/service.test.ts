// paquetes/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { PaquetesService } from '../service'
import type { PaquetesDTO } from '../types'

// silentLogger es una factory function — SIEMPRE llamarla con ()
const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, clear: async () => {}, flush: async () => {} }

function makeRepo(overrides: Partial<RepositoryAdapter<PaquetesDTO>> = {}): RepositoryAdapter<PaquetesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as PaquetesDTO),
    update: async (id, data) => ({ id, ...data } as PaquetesDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('PaquetesService', () => {
  describe('getById', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new PaquetesService(makeRepo(), log, silentCache)
      await expect(service.getById('no-existe')).rejects.toThrow('Paquetes no encontrado')
    })

    it('retorna el item si existe', async () => {
      const item = { id: '1' } as PaquetesDTO
      const service = new PaquetesService(makeRepo({ findById: async () => item }), log, silentCache)
      expect(await service.getById('1')).toEqual(item)
    })
  })

  describe('create', () => {
    it('crea y retorna el item', async () => {
      const service = new PaquetesService(makeRepo(), log, silentCache)
      const result = await service.create({} as any)
      expect(result.id).toBe('test-id')
    })
  })

  describe('delete', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new PaquetesService(makeRepo({ delete: async () => false }), log, silentCache)
      await expect(service.delete('no-existe')).rejects.toThrow('Paquetes no encontrado')
    })
  })
})
