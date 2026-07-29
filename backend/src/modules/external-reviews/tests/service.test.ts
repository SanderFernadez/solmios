// external-reviews/tests/service.test.ts — Tests del service (F3, tasks 3.1 + 3.3).
// Cubre: CRUD admin con ownership, validación de source/rating, dedup batch idempotente.
//
// Sin dependencia de SQLite/Postgres — usa RepositoryAdapter mock (mismo molde que el stub
// generado por make:module, ampliado con upsertBatch scenarios).
import { describe, it, expect, mock } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { NotFoundError, ValidationError, ConflictError } from 'arckode-framework'
import { ExternalReviewsService } from '../service'
import type { ExternalReviewDTO, NormalizedExternalReview } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = {
  get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {},
}
const noopAuth = { assertOwnership: () => undefined, authenticate: (() => []) as any } as any

function makeRepo(overrides: Partial<RepositoryAdapter<ExternalReviewDTO>> = {}): RepositoryAdapter<ExternalReviewDTO> {
  return {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ ...data, id: 'test-id', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }) as ExternalReviewDTO,
    update: async (id, data) => ({ ...data, id, updatedAt: '2026-01-01T00:00:00.000Z' }) as ExternalReviewDTO,
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    ...overrides,
  }
}

const adminUser = { id: 'u1', role: 'super_admin', hotelId: 'h1' }

describe('ExternalReviewsService', () => {
  describe('getById', () => {
    it('lanza NotFound si no existe', async () => {
      const service = new ExternalReviewsService(makeRepo(), log, silentCache, { auth: noopAuth })
      await expect(service.getById('no-existe', adminUser)).rejects.toThrow(NotFoundError)
    })

    it('retorna el item si existe y es del hotel del user', async () => {
      const item = { id: '1', hotelId: 'h1', source: 'google', sourceExternalId: 'abc', rating: 5, submittedAt: '2026-01-01', createdAt: '', updatedAt: '' } as ExternalReviewDTO
      const service = new ExternalReviewsService(makeRepo({ findById: async () => item }), log, silentCache, { auth: noopAuth })
      expect(await service.getById('1', adminUser)).toEqual(item)
    })
  })

  describe('create', () => {
    it('rechaza source fuera del enum', async () => {
      const service = new ExternalReviewsService(makeRepo(), log, silentCache, { auth: noopAuth })
      await expect(service.create({
        hotelId: 'h1', source: 'ott' as any, sourceExternalId: 'x', rating: 5, submittedAt: '2026-01-01',
      }, adminUser)).rejects.toThrow(ValidationError)
    })

    it('rechaza rating fuera de [1,5]', async () => {
      const service = new ExternalReviewsService(makeRepo(), log, silentCache, { auth: noopAuth })
      await expect(service.create({
        hotelId: 'h1', source: 'google', sourceExternalId: 'x', rating: 7, submittedAt: '2026-01-01',
      }, adminUser)).rejects.toThrow(ValidationError)
    })

    it('traduce duplicate key error a ConflictError', async () => {
      const service = new ExternalReviewsService(
        makeRepo({ create: async () => { throw new Error('UNIQUE constraint failed: external_reviews_source_extid') } }),
        log, silentCache, { auth: noopAuth },
      )
      await expect(service.create({
        hotelId: 'h1', source: 'google', sourceExternalId: 'dup', rating: 4, submittedAt: '2026-01-01',
      }, adminUser)).rejects.toThrow(ConflictError)
    })
  })

  describe('upsertBatch', () => {
    it('batch vacío → 0 inserts, 0 updates', async () => {
      const service = new ExternalReviewsService(makeRepo(), log, silentCache, { auth: noopAuth })
      const result = await service.upsertBatch('h1', [])
      expect(result).toEqual({ inserted: 0, updated: 0 })
    })

    it('todas nuevas → N inserts', async () => {
      const createMock = mock(async (data: any) => ({ id: 'gen-' + data.sourceExternalId, ...data }) as ExternalReviewDTO)
      const service = new ExternalReviewsService(makeRepo({
        findMany: async () => [],
        create: createMock as any,
      }), log, silentCache, { auth: noopAuth })
      const incoming: NormalizedExternalReview[] = [
        { source: 'google', sourceExternalId: 'g1', rating: 5, submittedAt: '2026-01-01' },
        { source: 'google', sourceExternalId: 'g2', rating: 4, submittedAt: '2026-01-02' },
        { source: 'tripadvisor', sourceExternalId: 't1', rating: 3, submittedAt: '2026-01-03' },
      ]
      const result = await service.upsertBatch('h1', incoming)
      expect(result).toEqual({ inserted: 3, updated: 0 })
      expect(createMock).toHaveBeenCalledTimes(3)
    })

    it('todas existentes → 0 inserts, N updates (idempotente)', async () => {
      const existing: ExternalReviewDTO[] = [
        { id: 'e1', hotelId: 'h1', source: 'google', sourceExternalId: 'g1', rating: 3, submittedAt: '2026-01-01', createdAt: '', updatedAt: '' },
      ]
      const updateMock = mock(async (id: string, data: any) => ({ id, ...data }) as ExternalReviewDTO)
      const createMock = mock(async (data: any) => ({ id: 'x', ...data }) as ExternalReviewDTO)
      const service = new ExternalReviewsService(makeRepo({
        findMany: async () => existing,
        update: updateMock as any,
        create: createMock as any,
      }), log, silentCache, { auth: noopAuth })
      const incoming: NormalizedExternalReview[] = [
        { source: 'google', sourceExternalId: 'g1', rating: 5, submittedAt: '2026-01-01' }, // mismo extId → update
      ]
      const result = await service.upsertBatch('h1', incoming)
      expect(result).toEqual({ inserted: 0, updated: 1 })
      expect(updateMock).toHaveBeenCalledTimes(1)
      expect(createMock).not.toHaveBeenCalled()
    })

    it('mezcla nuevas + existentes → conteo correcto', async () => {
      const existing: ExternalReviewDTO[] = [
        { id: 'e1', hotelId: 'h1', source: 'google', sourceExternalId: 'g1', rating: 3, submittedAt: '', createdAt: '', updatedAt: '' },
      ]
      const service = new ExternalReviewsService(makeRepo({
        findMany: async () => existing,
        update: async (id, data) => ({ id, ...data }) as ExternalReviewDTO,
        create: async (data) => ({ id: 'new', ...data }) as ExternalReviewDTO,
      }), log, silentCache, { auth: noopAuth })
      const incoming: NormalizedExternalReview[] = [
        { source: 'google', sourceExternalId: 'g1', rating: 5, submittedAt: '' },     // exists
        { source: 'google', sourceExternalId: 'g2', rating: 4, submittedAt: '' },     // new
        { source: 'tripadvisor', sourceExternalId: 't1', rating: 2, submittedAt: '' }, // new
      ]
      const result = await service.upsertBatch('h1', incoming)
      expect(result).toEqual({ inserted: 2, updated: 1 })
    })

    it('race: duplicate en create → retry como update', async () => {
      let createAttempts = 0
      const existingRow = { id: 'race-winner', hotelId: 'h1', source: 'google' as const, sourceExternalId: 'g1', rating: 1, submittedAt: '', createdAt: '', updatedAt: '' }
      const service = new ExternalReviewsService(makeRepo({
        // 1ra llamada (pre-fetch por hotelId+source, SIN sourceExternalId en filter): devuelve [] (no existe).
        // 2da llamada (refetch por hotelId+source+sourceExternalId tras duplicate): devuelve la fila existente.
        findMany: async (f: any) => f.sourceExternalId ? [existingRow] : [],
        create: async () => {
          createAttempts++
          throw new Error('duplicate key value violates unique constraint')
        },
        update: async (id, data) => ({ id, ...data }) as ExternalReviewDTO,
      }), log, silentCache, { auth: noopAuth })
      const incoming: NormalizedExternalReview[] = [
        { source: 'google', sourceExternalId: 'g1', rating: 5, submittedAt: '' },
      ]
      const result = await service.upsertBatch('h1', incoming)
      expect(result).toEqual({ inserted: 0, updated: 1 })
      expect(createAttempts).toBe(1)
    })
  })
})
