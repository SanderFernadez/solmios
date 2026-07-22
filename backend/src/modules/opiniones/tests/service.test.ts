import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { OpinionesService } from '../service'
import type { OpinionesDTO } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = { get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {} }
const mockAuth = { assertOwnership: () => {} } as unknown as Auth
const fakeAuth = { createToken: () => 'tok', assertOwnership: () => {} } as unknown as Auth

const adminUser = { id: 'admin1', role: 'super_admin', hotelId: undefined }
const hotelAdmin = { id: 'user1', role: 'hotel_admin', hotelId: 'h1' }

function makeRepo(overrides: Partial<RepositoryAdapter<OpinionesDTO>> = {}): RepositoryAdapter<OpinionesDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'rev-1', ...data } as OpinionesDTO),
    update: async (id, data) => ({ id, ...data } as OpinionesDTO),
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

describe('OpinionesService', () => {
  // ─── LIST ────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated reviews for super_admin', async () => {
      const reviews = [{ id: 'r1', hotelId: 'h1', rating: 5 }] as OpinionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: reviews, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by hotelId for hotel_admin', async () => {
      const reviews = [{ id: 'r1', hotelId: 'h1', rating: 5 }] as OpinionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: reviews, total: 1, limit: 20, offset: 0, pages: 1 }) })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, hotelAdmin)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].hotelId).toBe('h1')
    })

    it('throws AuthError when hotel_admin has no hotelId', async () => {
      const noHotel = { id: 'u1', role: 'hotel_admin', hotelId: undefined }
      const userRepoNoHotel = { findById: async () => ({ id: 'u1', hotelId: undefined }) } as unknown as RepositoryAdapter<any>
      const svc = new OpinionesService(makeRepo(), log, silentCache, userRepoNoHotel, fakeAuth)
      await expect(svc.list({}, noHotel)).rejects.toThrow('No hotel assigned')
    })

    it('returns empty when no reviews match', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({}, adminUser)
      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('returns paginated results with page info', async () => {
      const reviews = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, hotelId: 'h1', rating: 4 })) as OpinionesDTO[]
      const repo = makeRepo({ paginate: async () => ({ data: reviews, total: 25, limit: 5, offset: 0, pages: 5 }) })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.list({ page: 1, limit: 5 }, adminUser)
      expect(result.data).toHaveLength(5)
      expect(result.total).toBe(25)
      expect(result.pages).toBe(5)
    })
  })

  // ─── GET BY ID ───────────────────────────────────────

  describe('getById', () => {
    it('returns review for super_admin regardless of hotel', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('r1', adminUser)
      expect(result.rating).toBe(5)
    })

    it('returns review for hotel_admin in own hotel', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.getById('r1', hotelAdmin)
      expect(result.id).toBe('r1')
    })

    it('rejects review from another hotel for hotel_admin', async () => {
      const review = { id: 'r1', hotelId: 'h2', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when review does not exist', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.getById('nonexistent', adminUser)).rejects.toThrow('no encontrada')
    })
  })

  // ─── CREATE ──────────────────────────────────────────

  describe('create', () => {
    it('creates review in own hotel for hotel_admin', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ hotelId: 'h1', rating: 5 }, hotelAdmin)
      expect(result.id).toBe('rev-1')
      expect(result.hotelId).toBe('h1')
    })

    it('creates review in any hotel for super_admin', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.create({ hotelId: 'h99', rating: 3 }, adminUser)
      expect(result.hotelId).toBe('h99')
    })

    it('rejects review creation in another hotel for hotel_admin', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.create({ hotelId: 'h2', rating: 5 }, hotelAdmin)).rejects.toThrow('No autorizado')
    })
  })

  // ─── UPDATE ──────────────────────────────────────────

  describe('update', () => {
    it('updates review in own hotel for hotel_admin', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('r1', { rating: 4 }, hotelAdmin)
      expect(result.rating).toBe(4)
    })

    it('updates any review for super_admin', async () => {
      const review = { id: 'r1', hotelId: 'h2', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      const result = await svc.update('r1', { rating: 2 }, adminUser)
      expect(result.rating).toBe(2)
    })

    it('rejects update to review in another hotel for hotel_admin', async () => {
      const review = { id: 'r1', hotelId: 'h2', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('r1', { rating: 4 }, hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when updating non-existent review', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.update('nonexistent', { rating: 4 }, adminUser)).rejects.toThrow('no encontrada')
    })
  })

  // ─── DELETE ──────────────────────────────────────────

  describe('delete', () => {
    it('super_admin can delete any review', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', adminUser)).resolves.toBeUndefined()
    })

    it('hotel_admin can delete review in own hotel', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).resolves.toBeUndefined()
    })

    it('rejects delete of review in another hotel for hotel_admin', async () => {
      const review = { id: 'r1', hotelId: 'h2', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', hotelAdmin)).rejects.toThrow('No autorizado')
    })

    it('throws NotFound when deleting non-existent review', async () => {
      const svc = new OpinionesService(makeRepo(), log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('nonexistent', adminUser)).rejects.toThrow('no encontrada')
    })

    it('throws NotFound when repo delete returns false', async () => {
      const review = { id: 'r1', hotelId: 'h1', rating: 5 } as OpinionesDTO
      const repo = makeRepo({ findById: async () => review, delete: async () => false })
      const svc = new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth)
      await expect(svc.delete('r1', adminUser)).rejects.toThrow('no encontrada')
    })
  })

  // ─── Flujo público por token (/resena/:token) ────────
  describe('submitByToken', () => {
    function svcWith(review: any) {
      const updates: any[] = []
      const repo = makeRepo({
        findMany: async (f: any) => (f?.token === 't1' ? [review] : []),
        update: async (id: string, data: any) => { updates.push({ id, data }); return { id, ...data } as OpinionesDTO },
      })
      return { svc: new OpinionesService(repo, log, silentCache, makeUserRepo(), fakeAuth), updates }
    }

    it('responde un invite pending → visible + rating + comment', async () => {
      const { svc, updates } = svcWith({ id: 'r1', hotelId: 'h1', status: 'pending', token: 't1' })
      const res = await svc.submitByToken('t1', { rating: 5, comment: 'Excelente' })
      expect(res.ok).toBe(true)
      expect(updates[0].data).toMatchObject({ rating: 5, comment: 'Excelente', status: 'visible', visible: 1 })
    })

    it('rechaza si ya fue respondida (409)', async () => {
      const { svc } = svcWith({ id: 'r1', hotelId: 'h1', status: 'visible', token: 't1' })
      expect(await svc.submitByToken('t1', { rating: 4 })).toEqual({ ok: false, reason: 'already_submitted' })
    })

    it('rechaza rating fuera de 1-5', async () => {
      const { svc } = svcWith({ id: 'r1', hotelId: 'h1', status: 'pending', token: 't1' })
      expect(await svc.submitByToken('t1', { rating: 9 })).toEqual({ ok: false, reason: 'invalid_rating' })
    })

    it('token inexistente → not_found', async () => {
      const { svc } = svcWith({ id: 'r1', hotelId: 'h1', status: 'pending', token: 't1' })
      expect(await svc.submitByToken('nope', { rating: 5 })).toEqual({ ok: false, reason: 'not_found' })
    })
  })
})
