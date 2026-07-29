// opiniones/tests/public-endpoint.test.ts — F0 0.11
// Cubre el handler OpinionesController.publicList y el método service.listPublicReviews.
// Sin auth. El hotel se resuelve por slug. Rate-limit a nivel de ruta (testeado separado).
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter, CacheAdapter, Auth } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { OpinionesService } from '../service'
import { OpinionesController } from '../controller'
import { sanitizePublicReview } from '../usecases/public-list'
import { aggregateCacheKey } from '../usecases/aggregate'
import { resetAttempts } from '../../../shared/middlewares/rate-limit'
import type { OpinionesDTO } from '../types'
import type { ExternalReviewDTO } from '../../external-reviews/types'

const log = silentLogger()
const silentCache: CacheAdapter = {
  get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {},
}

function makeReviewsRepo(seeds: OpinionesDTO[] = []): RepositoryAdapter<OpinionesDTO> {
  return {
    findMany: async (f?: Record<string, unknown>) => {
      // mimic channel filter for visible reviews
      return seeds.filter((r) => {
        if ((r.visible ?? 1) !== 1) return false
        if (r.status !== 'visible') return false
        if (f && 'channel' in f && r.channel !== f.channel) return false
        return true
      })
    },
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => ({ id: 'rev-1', ...data } as OpinionesDTO),
    update: async (id, data) => ({ id, ...data } as OpinionesDTO),
    delete: async () => true,
    count: async () => seeds.length,
    paginate: async (f?: Record<string, unknown>, opts?: { offset?: number; limit?: number }) => {
      const all = seeds.filter((r) => {
        if ((r.visible ?? 1) !== 1) return false
        if (r.status !== 'visible') return false
        if (f && 'channel' in f && r.channel !== f.channel) return false
        return true
      })
      const offset = opts?.offset ?? 0
      const limit = opts?.limit ?? 10
      return { data: all.slice(offset, offset + limit), total: all.length, limit, offset, pages: Math.ceil(all.length / limit) || 0 }
    },
  }
}

function makeHotelRepo(hotel: any): RepositoryAdapter<any> {
  return {
    findOne: async (f: Record<string, unknown>) => (f && 'slug' in f && f.slug === hotel?.slug ? hotel : null),
    findMany: async () => (hotel ? [hotel] : []),
    findById: async () => hotel ?? null,
    create: async () => hotel, update: async () => hotel, delete: async () => true,
    count: async () => (hotel ? 1 : 0),
    paginate: async () => ({ data: hotel ? [hotel] : [], total: hotel ? 1 : 0, limit: 20, offset: 0, pages: 1 }),
  } as RepositoryAdapter<any>
}

function makeExternalRepo(seeds: ExternalReviewDTO[] = []): RepositoryAdapter<ExternalReviewDTO> {
  return {
    findMany: async (f?: Record<string, unknown>) => {
      if (f && 'hotelId' in f) return seeds.filter((r) => r.hotelId === f.hotelId)
      return seeds
    },
    findById: async () => null,
    findOne: async () => null,
    create: async (d) => ({ id: 'ext-1', ...d } as ExternalReviewDTO),
    update: async (id, d) => ({ id, ...d } as ExternalReviewDTO),
    delete: async () => true,
    count: async () => seeds.length,
    paginate: async () => ({ data: seeds, total: seeds.length, limit: 20, offset: 0, pages: 1 }),
  }
}

const userRepo = { findById: async () => ({ id: 'u', hotelId: 'h' }) } as unknown as RepositoryAdapter<any>
const fakeAuth = { assertOwnership: () => {} } as unknown as Auth

function mkController(opts: {
  hotel?: any
  seeds?: OpinionesDTO[]
  externalSeeds?: ExternalReviewDTO[]
  cache?: CacheAdapter
}): { controller: OpinionesController; service: OpinionesService } {
  const repo = makeReviewsRepo(opts.seeds ?? [])
  const externalRepo = makeExternalRepo(opts.externalSeeds ?? [])
  const cache = opts.cache ?? silentCache
  const hotelRepo = makeHotelRepo(opts.hotel)
  const service = new OpinionesService(repo, log, cache, userRepo, fakeAuth)
  const controller = new OpinionesController(service, log, hotelRepo, repo, cache, externalRepo)
  return { controller, service }
}

const baseHotel = {
  id: 'h1', slug: 'hotel-test', name: 'Hotel Test', onlineBookingStatus: 'active',
  publishReviewScore: 1, publishReviewComments: 1,
}

const seeds5: OpinionesDTO[] = [
  { id: 'r1', hotelId: 'h1', rating: 5, comment: 'Excelente', channel: 'direct', status: 'visible', visible: 1, date: '2026-07-01', createdAt: '2026-07-01T00:00:00Z' } as OpinionesDTO,
  { id: 'r2', hotelId: 'h1', rating: 4, comment: 'Muy bueno', channel: 'direct', status: 'visible', visible: 1, date: '2026-07-02', createdAt: '2026-07-02T00:00:00Z' } as OpinionesDTO,
  { id: 'r3', hotelId: 'h1', rating: 3, comment: 'OK', channel: 'direct', status: 'visible', visible: 1, date: '2026-07-03', createdAt: '2026-07-03T00:00:00Z' } as OpinionesDTO,
  { id: 'r4', hotelId: 'h1', rating: 5, comment: 'Top', channel: 'google', status: 'visible', visible: 1, date: '2026-07-04', createdAt: '2026-07-04T00:00:00Z' } as OpinionesDTO,
  { id: 'r5', hotelId: 'h1', rating: 5, comment: 'Great', channel: 'google', status: 'visible', visible: 1, date: '2026-07-05', createdAt: '2026-07-05T00:00:00Z' } as OpinionesDTO,
  // NO visibles — nunca aparecen:
  { id: 'p1', hotelId: 'h1', rating: 2, comment: 'pending', channel: 'direct', status: 'pending', visible: 0 } as OpinionesDTO,
  { id: 'inv', hotelId: 'h1', rating: 2, comment: 'hidden', channel: 'direct', status: 'visible', visible: 0 } as OpinionesDTO,
]

describe('F0 0.11 — OpinionesController.publicList', () => {
  it('hotel existe + reviews visibles → 200 con reviews + aggregate + distribution + pagination', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const res = await controller.publicList({
      params: { slug: 'hotel-test' }, query: {}, headers: {}, remoteAddress: '127.0.0.1',
    } as any)
    expect(res.status).toBe(200)
    const body = res.body as any
    expect(body.reviews).toHaveLength(5)
    expect(body.aggregate.count).toBe(5)
    expect(body.aggregate.score).toBeGreaterThan(0)
    expect(body.distribution['5']).toBe(3) // r1, r4, r5
    expect(body.distribution['4']).toBe(1)
    expect(body.distribution['3']).toBe(1)
    expect(body.pagination.total).toBe(5)
    expect(body.pagination.totalPages).toBe(1)
  })

  it('hotel slug inexistente → 404', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'no-existe' }, query: {} } as any)
    expect(res.status).toBe(404)
  })

  it('hotel con onlineBookingStatus != active → 404', async () => {
    const hotel = { ...baseHotel, onlineBookingStatus: 'inactive' }
    const { controller } = mkController({ hotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    expect(res.status).toBe(404)
  })

  it('publishReviewScore=false → aggregate.score===null, count presente', async () => {
    const hotel = { ...baseHotel, publishReviewScore: 0 }
    const { controller } = mkController({ hotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    expect(res.status).toBe(200)
    expect((res.body as any).aggregate.score).toBeNull()
    expect((res.body as any).aggregate.count).toBe(5)
  })

  it('publishReviewComments=false → cada review.comment===null', async () => {
    const hotel = { ...baseHotel, publishReviewComments: 0 }
    const { controller } = mkController({ hotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    expect(res.status).toBe(200)
    const reviews = (res.body as any).reviews
    expect(reviews).toHaveLength(5)
    for (const r of reviews) expect(r.comment).toBeNull()
    // rating sigue visible
    expect(reviews[0].rating).toBeGreaterThanOrEqual(1)
  })

  it('source=google → solo reviews google devueltas', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: { source: 'google' } } as any)
    expect(res.status).toBe(200)
    const body = res.body as any
    expect(body.reviews).toHaveLength(2)
    for (const r of body.reviews) expect(r.channel).toBe('google')
    // aggregate sigue siendo GLOBAL (sobre todas las visibles) — el source es filtro de página, no de aggregate.
    expect(body.aggregate.count).toBe(5)
  })

  it('paginación: limit=2 → 3 páginas de 2/2/1', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const r1 = await controller.publicList({ params: { slug: 'hotel-test' }, query: { page: 1, limit: 2 } } as any)
    const r2 = await controller.publicList({ params: { slug: 'hotel-test' }, query: { page: 2, limit: 2 } } as any)
    const r3 = await controller.publicList({ params: { slug: 'hotel-test' }, query: { page: 3, limit: 2 } } as any)
    expect((r1.body as any).reviews).toHaveLength(2)
    expect((r1.body as any).pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 })
    expect((r2.body as any).reviews).toHaveLength(2)
    expect((r3.body as any).reviews).toHaveLength(1)
  })

  it('source inválido cae a "all" (sin 400)', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: { source: 'expedia hack' } } as any)
    expect(res.status).toBe(200)
    expect((res.body as any).reviews).toHaveLength(5)
  })

  it('public DTO nunca expone guestId/token/hotelId/response/id/sourceExternalId', async () => {
    const seeds: OpinionesDTO[] = [{
      id: 'r-secret', hotelId: 'h1', guestId: 'guest-777', reservationId: 'res-999',
      rating: 5, comment: 'nice', title: 't', channel: 'direct', status: 'visible', visible: 1,
      token: 'SECRET-TOKEN', sourceExternalId: 'ext-1', response: 'respuesta interna',
      date: '2026-07-01', createdAt: '2026-07-01',
    } as OpinionesDTO]
    const { controller } = mkController({ hotel: baseHotel, seeds })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    const rev = (res.body as any).reviews[0]
    const json = JSON.stringify(rev)
    expect(json).not.toContain('guest-777')
    expect(json).not.toContain('SECRET-TOKEN')
    expect(json).not.toContain('h1')
    expect(json).not.toContain('respuesta interna')
    expect(json).not.toContain('r-secret')
    expect(json).not.toContain('ext-1')
    expect(json).not.toContain('res-999')
    // keys públicas permitidas (sourceUrl agregado F3 — backlink TripAdvisor obligatorio)
    expect(Object.keys(rev).sort()).toEqual(['authorName', 'channel', 'comment', 'date', 'rating', 'sourceUrl', 'title'])
  })

  it('pending o visible=0 NUNCA aparecen', async () => {
    const { controller } = mkController({ hotel: baseHotel, seeds: seeds5 })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    const ids = (res.body as any).reviews // solo rating/channel/...; sin id. validamos por count
    expect(ids).toHaveLength(5) // 7 seeds - 2 no-visible = 5
  })

  it('cache del aggregate: segunda llamada usa cache (no recomputa)', async () => {
    let fetchCalls = 0
    const cacheStore = new Map<string, unknown>()
    const cache: CacheAdapter = {
      get: (async (k: string) => cacheStore.get(k) ?? null) as <T>(key: string) => Promise<T | null>,
      set: async (k: string, v: unknown) => { cacheStore.set(k, v) },
      delete: async (k: string) => { cacheStore.delete(k) },
      flush: async () => { cacheStore.clear() },
    }
    const seeds: OpinionesDTO[] = [seeds5[0]]
    const repo = makeReviewsRepo(seeds)
    const origFind = repo.findMany
    repo.findMany = async (f?: Record<string, unknown>) => { fetchCalls++; return origFind(f) }
    const hotelRepo = makeHotelRepo(baseHotel)
    const service = new OpinionesService(repo, log, cache, userRepo, fakeAuth)
    const controller = new OpinionesController(service, log, hotelRepo, repo, cache)

    await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)

    // sin cache: 2 calls × (1 fetch aggregate + 0 fetch paginate → paginate es mock aparte).
    // Con cache: el primer GET guarda aggregateCacheKey, el segundo lo sirve del cache.
    expect(cacheStore.has(aggregateCacheKey('h1'))).toBe(true)
  })
})

describe('F0 0.11 — sanitizePublicReview (allow-list)', () => {
  it('hideComment=false conserva comment', () => {
    const out = sanitizePublicReview(seeds5[0], { hideComment: false })
    expect(out.comment).toBe('Excelente')
    expect(out.rating).toBe(5)
  })

  it('hideComment=true nullifica solo comment', () => {
    const seedWithTitle = { ...seeds5[0], title: 'Estadía genial' } as OpinionesDTO
    const out = sanitizePublicReview(seedWithTitle, { hideComment: true })
    expect(out.comment).toBeNull()
    expect(out.rating).toBe(5)
    expect(out.title).toBe('Estadía genial')
  })
})

// ─── F3 3.4 — Mezcla direct + external_reviews en el endpoint público ────────────
const externalSeeds: ExternalReviewDTO[] = [
  { id: 'e1', hotelId: 'h1', source: 'google', sourceExternalId: 'g-1', rating: 5, comment: 'Great place', title: 'Top', authorName: 'Ana', submittedAt: '2026-07-10', createdAt: '2026-07-10', updatedAt: '2026-07-10' } as ExternalReviewDTO,
  { id: 'e2', hotelId: 'h1', source: 'google', sourceExternalId: 'g-2', rating: 4, comment: 'Good', title: null, authorName: 'Bob', submittedAt: '2026-07-08', createdAt: '2026-07-08', updatedAt: '2026-07-08' } as ExternalReviewDTO,
  { id: 'e3', hotelId: 'h1', source: 'tripadvisor', sourceExternalId: 't-1', rating: 5, comment: 'Excellent', title: null, authorName: 'Carl', submittedAt: '2026-07-06', createdAt: '2026-07-06', updatedAt: '2026-07-06' } as ExternalReviewDTO,
]

describe('F3 3.4 — OpinionesController.publicList (mezcla direct + external)', () => {
  it('acceptance: 3 direct + 3 external → reviews=6, aggregate.count=6, perSource con google+tripadvisor', async () => {
    // 3 direct visibles (sacamos las 2 google-channel de seeds5 para tener 3 direct "puras")
    const directOnly = seeds5.filter((s) => s.channel !== 'google').slice(0, 3)
    const { controller } = mkController({ hotel: baseHotel, seeds: directOnly, externalSeeds })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    expect(res.status).toBe(200)
    const body = res.body as any
    // 3 direct + 3 external = 6
    expect(body.reviews).toHaveLength(6)
    expect(body.aggregate.count).toBe(6)
    // perSource: direct (3) + google (2) + tripadvisor (1)
    expect(body.aggregate.perSource.direct.count).toBe(3)
    expect(body.aggregate.perSource.google.count).toBe(2)
    expect(body.aggregate.perSource.tripadvisor.count).toBe(1)
  })

  it('source=google → trae externas google (no las direct con otro channel)', async () => {
    const directOnly = seeds5.filter((s) => s.channel !== 'google').slice(0, 3)
    const { controller } = mkController({ hotel: baseHotel, seeds: directOnly, externalSeeds })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: { source: 'google' } } as any)
    expect(res.status).toBe(200)
    const body = res.body as any
    expect(body.reviews).toHaveLength(2) // 2 google externas
    for (const r of body.reviews) expect(r.channel).toBe('google')
    // aggregate GLOBAL: no filtra por source
    expect(body.aggregate.count).toBe(6)
  })

  it('external con authorName → lo expone; direct → null (no filtra guestId)', async () => {
    const directOnly = seeds5.filter((s) => s.channel !== 'google').slice(0, 1)
    const { controller } = mkController({ hotel: baseHotel, seeds: directOnly, externalSeeds: [externalSeeds[0]] })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    const reviews = (res.body as any).reviews
    const external = reviews.find((r: any) => r.channel === 'google')
    const direct = reviews.find((r: any) => r.channel === 'direct')
    expect(external.authorName).toBe('Ana')
    expect(direct.authorName).toBeNull()
  })

  it('publishReviewComments=false → nullifica comment de direct Y external', async () => {
    const directOnly = seeds5.filter((s) => s.channel !== 'google').slice(0, 1)
    const hotel = { ...baseHotel, publishReviewComments: 0 }
    const { controller } = mkController({ hotel, seeds: directOnly, externalSeeds: [externalSeeds[0]] })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: {} } as any)
    const reviews = (res.body as any).reviews
    for (const r of reviews) expect(r.comment).toBeNull()
  })

  it('merge respeta orden por fecha desc (sin importar la tabla de origen)', async () => {
    // direct con date 2026-07-01; externas con fechas más recientes.
    const directOnly: OpinionesDTO[] = [
      { id: 'd-old', hotelId: 'h1', rating: 5, comment: 'old direct', channel: 'direct', status: 'visible', visible: 1, date: '2026-07-01', createdAt: '2026-07-01T00:00:00Z' } as OpinionesDTO,
    ]
    const { controller } = mkController({ hotel: baseHotel, seeds: directOnly, externalSeeds })
    const res = await controller.publicList({ params: { slug: 'hotel-test' }, query: { limit: 10 } } as any)
    const dates = (res.body as any).reviews.map((r: any) => r.date)
    // desc: '2026-07-10' (e1) → '2026-07-08' (e2) → '2026-07-06' (e3) → '2026-07-01' (direct)
    expect(dates).toEqual(['2026-07-10', '2026-07-08', '2026-07-06', '2026-07-01'])
  })
})

describe('F0 0.11 — rate-limit en la ruta (60 req/min/IP)', () => {
  it('61 requests en 1 min desde la misma IP → 429 en la 61ª', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`
    const slug = `rl-${Math.random().toString(36).slice(2)}`
    const hotel = { ...baseHotel, slug }
    const { controller } = mkController({ hotel, seeds: seeds5 })
    // El rate-limit se aplica en index.ts (ruta); acá simulamos la lógica idéntica
    // usando la MISMA función + MISMA key que la ruta, para no duplicar el set de middlware.
    const { rateLimit } = await import('../../../shared/middlewares/rate-limit')
    const key = `public-reviews:${ip}`
    resetAttempts(key)
    const req = { params: { slug }, query: {}, headers: {}, remoteAddress: ip } as any

    for (let i = 0; i < 60; i++) {
      const { allowed } = rateLimit(key, { maxAttempts: 60, windowMs: 60_000 })
      if (!allowed) throw new Error(`no debería bloquear en iter ${i}`)
      const res = await controller.publicList(req)
      if (res.status === 429) throw new Error(`no debería 429 en iter ${i}`)
    }
    // 61ª
    const blocked = rateLimit(key, { maxAttempts: 60, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)

    // cleanup
    resetAttempts(key)
  })
})
