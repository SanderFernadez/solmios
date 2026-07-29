// opiniones/tests/aggregate.test.ts — F0 0.10 + F3 3.4
// Cubre computeAggregate + helpers puros (computeAggregateFromReviews, computeDistribution).
// Verifica contrato {score, count, perSource} + extensión distribution.
// F3 3.4: cubre mezcla direct + external_reviews (spec.md:152-166 ampliado).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import {
  computeAggregate,
  computeAggregateFromReviews,
  computeDistribution,
  aggregateCacheKey,
} from '../usecases/aggregate'
import type { OpinionesDTO } from '../types'
import type { ExternalReviewDTO } from '../../external-reviews/types'

const silentCache: CacheAdapter = {
  get: async () => null,
  set: async () => {},
  delete: async () => {},
  flush: async () => {},
}

function makeRepo(seeds: OpinionesDTO[] = []): RepositoryAdapter<OpinionesDTO> {
  return {
    findMany: async () => seeds,
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'rev-1', ...data } as OpinionesDTO),
    update: async (id, data) => ({ id, ...data } as OpinionesDTO),
    delete: async () => true,
    count: async () => seeds.length,
    paginate: async () => ({ data: seeds, total: seeds.length, limit: 20, offset: 0, pages: 1 }),
  }
}

function review(channel: string, rating: number, id?: string): OpinionesDTO {
  return { id: id ?? `${channel}-${rating}-${Math.random()}`, hotelId: 'h1', rating, channel } as OpinionesDTO
}

describe('F0 0.10 — computeAggregate (pure helpers)', () => {
  describe('computeAggregateFromReviews', () => {
    it('hotel sin reviews → {score:0, count:0, perSource:{}}', () => {
      const r = computeAggregateFromReviews([])
      expect(r).toEqual({ score: 0, count: 0, perSource: {} })
    })

    it('3 direct (5,4,3) + 2 google (5,5) → perSource.direct.{4,3}, perSource.google.{5,2}, overall {4.4, 5}', () => {
      const seeds = [
        review('direct', 5), review('direct', 4), review('direct', 3),
        review('google', 5), review('google', 5),
      ]
      const r = computeAggregateFromReviews(seeds)
      expect(r.count).toBe(5)
      expect(r.score).toBe(4.4)
      expect(r.perSource.direct).toEqual({ score: 4, count: 3 })
      expect(r.perSource.google).toEqual({ score: 5, count: 2 })
    })

    it('escala a 2 decimales (4.333 → 4.33)', () => {
      const seeds = [review('direct', 5), review('direct', 4), review('direct', 4)] // (5+4+4)/3 = 4.333...
      const r = computeAggregateFromReviews(seeds)
      expect(r.score).toBe(4.33)
      expect(r.perSource.direct).toEqual({ score: 4.33, count: 3 })
    })

    it('channel default → "direct" cuando viene undefined', () => {
      const seeds = [{ id: 'r1', hotelId: 'h1', rating: 4 } as OpinionesDTO]
      const r = computeAggregateFromReviews(seeds)
      expect(r.perSource.direct).toEqual({ score: 4, count: 1 })
    })

    it('spec.md scenario: 4 direct (4.5) + 3 google (4.0) → overall 4.29', () => {
      const seeds = [
        review('direct', 5), review('direct', 5), review('direct', 4), review('direct', 4), // 18/4 = 4.5
        review('google', 4), review('google', 4), review('google', 4),                       // 12/3 = 4.0
      ]
      const r = computeAggregateFromReviews(seeds)
      // (18 + 12) / 7 = 4.285 → redondea 4.29
      expect(r.score).toBe(4.29)
      expect(r.count).toBe(7)
      expect(r.perSource.direct).toEqual({ score: 4.5, count: 4 })
      expect(r.perSource.google).toEqual({ score: 4, count: 3 })
    })
  })

  describe('computeDistribution', () => {
    it('vacío → todos en 0', () => {
      expect(computeDistribution([])).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
    })

    it('spec.md:12(5★) + 8(4★) + 2(3★) + 1(1★) → {5:12, 4:8, 3:2, 2:0, 1:1}', () => {
      const seeds: OpinionesDTO[] = [
        ...Array.from({ length: 12 }, () => review('direct', 5)),
        ...Array.from({ length: 8 }, () => review('direct', 4)),
        ...Array.from({ length: 2 }, () => review('direct', 3)),
        review('direct', 1),
      ]
      expect(computeDistribution(seeds)).toEqual({ '5': 12, '4': 8, '3': 2, '2': 0, '1': 1 })
    })
  })
})

describe('F0 0.10 — computeAggregate (cached, con deps)', () => {
  it('hotel sin reviews → {score:0, count:0, perSource:{}}', async () => {
    const r = await computeAggregate('h-empty', { reviewsRepo: makeRepo([]), cache: silentCache })
    expect(r.score).toBe(0)
    expect(r.count).toBe(0)
    expect(r.perSource).toEqual({})
    expect(r.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })
  })

  it('3 direct (5,4,3) + 2 google (5,5) → perSource correcto, overall.score=4.4', async () => {
    const seeds = [
      review('direct', 5), review('direct', 4), review('direct', 3),
      review('google', 5), review('google', 5),
    ]
    const r = await computeAggregate('h1', { reviewsRepo: makeRepo(seeds), cache: silentCache })
    expect(r.score).toBe(4.4)
    expect(r.count).toBe(5)
    expect(r.perSource.direct).toEqual({ score: 4, count: 3 })
    expect(r.perSource.google).toEqual({ score: 5, count: 2 })
  })

  it('cache HIT sirve sin tocar el repo (segunda llamada)', async () => {
    let calls = 0
    const cacheStore = new Map<string, unknown>()
    const cache: CacheAdapter = {
      get: (async (k: string) => cacheStore.get(k) ?? null) as <T>(key: string) => Promise<T | null>,
      set: async (k: string, v: unknown) => { cacheStore.set(k, v); },
      delete: async (k: string) => { cacheStore.delete(k) },
      flush: async () => { cacheStore.clear() },
    }
    const repo = makeRepo([review('direct', 5)])
    repo.findMany = async () => { calls++; return [review('direct', 5)] }

    const deps = { reviewsRepo: repo, cache }
    const r1 = await computeAggregate('h-cache', deps)
    const r2 = await computeAggregate('h-cache', deps)

    expect(calls).toBe(1) // solo el primer llamado fetchea
    expect(r2).toEqual(r1)
    expect(r2.score).toBe(5)
    // la clave cacheada es la versionada (no glob — no se puede invalidar por prefijo)
    expect(cacheStore.has(aggregateCacheKey('h-cache'))).toBe(true)
  })

  it('cache MISS distinto hotel → fetch distinto (claves por hotelId)', async () => {
    let calls = 0
    const cacheStore = new Map<string, unknown>()
    const cache: CacheAdapter = {
      get: (async (k: string) => cacheStore.get(k) ?? null) as <T>(key: string) => Promise<T | null>,
      set: async (k: string, v: unknown) => { cacheStore.set(k, v); },
      delete: async (k: string) => { cacheStore.delete(k) },
      flush: async () => { cacheStore.clear() },
    }
    const repo = makeRepo([review('direct', 5)])
    repo.findMany = async () => { calls++; return [review('direct', 5)] }

    await computeAggregate('h-A', { reviewsRepo: repo, cache })
    await computeAggregate('h-B', { reviewsRepo: repo, cache })

    expect(calls).toBe(2) // 1 fetch por hotel (cacheKeys distintas)
    expect(cacheStore.has(aggregateCacheKey('h-A'))).toBe(true)
    expect(cacheStore.has(aggregateCacheKey('h-B'))).toBe(true)
  })
})

// ─── F3 3.4 — Mezcla direct + external_reviews (spec reputation-aggregator) ───────
function makeExternalRepo(seeds: ExternalReviewDTO[] = []): RepositoryAdapter<ExternalReviewDTO> {
  return {
    findMany: async () => seeds,
    findById: async () => null,
    findOne: async () => null,
    create: async (d) => ({ id: 'ext-1', ...d } as ExternalReviewDTO),
    update: async (id, d) => ({ id, ...d } as ExternalReviewDTO),
    delete: async () => true,
    count: async () => seeds.length,
    paginate: async () => ({ data: seeds, total: seeds.length, limit: 20, offset: 0, pages: 1 }),
  }
}

function extReview(source: string, rating: number): ExternalReviewDTO {
  return {
    id: `ext-${source}-${rating}-${Math.random()}`, hotelId: 'h1', source,
    sourceExternalId: `ext-${source}-${Math.random()}`, rating,
    submittedAt: '2026-07-01', createdAt: '2026-07-01', updatedAt: '2026-07-01',
  } as ExternalReviewDTO
}

describe('F3 3.4 — computeAggregate (mezcla direct + external)', () => {
  it('acceptance: 3 direct (5,4,3) + 5 google (5,5,4,4,4) → aggregate.count=8, perSource.google.count=5', async () => {
    const direct = [review('direct', 5), review('direct', 4), review('direct', 3)]
    const external = [extReview('google', 5), extReview('google', 5), extReview('google', 4), extReview('google', 4), extReview('google', 4)]
    const r = await computeAggregate('h1', {
      reviewsRepo: makeRepo(direct),
      externalReviewsRepo: makeExternalRepo(external),
      cache: silentCache,
    })
    expect(r.count).toBe(8)
    expect(r.perSource.direct).toEqual({ score: 4, count: 3 })
    expect(r.perSource.google).toEqual({ score: 4.4, count: 5 })
    // overall: (5+4+3 + 5+5+4+4+4)/8 = 34/8 = 4.25
    expect(r.score).toBe(4.25)
  })

  it('todas las fuentes externas representadas (google/tripadvisor/booking/airbnb/expedia)', async () => {
    const external = [
      extReview('google', 5), extReview('tripadvisor', 4), extReview('booking', 3),
      extReview('airbnb', 5), extReview('expedia', 4),
    ]
    const r = await computeAggregate('h-mix', {
      reviewsRepo: makeRepo([]),
      externalReviewsRepo: makeExternalRepo(external),
      cache: silentCache,
    })
    expect(r.count).toBe(5)
    expect(Object.keys(r.perSource).sort()).toEqual(['airbnb', 'booking', 'expedia', 'google', 'tripadvisor'])
  })

  it('sin repo externo → degrada a solo direct (compat retro)', async () => {
    const r = await computeAggregate('h-direct-only', {
      reviewsRepo: makeRepo([review('direct', 5)]),
      cache: silentCache,
    })
    expect(r.count).toBe(1)
    expect(r.perSource.direct).toEqual({ score: 5, count: 1 })
    expect(r.perSource.google).toBeUndefined()
  })

  it('repo externo falla → degrada a solo direct (no rompe el endpoint público)', async () => {
    const brokenExternal: RepositoryAdapter<ExternalReviewDTO> = {
      ...makeExternalRepo([]),
      findMany: async () => { throw new Error('table missing') },
    }
    const r = await computeAggregate('h-fail', {
      reviewsRepo: makeRepo([review('direct', 5)]),
      externalReviewsRepo: brokenExternal,
      cache: silentCache,
    })
    expect(r.count).toBe(1)
    expect(r.perSource.direct).toEqual({ score: 5, count: 1 })
  })

  it('distribution combina estrellas de ambas fuentes', async () => {
    const direct = [review('direct', 5), review('direct', 4)]
    const external = [extReview('google', 5), extReview('google', 1)]
    const r = await computeAggregate('h-dist', {
      reviewsRepo: makeRepo(direct),
      externalReviewsRepo: makeExternalRepo(external),
      cache: silentCache,
    })
    expect(r.distribution).toEqual({ '1': 1, '2': 0, '3': 0, '4': 1, '5': 2 })
  })
})
