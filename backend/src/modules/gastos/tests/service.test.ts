// gastos/tests/service.test.ts — Tests del servicio
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { GastosService } from '../service'
import type { GastosDTO, CurrentUser } from '../types'

// silentLogger es una factory function — SIEMPRE llamarla con ()
const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }

// auth mock: assertOwnership no-op (permite todo). En tests de IDOR se puede override para forzar throw.
const passAuth: Auth = { assertOwnership: () => {}, authenticate: (() => []) as any } as unknown as Auth

const currentUser: CurrentUser = { id: 'u1', hotelId: 'h1', role: 'hotel_admin' }

function makeRepo(overrides: Partial<RepositoryAdapter<GastosDTO>> = {}): RepositoryAdapter<GastosDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'test-id', ...data } as GastosDTO),
    update: async (id, data) => ({ id, ...data } as GastosDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeUserRepo(hotelId = 'h1'): RepositoryAdapter<any> {
  return { ...makeRepo(), findById: async () => ({ id: 'u1', hotelId }) }
}

describe('GastosService', () => {
  describe('getById', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new GastosService(makeRepo(), makeUserRepo(), log, silentCache, passAuth)
      await expect(service.getById('no-existe', currentUser)).rejects.toThrow('Gastos no encontrado')
    })

    it('retorna el item si existe y es del hotel del usuario', async () => {
      const item = { id: '1', hotelId: 'h1' } as GastosDTO
      const service = new GastosService(makeRepo({ findById: async () => item }), makeUserRepo(), log, silentCache, passAuth)
      expect(await service.getById('1', currentUser)).toEqual(item)
    })

    it('rechaza IDOR si el item es de otro hotel', async () => {
      const denyAuth: Auth = {
        assertOwnership: () => { throw new Error('Forbidden') },
        authenticate: (() => []) as any,
      } as unknown as Auth
      const item = { id: '1', hotelId: 'h2' } as GastosDTO
      const service = new GastosService(makeRepo({ findById: async () => item }), makeUserRepo('h1'), log, silentCache, denyAuth)
      await expect(service.getById('1', currentUser)).rejects.toThrow('Forbidden')
    })
  })

  describe('create', () => {
    it('crea y retorna el item', async () => {
      const service = new GastosService(makeRepo(), makeUserRepo(), log, silentCache, passAuth)
      const result = await service.create({ concept: 'x', amount: 10 } as any, currentUser)
      expect(result.id).toBe('test-id')
    })

    it('fuerza hotelId del JWT y ignora el del body (P0 V-01 IDOR)', async () => {
      const created: any[] = []
      const repo = makeRepo({
        create: async (data: any) => { created.push(data); return { id: 'test-id', ...data } as GastosDTO },
      })
      const service = new GastosService(repo, makeUserRepo(), log, silentCache, passAuth)
      // Intento de IDOR: el body pide hotelId='h2', pero el usuario es de 'h1'.
      await service.create({ hotelId: 'h2', concept: 'x', amount: 10 } as any, currentUser)
      expect(created[0].hotelId).toBe('h1') // forzado al del JWT, ignora 'h2' del body
    })
  })

  describe('delete', () => {
    it('lanza NotFound si el item no existe', async () => {
      const service = new GastosService(makeRepo({ delete: async () => false }), makeUserRepo(), log, silentCache, passAuth)
      await expect(service.delete('no-existe', currentUser)).rejects.toThrow('Gastos no encontrado')
    })
  })
})
