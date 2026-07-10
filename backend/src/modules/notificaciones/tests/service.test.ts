import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { NotificacionesService } from '../service'
import type { NotificacionesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

function makeRepo(overrides: Partial<RepositoryAdapter<NotificacionesDTO>> = {}): RepositoryAdapter<NotificacionesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'notif-1', ...data } as NotificacionesDTO),
    update: async (id, data) => ({ id, ...data } as NotificacionesDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeUserRepo(overrides: Partial<RepositoryAdapter<any>> = {}): RepositoryAdapter<any> {
  return {
    findMany: async () => [],
    findById: async () => ({}),
    findOne: async () => null,
    create: async (data: any) => ({ id: 'user-1', ...data }),
    update: async (id: string, data: any) => ({ id, ...data }),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

describe('NotificacionesService', () => {
  describe('list', () => {
    it('returns notifications', async () => {
      const notifs = [{ id: 'n1', hotelId: 'h1', title: 'Alert', createdAt: '2026-07-01' }] as NotificacionesDTO[]
      const repo = makeRepo({ findMany: async () => notifs })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const notifs = [{ id: 'n1', hotelId: 'h1', title: 'Alert', createdAt: '2026-07-01' }] as NotificacionesDTO[]
      const repo = makeRepo({ findMany: async () => notifs })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
    })

    it('throws when no hotelId assigned', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const svc = new NotificacionesService(makeRepo(), makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    // El bug: un aviso personal (userId set) llegaba a cualquiera del hotel, y el
    // dueño a veces no lo veía (cache envenenado por una key que solo era el hotel).
    it('cada usuario ve los broadcast del hotel + solo SUS avisos personales', async () => {
      const rows = [
        { id: 'broadcast', hotelId: 'h1', userId: null, title: 'Aviso general', createdAt: '2026-07-03' },
        { id: 'mio', hotelId: 'h1', userId: 'user1', title: 'Tu tarea', createdAt: '2026-07-02' },
        { id: 'de-otro', hotelId: 'h1', userId: 'otro', title: 'Tarea de otro', createdAt: '2026-07-01' },
      ] as unknown as NotificacionesDTO[]
      const repo = makeRepo({ findMany: async () => rows })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)

      const result = await svc.list({}, hotelAdmin)  // hotelAdmin.id === 'user1'
      const ids = result.data.map((n) => n.id)

      expect(ids).toContain('broadcast')
      expect(ids).toContain('mio')
      expect(ids).not.toContain('de-otro')
    })

    it('ordena por fecha, más nuevo primero', async () => {
      const rows = [
        { id: 'viejo', hotelId: 'h1', userId: null, title: 'a', createdAt: '2026-07-01' },
        { id: 'nuevo', hotelId: 'h1', userId: null, title: 'b', createdAt: '2026-07-05' },
      ] as unknown as NotificacionesDTO[]
      const repo = makeRepo({ findMany: async () => rows })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)

      const result = await svc.list({}, hotelAdmin)

      expect(result.data[0].id).toBe('nuevo')
    })
  })

  describe('getById', () => {
    it('returns notification for super_admin', async () => {
      const notif = { id: 'n1', hotelId: 'h1', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      const result = await svc.getById('n1', adminUser)
      expect(result.title).toBe('Alert')
    })

    it('rejects other hotel notification', async () => {
      const notif = { id: 'n1', hotelId: 'h2', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.getById('n1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('create', () => {
    it('creates notification in own hotel', async () => {
      const svc = new NotificacionesService(makeRepo(), makeUserRepo(), log, silentCache, fakeAuth)
      const result = await svc.create({ hotelId: 'h1', title: 'Alert' }, hotelAdmin)
      expect(result.id).toBe('notif-1')
    })

    it('rejects notification in other hotel', async () => {
      const svc = new NotificacionesService(makeRepo(), makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.create({ hotelId: 'h2', title: 'Alert' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('update', () => {
    it('updates own hotel notification', async () => {
      const notif = { id: 'n1', hotelId: 'h1', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif, update: async (id, data) => ({ id, ...data } as NotificacionesDTO) })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      const result = await svc.update('n1', { read: 1 }, hotelAdmin)
      expect(result.read).toBe(1)
    })

    it('rejects update to other hotel notification', async () => {
      const notif = { id: 'n1', hotelId: 'h2', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.update('n1', { read: 1 }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  describe('delete', () => {
    it('super_admin can delete', async () => {
      const notif = { id: 'n1', hotelId: 'h1', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.delete('n1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel notification', async () => {
      const notif = { id: 'n1', hotelId: 'h1', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.delete('n1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of other hotel notification', async () => {
      const notif = { id: 'n1', hotelId: 'h2', title: 'Alert' } as NotificacionesDTO
      const repo = makeRepo({ findById: async () => notif })
      const svc = new NotificacionesService(repo, makeUserRepo(), log, silentCache, fakeAuth)
      await expect(svc.delete('n1', hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })
})
