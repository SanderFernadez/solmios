// shared/usecases/tests/external-reviews-cron.test.ts — Tests del cron (F3, task 3.3).
// Aceptance: "cron idempotente; si GBP cae, igual procesa TripAdvisor + StayAPI".
//
// Sin tocar la red — los 3 fetchers son mockeados. El orm es un stub mínimo que devuelve
// 1 hotel con creds configuradas. El service.upsertBatch es un mock que cuenta llamadas.
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { createExternalReviewsCron, readHotelExternalConfig, type ExternalReviewsFetchers } from '../external-reviews-cron'
import type { NormalizedExternalReview } from '../../../modules/external-reviews/types'

const noopLog = {
  info: () => {}, warn: () => {},
}

const cacheDelete = mock(async (_key: string) => {})

/** ORM stub — findMany devuelve lo que le digamos por modelo. */
function makeOrm(hotels: any[], configsByHotel: Record<string, any[]>): any {
  return {
    findMany: async (model: string, filters?: any) => {
      if (model === 'Hotels') return hotels
      if (model === 'Configuration') {
        const hid = filters?.hotelId
        return configsByHotel[hid] ?? []
      }
      return []
    },
  }
}

const upsertBatchMock = mock(async (_hid: string, reviews: NormalizedExternalReview[]) => ({
  inserted: reviews.length, updated: 0,
}))

function makeServiceResolver() {
  return () => ({ upsertBatch: upsertBatchMock })
}

// Reset mocks between tests — bun:test no auto-resetea.
beforeEach(() => {
  upsertBatchMock.mockClear()
  cacheDelete.mockClear()
})

const sampleReview = (source: any, extId: string): NormalizedExternalReview => ({
  source, sourceExternalId: extId, rating: 5, submittedAt: '2026-07-01',
})

describe('createExternalReviewsCron', () => {
  it('hotel sin creds → se saltea (no llama upsert)', async () => {
    const orm = makeOrm([{ id: 'h1', name: 'Test' }], { h1: [] })
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [sampleReview('google', 'g1')],
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [sampleReview('booking', 'b1')],
    }
    const cron = createExternalReviewsCron(orm, makeServiceResolver(), noopLog as any, fetchers, { delete: cacheDelete })
    const result = await cron()
    expect(result.hotelsProcessed).toBe(0)
    expect(upsertBatchMock).not.toHaveBeenCalled()
  })

  it('3 fuentes ok → upsert recibe las 3 reviews concatenadas', async () => {
    const orm = makeOrm(
      [{ id: 'h1', name: 'Test' }],
      { h1: [
        { key: 'gbp_place_id', value: 'accounts/1/locations/2' },
        { key: 'gbp_service_account', value: JSON.stringify({ clientEmail: 'sa@test', privateKey: 'pk' }) },
        { key: 'tripadvisor_api_key', value: 'ta-key' },
        { key: 'tripadvisor_location_id', value: 'loc-1' },
        { key: 'stayapi_api_key', value: 'stay-key' },
        { key: 'stayapi_hotel_ids', value: JSON.stringify({ booking: 'b-1' }) },
      ] },
    )
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [sampleReview('google', 'g1')],
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [sampleReview('booking', 'b1')],
    }
    const cron = createExternalReviewsCron(orm, makeServiceResolver(), noopLog as any, fetchers, { delete: cacheDelete })
    const result = await cron()
    expect(result.hotelsProcessed).toBe(1)
    expect(result.totalInserted).toBe(3) // 3 reviews ingested
    expect(upsertBatchMock).toHaveBeenCalledTimes(1)
    const [, reviews] = upsertBatchMock.mock.calls[0] as [string, NormalizedExternalReview[]]
    expect(reviews).toHaveLength(3)
    // Invalida el cache del aggregate del hotel procesado.
    expect(cacheDelete).toHaveBeenCalledWith('public-reviews-aggregate:h1:v1')
  })

  it('GBP cae → procesa TripAdvisor + StayAPI (resiliencia)', async () => {
    const orm = makeOrm(
      [{ id: 'h1', name: 'Test' }],
      { h1: [
        { key: 'gbp_place_id', value: 'p' },
        { key: 'gbp_service_account', value: JSON.stringify({ clientEmail: 'sa@test', privateKey: 'pk' }) },
        { key: 'tripadvisor_api_key', value: 'ta' },
        { key: 'tripadvisor_location_id', value: 'loc' },
      ] },
    )
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => { throw new Error('GBP API 500') }, // cae
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [], // sin creds → []
    }
    const cron = createExternalReviewsCron(orm, makeServiceResolver(), noopLog as any, fetchers, { delete: cacheDelete })
    const result = await cron()
    expect(result.hotelsProcessed).toBe(1)
    expect(result.totalInserted).toBe(1) // solo tripadvisor
    const [, reviews] = upsertBatchMock.mock.calls.at(-1) as [string, NormalizedExternalReview[]]
    expect(reviews).toHaveLength(1)
    expect(reviews[0].source).toBe('tripadvisor')
  })

  it('error en un hotel → continua con el siguiente (no rompe cron)', async () => {
    // Para forzar el path "error en hotel", mockeamos un orm que falle al leer
    // la Configuration de h1 (simula una caída de DB puntual).
    const ormFlaky = {
      findMany: async (model: string, filters: any) => {
        if (model === 'Hotels') return [{ id: 'h1' }, { id: 'h2' }]
        if (model === 'Configuration') {
          if (filters?.hotelId === 'h1') throw new Error('DB read failed for h1')
          return [{ key: 'tripadvisor_api_key', value: 'k' }, { key: 'tripadvisor_location_id', value: 'l' }]
        }
        return []
      },
    }
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [],
      tripadvisor: async () => [sampleReview('tripadvisor', 't-h2')],
      stayapi: async () => [],
    }
    const cron = createExternalReviewsCron(ormFlaky, makeServiceResolver(), noopLog as any, fetchers, { delete: cacheDelete })
    const result = await cron()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('h1')
    expect(result.hotelsProcessed).toBe(1) // h2 se procesó
    expect(result.totalInserted).toBe(1) // 1 review del h2
  })

  it('idempotente: correr 2× llama upsert 2 veces (service hace el dedup)', async () => {
    const orm = makeOrm(
      [{ id: 'h1', name: 'T' }],
      { h1: [{ key: 'tripadvisor_api_key', value: 'k' }, { key: 'tripadvisor_location_id', value: 'l' }] },
    )
    const fetchers: ExternalReviewsFetchers = {
      gbp: async () => [],
      tripadvisor: async () => [sampleReview('tripadvisor', 't1')],
      stayapi: async () => [],
    }
    const cron = createExternalReviewsCron(orm, makeServiceResolver(), noopLog as any, fetchers, { delete: cacheDelete })
    const r1 = await cron()
    const r2 = await cron()
    // Las 2 corridas llaman upsertBatch (el service se encarga de que la 2° no duplique).
    expect(upsertBatchMock).toHaveBeenCalledTimes(2)
    expect(r1.totalInserted).toBe(1)
    expect(r2.totalInserted).toBe(1) // el mock siempre devuelve inserted=reviews.length; el service real haría 0 inserts en la 2°
  })
})

describe('readHotelExternalConfig', () => {
  it('parsea JSON values (gbp_service_account, stayapi_hotel_ids) y strings planos', async () => {
    const orm = makeOrm([], {
      h1: [
        { key: 'gbp_place_id', value: 'p1' },
        { key: 'gbp_service_account', value: JSON.stringify({ clientEmail: 'e', privateKey: 'k' }) },
        { key: 'stayapi_hotel_ids', value: JSON.stringify({ booking: 'b', expedia: 'e' }) },
        { key: 'tripadvisor_api_key', value: 'ta-key' },
      ],
    })
    const cfg = await readHotelExternalConfig(orm, 'h1')
    expect(cfg.gbp.placeId).toBe('p1')
    expect(cfg.gbp.serviceAccount?.clientEmail).toBe('e')
    expect(cfg.stayapi.hotelIds?.booking).toBe('b')
    expect(cfg.tripadvisor.apiKey).toBe('ta-key')
  })

  it('JSON inválido → null (skip silencioso del connector)', async () => {
    const orm = makeOrm([], {
      h1: [{ key: 'gbp_service_account', value: 'not-json{' }],
    })
    const cfg = await readHotelExternalConfig(orm, 'h1')
    expect(cfg.gbp.serviceAccount).toBeNull()
  })
})
