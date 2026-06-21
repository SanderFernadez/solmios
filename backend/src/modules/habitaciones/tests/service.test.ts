import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { HabitacionesService } from '../service'
import type { HabitacionesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }
const otherAdmin = { id: 'user2', role: 'hotel_admin', hotelId: 'h2' }

function makeRepo(overrides: Partial<RepositoryAdapter<HabitacionesDTO>> = {}): RepositoryAdapter<HabitacionesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'room-1', ...data } as HabitacionesDTO),
    update: async (id, data) => ({ id, ...data } as HabitacionesDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('HabitacionesService', () => {
  describe('list', () => {
    it('returns paginated rooms for super_admin', async () => {
      const rooms = [{ id: 'r1', number: '101', hotelId: 'h1' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const rooms = [{ id: 'r1', number: '101', hotelId: 'h1' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('search filters by number', async () => {
      const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.list({ search: '101' }, adminUser)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].number).toBe('101')
    })
  })

  describe('getById', () => {
    it('returns room for super_admin', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('r1', adminUser)
      expect(result.number).toBe('101')
    })

    it('returns own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.getById('r1', hotelAdmin)
      expect(result.number).toBe('101')
    })

    it('rejects other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      await expect(svc.getById('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      await expect(svc.getById('nope', adminUser)).rejects.toThrow('Habitación no encontrada')
    })
  })

  describe('create', () => {
    it('creates room in own hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      const result = await svc.create({ number: '101', basePrice: 100, hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('room-1')
    })

    it('rejects room in other hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      await expect(svc.create({ number: '101', basePrice: 100, hotelId: 'h2' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      const result = await svc.create({ number: '101', basePrice: 100, hotelId: 'h2' }, adminUser)
      expect(result.id).toBe('room-1')
    })
  })

  describe('update', () => {
    it('updates own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room, update: async (id, data) => ({ id, ...data } as HabitacionesDTO) })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      const result = await svc.update('r1', { number: '102' }, hotelAdmin)
      expect(result.number).toBe('102')
    })

    it('rejects update to other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      await expect(svc.update('r1', { number: '102' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, fakeAuth)
      await expect(svc.update('nope', { number: '102' }, adminUser)).rejects.toThrow('Habitación no encontrada')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('r1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })
})
