import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { HousekeepingService } from '../service'
import type { HousekeepingDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }
const otherAdmin = { id: 'user2', role: 'hotel_admin', hotelId: 'h2' }

function makeRepo(overrides: Partial<RepositoryAdapter<HousekeepingDTO>> = {}): RepositoryAdapter<HousekeepingDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'hk-1', ...data } as HousekeepingDTO),
    update: async (id, data) => ({ id, ...data } as HousekeepingDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('HousekeepingService', () => {
  describe('list', () => {
    it('returns paginated tasks', async () => {
      const tasks = [{ id: 'hk1', roomId: 'r1', hotelId: 'h1' }] as HousekeepingDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tasks, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const tasks = [{ id: 'hk1', roomId: 'r1', hotelId: 'h1' }] as HousekeepingDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tasks, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({}) }), fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })
  })

  describe('getById', () => {
    it('returns task for super_admin', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('hk1', adminUser)
      expect(result.roomId).toBe('r1')
    })

    it('rejects other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      await expect(svc.getById('hk1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({ hotelId: "h1" }) }), fakeAuth)
      await expect(svc.getById('nope', adminUser)).rejects.toThrow('no encontrada')
    })
  })

  describe('create', () => {
    it('creates task in own hotel', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({ hotelId: "h1" }) }), fakeAuth)
      const result = await svc.create({ roomId: 'r1', hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('hk-1')
    })

    it('rejects task in other hotel', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeRepo({ findById: async () => ({ hotelId: "h1" }) }), fakeAuth)
      await expect(svc.create({ roomId: 'r1', hotelId: 'h2' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('update', () => {
    it('updates own hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task, update: async (id, data) => ({ id, ...data } as HousekeepingDTO) })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('hk1', { status: 'completed' }, hotelAdmin)
      expect(result.status).toBe('completed')
    })

    it('rejects update to other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('hk1', { status: 'completed' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('hk1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('hk1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('hk1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })
})
