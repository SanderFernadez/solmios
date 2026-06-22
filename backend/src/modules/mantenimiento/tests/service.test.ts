import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { MantenimientoService } from '../service'
import type { MantenimientoDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }
const otherAdmin = { id: 'user2', role: 'hotel_admin', hotelId: 'h2' }

function makeRepo(overrides: Partial<RepositoryAdapter<MantenimientoDTO>> = {}): RepositoryAdapter<MantenimientoDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'maint-1', ...data } as MantenimientoDTO),
    update: async (id, data) => ({ id, ...data } as MantenimientoDTO),
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

describe('MantenimientoService', () => {
  describe('list', () => {
    it('returns paginated tickets', async () => {
      const tickets = [{ id: 't1', hotelId: 'h1', title: 'Leak' }] as MantenimientoDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tickets, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const tickets = [{ id: 't1', hotelId: 'h1', title: 'Leak' }] as MantenimientoDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tickets, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const userRepoWithoutHotel = { findById: async () => ({}) } as unknown as RepositoryAdapter<any>
      const svc = new MantenimientoService(makeRepo(), log, silentCache, userRepoWithoutHotel, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })
  })

  describe('getById', () => {
    it('returns ticket for super_admin', async () => {
      const ticket = { id: 't1', hotelId: 'h1', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('t1', adminUser)
      expect(result.title).toBe('Leak')
    })

    it('rejects other hotel ticket', async () => {
      const ticket = { id: 't1', hotelId: 'h2', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('t1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('create', () => {
    it('creates ticket in own hotel', async () => {
      const svc = new MantenimientoService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ hotelId: 'h1', title: 'Leak' }, hotelAdmin)
      expect(result.id).toBe('maint-1')
    })

    it('rejects ticket in other hotel', async () => {
      const svc = new MantenimientoService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.create({ hotelId: 'h2', title: 'Leak' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('update', () => {
    it('updates own hotel ticket', async () => {
      const ticket = { id: 't1', hotelId: 'h1', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket, update: async (id, data) => ({ id, ...data } as MantenimientoDTO) })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('t1', { status: 'resolved' }, hotelAdmin)
      expect(result.status).toBe('resolved')
    })

    it('rejects update to other hotel ticket', async () => {
      const ticket = { id: 't1', hotelId: 'h2', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('t1', { status: 'resolved' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const ticket = { id: 't1', hotelId: 'h1', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('t1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel ticket', async () => {
      const ticket = { id: 't1', hotelId: 'h1', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('t1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel ticket', async () => {
      const ticket = { id: 't1', hotelId: 'h2', title: 'Leak' } as MantenimientoDTO
      const repo = makeRepo({ findById: async () => ticket })
      const svc = new MantenimientoService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('t1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })
})
