// external-reviews/tests/sync-now.test.ts — F3 3.5 (solmi-direct-booking / reputation-aggregator)
// Cubre el handler ExternalReviewsController.syncNow — el botón "Sync now" del panel admin.
//
// Sin tocar la red: los fetchers son mockeados. El orm es un stub que devuelve la configuration
// del hotel. El service.upsertBatch es un mock que cuenta llamadas.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import type { CacheAdapter } from 'arckode-framework'
import { ExternalReviewsService } from '../service'
import { ExternalReviewsController } from '../controller'
import type { NormalizedExternalReview } from '../types'
import type { ExternalReviewsFetchers } from '../../../shared/usecases/external-reviews-cron'

const log = silentLogger()
const silentCache: CacheAdapter = {
  get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {},
}
const noopAuth = { assertOwnership: () => undefined, authenticate: (() => []) as any } as any

const sampleReview = (source: any, extId: string): NormalizedExternalReview => ({
  source, sourceExternalId: extId, rating: 5, submittedAt: '2026-07-01',
})

/** ORM stub — devuelve creds de Configuration para el hotel que se pida. */
function makeOrm(configsByHotel: Record<string, any[]>): any {
  return {
    findMany: async (_model: string, filters?: any) => {
      const hid = filters?.hotelId
      return configsByHotel[hid] ?? []
    },
  }
}

function makeService(upsertBatchImpl: (h: string, r: NormalizedExternalReview[]) => Promise<{ inserted: number; updated: number }>) {
  const repo = {
    findMany: async () => [], findById: async () => null, findOne: async () => null,
    create: async () => ({} as any), update: async () => ({} as any), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
  const service = new ExternalReviewsService(repo, log, silentCache, { auth: noopAuth })
  service.upsertBatch = mock(upsertBatchImpl) as any
  return { service, repo }
}

const cacheDelete = mock(async (_key: string) => {})

describe('F3 3.5 — ExternalReviewsController.syncNow', () => {
  it('hotel sin creds → 200 con noCreds:true, NO llama upsert', async () => {
    const orm = makeOrm({ 'h1': [] })
    const { service } = makeService(async () => ({ inserted: 0, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [sampleReview('google', 'g1')],
      tripadvisor: async () => [],
      stayapi: async () => [],
    }
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: 'h1' } } as any
    const res = await controller.syncNow(req, {
      orm, resolveModule: () => service, fetchers,
      cache: { delete: cacheDelete },
    })
    expect(res.status).toBe(200)
    expect((res.body as any).noCreds).toBe(true)
    expect((service.upsertBatch as any)).not.toHaveBeenCalled()
  })

  it('hotel con creds TripAdvisor → 200 con inserted=N (count de reviews nuevas)', async () => {
    const orm = makeOrm({
      'h1': [
        { key: 'tripadvisor_api_key', value: 'ta-key' },
        { key: 'tripadvisor_location_id', value: 'loc-1' },
      ],
    })
    const { service } = makeService(async (_h, r) => ({ inserted: r.length, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [],
      tripadvisor: async () => [sampleReview('tripadvisor', 't1'), sampleReview('tripadvisor', 't2')],
      stayapi: async () => [],
    }
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: 'h1' } } as any
    const res = await controller.syncNow(req, {
      orm, resolveModule: () => service, fetchers,
      cache: { delete: cacheDelete },
    })
    expect(res.status).toBe(200)
    expect((res.body as any).inserted).toBe(2)
    expect((res.body as any).updated).toBe(0)
    expect((res.body as any).hotelId).toBe('h1')
    // Invalida el cache del aggregate del hotel → próximo GET /reviews recomputea.
    expect(cacheDelete).toHaveBeenCalledWith('public-reviews-aggregate:h1:v1')
  })

  it('idempotente: 2das+ calls con mismas reviews → inserted=0 (lo hace el service)', async () => {
    const orm = makeOrm({
      'h1': [{ key: 'tripadvisor_api_key', value: 'k' }, { key: 'tripadvisor_location_id', value: 'l' }],
    })
    const { service } = makeService(async () => ({ inserted: 0, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [],
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [],
    }
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: 'h1' } } as any
    const deps = { orm, resolveModule: () => service, fetchers, cache: { delete: cacheDelete } }
    const r1 = await controller.syncNow(req, deps)
    const r2 = await controller.syncNow(req, deps)
    expect((r1.body as any).inserted).toBe(0)
    expect((r2.body as any).inserted).toBe(0)
    // El service.upsertBatch se llama ambas veces (el dedup lo hace el service internamente).
    expect((service.upsertBatch as any)).toHaveBeenCalledTimes(2)
  })

  it('resiliencia: GBP cae → procesa TripAdvisor + StayAPI, no rompe', async () => {
    const orm = makeOrm({
      'h1': [
        { key: 'gbp_place_id', value: 'p' },
        { key: 'gbp_service_account', value: JSON.stringify({ clientEmail: 'sa', privateKey: 'pk' }) },
        { key: 'tripadvisor_api_key', value: 'k' },
        { key: 'tripadvisor_location_id', value: 'l' },
      ],
    })
    const { service } = makeService(async (_h, r) => ({ inserted: r.length, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => { throw new Error('GBP API 500') },
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [sampleReview('booking', 'b1')],
    }
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: 'h1' } } as any
    const res = await controller.syncNow(req, {
      orm, resolveModule: () => service, fetchers, cache: { delete: cacheDelete },
    })
    expect(res.status).toBe(200)
    expect((res.body as any).inserted).toBe(2) // tripadvisor + stayapi
    // GBP crudo arroja (sin try/catch como los connectors reales) → allSettled lo marca
    // rejected y suma a skippedSources. Los connectors reales envuelven con try/catch
    // y devuelven [], así que en prod skippedSources=0 para esta misma caída.
    expect((res.body as any).skippedSources).toBe(1)
  })

  it('sin fetchers inyectados → 503 (entorno sin environment)', async () => {
    const orm = makeOrm({ 'h1': [{ key: 'tripadvisor_api_key', value: 'k' }] })
    const { service } = makeService(async () => ({ inserted: 0, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: 'h1' } } as any
    const res = await controller.syncNow(req, {
      orm, resolveModule: () => service, fetchers: undefined,
      cache: { delete: cacheDelete },
    })
    expect(res.status).toBe(503)
    expect((res.body as any).error).toMatch(/no disponible/i)
  })

  it('user sin hotelId → 400', async () => {
    const orm = makeOrm({})
    const { service } = makeService(async () => ({ inserted: 0, updated: 0 }))
    const controller = new ExternalReviewsController(service, log)
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [], tripadvisor: async () => [], stayapi: async () => [],
    }
    const req = { user: { id: 'u1', role: 'hotel_admin', hotelId: undefined } } as any
    const res = await controller.syncNow(req, {
      orm, resolveModule: () => service, fetchers, cache: { delete: cacheDelete },
    })
    expect(res.status).toBe(400)
  })
})
