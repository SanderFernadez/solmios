// canales/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { CanalesService } from '../service'
import type { CanalesDTO } from '../types'

// silentLogger es una factory function — SIEMPRE llamarla con ()
const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth

function makeRepo(overrides: Partial<RepositoryAdapter<CanalesDTO>> = {}): RepositoryAdapter<CanalesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as CanalesDTO),
    update: async (id, data) => ({ id, ...data } as CanalesDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeUserRepo() {
  return { findById: async () => ({ id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>
}

const mockUser = { id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }

describe('CanalesService', () => {
  describe('getById', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new CanalesService(makeRepo(), makeUserRepo(), log, silentCache, mockAuth)
      await expect(service.getById('no-existe', mockUser)).rejects.toThrow('Canales no encontrado')
    })

    it('retorna el item si existe', async () => {
      const item = { id: '1', hotelId: 'hotel-1' } as CanalesDTO
      const service = new CanalesService(makeRepo({ findById: async () => item }), makeUserRepo(), log, silentCache, mockAuth)
      expect(await service.getById('1', mockUser)).toEqual(item)
    })
  })

  describe('create', () => {
    it('crea y retorna el item', async () => {
      const service = new CanalesService(makeRepo(), makeUserRepo(), log, silentCache, mockAuth)
      const result = await service.create({} as any)
      expect(result.id).toBe('test-id')
    })
  })

  describe('delete', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new CanalesService(makeRepo({ delete: async () => false }), makeUserRepo(), log, silentCache, mockAuth)
      await expect(service.delete('no-existe', mockUser)).rejects.toThrow('Canales no encontrado')
    })
  })
})
