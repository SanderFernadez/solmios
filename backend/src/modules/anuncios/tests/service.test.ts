// anuncios/tests/service.test.ts — Tests del servicio con ownership, paginacion y seguridad
// Usa RepositoryAdapter mock — sin dependencia de SQLite ni Postgres.
// 18 tests: list, getById, create, update, delete, setSockets, cache, sockets, auth.

import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { AnunciosService } from '../service'
import type { AnunciosDTO, AnnouncementType, AnunciosPaginated } from '../types'

const log = silentLogger()
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

function makeCache(overrides: Partial<CacheAdapter> = {}): CacheAdapter {
  return { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {}, ...overrides }
}

function makeRepo(overrides: Partial<RepositoryAdapter<AnunciosDTO>> = {}): RepositoryAdapter<AnunciosDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({
      ...data,
      id: 'ann-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as AnunciosDTO),
    update: async (id, data) => ({ id, ...data } as AnunciosDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

function makeAnuncio(overrides: Partial<AnunciosDTO> = {}): AnunciosDTO {
  return {
    id: 'a1',
    hotelId: 'h1',
    title: 'Fire alarm test',
    message: 'Scheduled maintenance',
    type: 'maintenance' as AnnouncementType,
    priority: 'high',
    active: 1,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

// ==================== list ====================

function makeUserRepo() {
  return { findById: async () => ({ id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>
}

const mockUser = { id: 'user-1', hotelId: 'hotel-1', role: 'hotel_admin' }

describe('AnunciosService', () => {
  describe('list', () => {
    it('returns paginated results for super_admin', async () => {
      const items = [makeAnuncio({ id: 'a1' }), makeAnuncio({ id: 'a2' })]
      const repo = makeRepo({
        paginate: async () => ({ data: items, total: 2, limit: 20, offset: 0, pages: 1 }),
      })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
    })

    it('enforces hotel scope for hotel_admin', async () => {
      let capturedFilters: any = {}
      const items = [makeAnuncio()]
      const repo = makeRepo({
        paginate: async (filters) => { capturedFilters = filters; return { data: items, total: 1, limit: 20, offset: 0, pages: 1 } },
      })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await svc.list({}, hotelAdmin)
      expect(capturedFilters.hotelId).toBe('h1')
    })

    it('throws AuthError when hotel_admin has no hotelId', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const noHotelRepo = { findById: async () => ({ id: 'u1', hotelId: null, role: 'hotel_admin' }) } as unknown as RepositoryAdapter<any>
      const svc = new AnunciosService(makeRepo(), log, makeCache(), noHotelRepo, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('applies pagination bounds correctly', async () => {
      let capturedOpts: any = {}
      const repo = makeRepo({
        paginate: async (filters, opts) => { capturedOpts = opts; return { data: [], total: 50, limit: 10, offset: 20, pages: 5 } },
      })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.list({ page: 3, limit: 10 }, adminUser)
      expect(capturedOpts.offset).toBe(20)
      expect(capturedOpts.limit).toBe(10)
      expect(result.pages).toBe(5)
    })

    it('clamps limit between 1 and 100', async () => {
      let capturedOpts: any = {}
      const repo = makeRepo({
        paginate: async (filters, opts) => { capturedOpts = opts; return { data: [], total: 0, limit: opts?.limit ?? 0, offset: 0, pages: 0 } },
      })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await svc.list({ limit: 999 }, adminUser)
      expect(capturedOpts.limit).toBe(100)
    })

    it('reads from cache on second call', async () => {
      let cacheHits = 0
      const cached: AnunciosPaginated = { data: [makeAnuncio()], total: 1, page: 1, limit: 20, pages: 1 }
      const cache = makeCache({
        get: (async (key: string) => { cacheHits++; return cacheHits > 1 ? cached : null }) as CacheAdapter['get'],
      })
      const svc = new AnunciosService(makeRepo(), log, cache, makeUserRepo(), fakeAuth)
      await svc.list({}, hotelAdmin)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
      expect(cacheHits).toBe(2)
    })

    it('super_admin can filter by hotelId', async () => {
      let capturedFilters: any = {}
      const repo = makeRepo({
        paginate: async (filters) => { capturedFilters = filters; return { data: [], total: 0, limit: 20, offset: 0, pages: 0 } },
      })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await svc.list({ hotelId: 'h5' }, adminUser)
      expect(capturedFilters.hotelId).toBe('h5')
    })
  })

  // ==================== getById ====================

  describe('getById', () => {
    it('returns announcement for super_admin', async () => {
      const ann = makeAnuncio({ id: 'a1', title: 'Notice' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.getById('a1', adminUser)
      expect(result.title).toBe('Notice')
    })

    it('returns announcement for own hotel admin', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.getById('a1', hotelAdmin)
      expect(result.id).toBe('a1')
    })

    it('rejects hotel_admin accessing other hotel announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.getById('a1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFoundError for missing announcement', async () => {
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.getById('nonexistent', adminUser)).rejects.toThrow('Anuncio no encontrado')
    })
  })

  // ==================== create ====================

  describe('create', () => {
    it('creates announcement in own hotel', async () => {
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.create({ title: 'New notice', hotelId: 'h1' }, hotelAdmin)
      expect(result.id).toBe('ann-1')
      expect(result.title).toBe('New notice')
    })

    it('rejects hotel_admin creating in other hotel', async () => {
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.create({ title: 'X', hotelId: 'h2' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('super_admin can create in any hotel', async () => {
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.create({ title: 'Admin notice', hotelId: 'h99' }, adminUser)
      expect(result.title).toBe('Admin notice')
    })

    it('fires onAnunciosCreated socket', async () => {
      let firedWith: AnunciosDTO | null = null
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      svc.setSockets({ onAnunciosCreated: async (item) => { firedWith = item } })
      const result = await svc.create({ title: 'Socket test', hotelId: 'h1' }, hotelAdmin)
      expect(firedWith).not.toBeNull()
      expect(firedWith!.id).toBe(result.id)
    })

    it('invalidates hotel-scoped cache on create', async () => {
      let deletedKey = ''
      const cache = makeCache({ delete: async (key) => { deletedKey = key } })
      const svc = new AnunciosService(makeRepo(), log, cache, makeUserRepo(), fakeAuth)
      await svc.create({ title: 'Cache bust', hotelId: 'h1' }, hotelAdmin)
      expect(deletedKey).toBe('anuncios:list:h1')
    })
  })

  // ==================== update ====================

  describe('update', () => {
    it('updates own hotel announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1', title: 'Old' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      const result = await svc.update('a1', { title: 'Updated' }, hotelAdmin)
      expect(result.title).toBe('Updated')
    })

    it('rejects hotel_admin updating other hotel announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.update('a1', { title: 'X' }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFoundError when item does not exist', async () => {
      const repo = makeRepo({ update: async () => null as any })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.update('ghost', { title: 'X' }, adminUser)).rejects.toThrow('Anuncio no encontrado')
    })

    it('invalidates hotel-scoped cache on update', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      let deletedKey = ''
      const cache = makeCache({ delete: async (key) => { deletedKey = key } })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.update('a1', { title: 'Cached' }, hotelAdmin)
      expect(deletedKey).toBe('anuncios:list:h1')
    })
  })

  // ==================== delete ====================

  describe('delete', () => {
    it('super_admin can delete any announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.delete('a1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete own hotel announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.delete('a1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects hotel_admin deleting other hotel announcement', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h2' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.delete('a1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFoundError when deleting non-existent item', async () => {
      const svc = new AnunciosService(makeRepo({ delete: async () => false }), log, makeCache(), makeUserRepo(), fakeAuth)
      await expect(svc.delete('ghost', adminUser)).rejects.toThrow('Anuncio no encontrado')
    })

    it('fires onAnunciosDeleted socket with the id', async () => {
      let firedId = ''
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, makeCache(), makeUserRepo(), fakeAuth)
      svc.setSockets({ onAnunciosDeleted: async (id) => { firedId = id } })
      await svc.delete('a1', adminUser)
      expect(firedId).toBe('a1')
    })

    it('invalidates hotel-scoped cache on delete', async () => {
      const ann = makeAnuncio({ id: 'a1', hotelId: 'h1' })
      let deletedKey = ''
      const cache = makeCache({ delete: async (key) => { deletedKey = key } })
      const repo = makeRepo({ findById: async () => ann })
      const svc = new AnunciosService(repo, log, cache, makeUserRepo(), fakeAuth)
      await svc.delete('a1', hotelAdmin)
      expect(deletedKey).toBe('anuncios:list:h1')
    })
  })

  // ==================== setSockets ====================

  describe('setSockets', () => {
    it('accumulates multiple handlers for same event', async () => {
      const calls: string[] = []
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      svc.setSockets({ onAnunciosCreated: async () => { calls.push('first') } })
      svc.setSockets({ onAnunciosCreated: async () => { calls.push('second') } })
      await svc.create({ title: 'Accumulate', hotelId: 'h1' }, hotelAdmin)
      expect(calls).toEqual(['first', 'second'])
    })

    it('skips null handlers without error', async () => {
      const svc = new AnunciosService(makeRepo(), log, makeCache(), makeUserRepo(), fakeAuth)
      svc.setSockets({ onAnunciosCreated: null as any, onAnunciosUpdated: undefined as any })
      await expect(svc.create({ title: 'No socket', hotelId: 'h1' }, hotelAdmin)).resolves.toBeDefined()
    })
  })
})
