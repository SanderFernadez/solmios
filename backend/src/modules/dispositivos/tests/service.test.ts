// dispositivos/tests/service.test.ts — Tests del servicio
// Ownership, paginación y seguridad: hotel_admin solo ve su hotel, super_admin ve todo.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { DispositivosService } from '../service'
import type { DispositivosDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

function makeRepo(overrides: Partial<RepositoryAdapter<DispositivosDTO>> = {}): RepositoryAdapter<DispositivosDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'dev-1', ...data } as DispositivosDTO),
    update: async (id, data) => ({ id, ...data } as DispositivosDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeDevice(overrides: Partial<DispositivosDTO> = {}): DispositivosDTO {
  return {
    id: 'dev-1',
    hotelId: 'h1',
    device: 'Chrome',
    userId: 'u1',
    userName: 'John',
    createdAt: '2026-06-21T10:00:00Z',
    updatedAt: '2026-06-21T10:00:00Z',
    ...overrides,
  }
}

describe('DispositivosService', () => {
  // ─── list ────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated devices for super_admin', async () => {
      const devices = [makeDevice()]
      const repo = makeRepo({
        paginate: async () => ({ data: devices, total: 1, limit: 20, offset: 0, pages: 1 }),
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const devices = [makeDevice({ hotelId: 'h1' })]
      const repo = makeRepo({
        paginate: async (opts) => {
          expect(opts.filters).toHaveProperty('hotelId', 'h1')
          return { data: devices, total: 1, limit: 20, offset: 0, pages: 1 }
        },
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when hotel_admin has no hotelId', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('applies pagination limits', async () => {
      const devices = Array.from({ length: 5 }, (_, i) => makeDevice({ id: `d${i}` }))
      const repo = makeRepo({
        paginate: async (opts) => {
          expect(opts.limit).toBe(10)
          expect(opts.offset).toBe(0)
          return { data: devices, total: 5, limit: 10, offset: 0, pages: 1 }
        },
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ limit: 10, page: 1 }, adminUser)
      expect(result.data).toHaveLength(5)
      expect(result.pages).toBe(1)
    })

    it('clamps limit to max 100', async () => {
      const repo = makeRepo({
        paginate: async (opts) => {
          expect(opts.limit).toBe(100)
          return { data: [], total: 0, limit: 100, offset: 0, pages: 0 }
        },
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await svc.list({ limit: 999 }, adminUser)
    })

    it('defaults to 20 when limit is 0 (falsy fallback)', async () => {
      const repo = makeRepo({
        paginate: async (opts) => {
          // 0 is falsy, so `query.limit || 20` yields 20
          expect(opts.limit).toBe(20)
          return { data: [], total: 0, limit: 20, offset: 0, pages: 0 }
        },
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await svc.list({ limit: 0 }, adminUser)
    })

    it('super_admin can filter by any hotelId', async () => {
      const repo = makeRepo({
        paginate: async (opts) => {
          expect(opts.filters).toHaveProperty('hotelId', 'h99')
          return { data: [], total: 0, limit: 20, offset: 0, pages: 0 }
        },
      })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await svc.list({ hotelId: 'h99' }, adminUser)
    })
  })

  // ─── getById ─────────────────────────────────────────────

  describe('getById', () => {
    it('returns device for super_admin', async () => {
      const device = makeDevice({ id: 'd1' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('d1', adminUser)
      expect(result.device).toBe('Chrome')
    })

    it('returns device for hotel_admin in same hotel', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('d1', hotelAdmin)
      expect(result.id).toBe('d1')
    })

    it('rejects other hotel device for hotel_admin', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await expect(svc.getById('d1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when device does not exist', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.getById('nonexistent', adminUser)).rejects.toThrow('Dispositivo no encontrado')
    })
  })

  // ─── create ──────────────────────────────────────────────

  describe('create', () => {
    it('creates device in own hotel', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      const result = await svc.create({ hotelId: 'h1', device: 'Safari' }, hotelAdmin)
      expect(result.id).toBe('dev-1')
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      const result = await svc.create({ hotelId: 'h99', device: 'Firefox' }, adminUser)
      expect(result.id).toBe('dev-1')
    })

    it('rejects creation in other hotel', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.create({ hotelId: 'h2', device: 'Edge' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  // ─── update ──────────────────────────────────────────────

  describe('update', () => {
    it('updates own hotel device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('d1', { lastActivity: '2026-06-21' }, hotelAdmin)
      expect(result.lastActivity).toBe('2026-06-21')
    })

    it('rejects update to other hotel device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('d1', { lastActivity: '2026-06-21' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when device does not exist', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.update('nonexistent', {}, adminUser)).rejects.toThrow('Dispositivo no encontrado')
    })

    it('super_admin can update any hotel device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('d1', { device: 'Firefox' }, adminUser)
      expect(result.device).toBe('Firefox')
    })
  })

  // ─── delete ──────────────────────────────────────────────

  describe('delete', () => {
    it('super_admin can delete any device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('d1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('d1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel device', async () => {
      const device = makeDevice({ id: 'd1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => device })
      const svc = new DispositivosService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('d1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when device does not exist', async () => {
      const svc = new DispositivosService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.delete('nonexistent', adminUser)).rejects.toThrow('Dispositivo no encontrado')
    })
  })
})
