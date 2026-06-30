import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { HousekeepingService } from '../service'
import type { HousekeepingDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
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

function makeUserRepo() {
  return { findById: async () => ({ id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>
}

const mockUser = { id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }

describe('HousekeepingService', () => {
  describe('list', () => {
    it('returns paginated tasks', async () => {
      const tasks = [{ id: 'hk1', roomId: 'r1', hotelId: 'h1' }] as HousekeepingDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tasks, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const tasks = [{ id: 'hk1', roomId: 'r1', hotelId: 'h1' }] as HousekeepingDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: tasks, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const userRepo = makeRepo() as unknown as RepositoryAdapter<any>
      userRepo.findById = async () => ({ id: 'u1', hotelId: undefined, role: 'hotel_admin' })
      const svc = new HousekeepingService(makeRepo(), log, silentCache, userRepo, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })
  })

  describe('getById', () => {
    it('returns task for super_admin', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('hk1', adminUser)
      expect(result.roomId).toBe('r1')
    })

    it('rejects other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('hk1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('nope', adminUser)).rejects.toThrow('no encontrada')
    })
  })

  describe('create', () => {
    it('creates task in own hotel', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ roomId: 'r1', hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('hk-1')
    })

    it('rejects task in other hotel', async () => {
      const svc = new HousekeepingService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.create({ roomId: 'r1', hotelId: 'h2' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('update', () => {
    it('updates own hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'in_progress' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task, update: async (id, data) => ({ id, ...data } as HousekeepingDTO) })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('hk1', { status: 'completed' }, hotelAdmin)
      expect(result.status).toBe('completed')
    })

    it('rejects update to other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('hk1', { status: 'completed' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('hk1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('hk1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h2' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('hk1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('state machine (start/complete)', () => {
    it('starts a pending task → in_progress', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'pending' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task, update: async (id, data) => ({ ...task, ...data, id } as HousekeepingDTO) })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.start('hk1', hotelAdmin)
      expect(result.status).toBe('in_progress')
      expect(result.startTime).toBeTruthy()
    })

    it('rejects starting a completed task (invalid transition)', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'completed' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.start('hk1', hotelAdmin)).rejects.toThrow('Transición')
    })

    it('update rejects invalid status transition (pending → completed)', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'pending' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('hk1', { status: 'completed' }, hotelAdmin)).rejects.toThrow('Transición')
    })

    it('completes an in_progress task', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'in_progress', startTime: '2026-06-01T10:00:00.000Z' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task, update: async (id, data) => ({ ...task, ...data, id } as HousekeepingDTO) })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.complete('hk1', hotelAdmin)
      expect(result.status).toBe('completed')
      expect(result.endTime).toBeTruthy()
    })

    it('complete rejects in_progress task without startTime', async () => {
      const task = { id: 'hk1', roomId: 'r1', hotelId: 'h1', status: 'in_progress' } as HousekeepingDTO
      const repo = makeRepo({ findById: async () => task })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.complete('hk1', hotelAdmin)).rejects.toThrow('no fue iniciada')
    })
  })

  describe('stats', () => {
    it('aggregates completed tasks by staff', async () => {
      const tasks = [
        { id: '1', hotelId: 'h1', staffId: 'e1', status: 'completed', startTime: '2026-06-01T10:00:00.000Z', endTime: '2026-06-01T10:30:00.000Z' },
        { id: '2', hotelId: 'h1', staffId: 'e1', status: 'completed', startTime: '2026-06-01T11:00:00.000Z', endTime: '2026-06-01T11:15:00.000Z' },
        { id: '3', hotelId: 'h1', staffId: 'e2', status: 'completed', startTime: '2026-06-01T12:00:00.000Z', endTime: '2026-06-01T12:45:00.000Z' },
      ] as HousekeepingDTO[]
      const repo = makeRepo({ findMany: async () => tasks })
      const svc = new HousekeepingService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.stats({}, hotelAdmin)
      const e1 = result.find(r => r.staffId === 'e1')
      const e2 = result.find(r => r.staffId === 'e2')
      expect(e1?.completed).toBe(2)
      expect(e2?.completed).toBe(1)
    })
  })
})
