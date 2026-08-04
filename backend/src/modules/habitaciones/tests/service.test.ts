import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { HabitacionesService } from '../service'
import type { HabitacionesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
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

function makeUserRepo() {
  return { findById: async () => ({ id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>
}

const mockUser = { id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }

describe('HabitacionesService', () => {
  describe('list', () => {
    it('returns paginated rooms for super_admin', async () => {
      const rooms = [{ id: 'r1', number: '101', hotelId: 'h1' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const rooms = [{ id: 'r1', number: '101', hotelId: 'h1' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const userRepo = makeUserRepo()
      ;(userRepo as any).findById = async () => ({ id: 'u1', hotelId: undefined })
      const svc = new HabitacionesService(makeRepo(), log, silentCache, userRepo, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('search filters by number', async () => {
      const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ search: '101' }, adminUser)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].number).toBe('101')
    })

    // #648 — GET /api/habitaciones?checkIn&checkOut anota disponibilidad. El resto de las
    // suites de este describe (arriba) NO mandan checkIn/checkOut y deben seguir viendo
    // exactamente el mismo comportamiento de antes — housekeeping/mantenimiento/otros
    // consumidores del endpoint sin fechas no cambian.
    describe('date availability (#648)', () => {
      it('without checkIn/checkOut, response has no available field (unchanged behavior)', async () => {
        const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
        const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
        const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
        svc.setAvailabilityDeps({ list: async () => { throw new Error('should not be called') } })
        const result = await svc.list({}, adminUser)
        expect((result.data[0] as any).available).toBeUndefined()
      })

      it('with checkIn/checkOut but no availabilityPort wired, data passes through unannotated', async () => {
        const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
        const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
        const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
        const result = await svc.list({ checkIn: '2026-09-01', checkOut: '2026-09-05' }, adminUser)
        expect((result.data[0] as any).available).toBeUndefined()
      })

      it('marks a room unavailable when an active reservation overlaps the range', async () => {
        const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
        const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
        const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
        svc.setAvailabilityDeps({
          list: async () => ({ data: [{ id: 'res-1', roomId: 'r1', checkIn: '2026-09-02', checkOut: '2026-09-04', status: 'confirmed' }] }),
        })
        const result = await svc.list({ checkIn: '2026-09-01', checkOut: '2026-09-05' }, adminUser)
        expect((result.data[0] as any).available).toBe(false)
        expect((result.data[0] as any).unavailableReason).toContain('2026-09-02')
      })

      it('cancelled reservations do not block availability', async () => {
        const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
        const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
        const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
        svc.setAvailabilityDeps({
          list: async () => ({ data: [{ id: 'res-1', roomId: 'r1', checkIn: '2026-09-02', checkOut: '2026-09-04', status: 'cancelled' }] }),
        })
        const result = await svc.list({ checkIn: '2026-09-01', checkOut: '2026-09-05' }, adminUser)
        expect((result.data[0] as any).available).toBe(true)
      })

      it('non-overlapping reservation leaves the room available', async () => {
        const rooms = [{ id: 'r1', number: '101' }] as HabitacionesDTO[]
        const repo = makeRepo({ paginate: async () => ({ data: rooms, total: 1, limit: 20, offset: 0, pages: 1 }) })
        const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
        svc.setAvailabilityDeps({
          list: async () => ({ data: [{ id: 'res-1', roomId: 'r1', checkIn: '2026-08-01', checkOut: '2026-08-05', status: 'confirmed' }] }),
        })
        const result = await svc.list({ checkIn: '2026-09-01', checkOut: '2026-09-05' }, adminUser)
        expect((result.data[0] as any).available).toBe(true)
      })
    })
  })

  describe('getById', () => {
    it('returns room for super_admin', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('r1', adminUser)
      expect(result.number).toBe('101')
    })

    it('returns own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('r1', hotelAdmin)
      expect(result.number).toBe('101')
    })

    it('rejects other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('nope', adminUser)).rejects.toThrow('Habitación no encontrada')
    })
  })

  describe('create', () => {
    it('creates room in own hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ number: '101', basePrice: 100, hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('room-1')
    })

    it('rejects room in other hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.create({ number: '101', basePrice: 100, hotelId: 'h2' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ number: '101', basePrice: 100, hotelId: 'h2' }, adminUser)
      expect(result.id).toBe('room-1')
    })
  })

  describe('update', () => {
    it('updates own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room, update: async (id, data) => ({ id, ...data } as HabitacionesDTO) })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('r1', { number: '102' }, hotelAdmin)
      expect(result.number).toBe('102')
    })

    it('rejects update to other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('r1', { number: '102' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound', async () => {
      const svc = new HabitacionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('nope', { number: '102' }, adminUser)).rejects.toThrow('Habitación no encontrada')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h1' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel room', async () => {
      const room = { id: 'r1', number: '101', hotelId: 'h2' } as HabitacionesDTO
      const repo = makeRepo({ findById: async () => room })
      const svc = new HabitacionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })
})
