// server-tracking/tests/ga4-ss.test.ts — F3 3.11 usecase GA4 Measurement Protocol v2.
//
// Cubre:
//  - readGa4Config: presencia de measurement_id + api_secret.
//  - buildGa4Payload: shape {client_id, events:[{name:'purchase', params:{transaction_id, value, currency, items}}]}.
//  - fireGa4Conversion: skip si no creds, fire OK si creds, failed si HTTP error.
//  - GA4 devuelve 204 No Content en éxito (sin body) — el usecase lo maneja.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { fireGa4Conversion, buildGa4Payload, readGa4Config } from '../usecases/ga4-ss'
import type { ReservationTrackingData, TrackingFetcher } from '../types'

const log = silentLogger()

const data: ReservationTrackingData = {
  reservationId: 'rsv-456',
  hotelId: 'h1',
  roomId: 'room-A',
  totalAmount: 200,
  currency: 'USD',
  guestEmail: 'test@example.com',
  guestPhone: '+1 555 0100',
  marketingAccepted: true,
  anonymousId: 'client-abc-123',
}

function makeConfigRepo(configsByHotel: Record<string, Array<{ key: string; value: unknown }>>) {
  return {
    findMany: async (filters: any) => configsByHotel[filters?.hotelId] ?? [],
    findOne: async () => null, findById: async () => null,
    create: async () => ({} as any), update: async () => ({} as any), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}

function makeTrackingRepo() {
  const created: any[] = []
  const updated: any[] = []
  return {
    repo: {
      create: mock(async (row: any) => { created.push(row); return row }),
      update: mock(async (id: string, patch: any) => { updated.push({ id, patch }); return { id, ...patch } }),
      findMany: async () => [], findById: async () => null, findOne: async () => null,
      delete: async () => true, count: async () => 0,
      paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    } as any,
    created, updated,
  }
}

describe('F3 3.11 — GA4 Measurement Protocol v2 usecase', () => {
  describe('readGa4Config', () => {
    it('devuelve creds si measurement_id + api_secret presentes', async () => {
      const repo = makeConfigRepo({
        h1: [
          { key: 'ga4_measurement_id', value: 'G-ABCDEF1234' },
          { key: 'ga4_api_secret', value: 'secret-xyz' },
        ],
      })
      const cfg = await readGa4Config('h1', repo)
      expect(cfg!.measurementId).toBe('G-ABCDEF1234')
      expect(cfg!.apiSecret).toBe('secret-xyz')
    })
    it('null si falta api_secret', async () => {
      const repo = makeConfigRepo({ h1: [{ key: 'ga4_measurement_id', value: 'G-X' }] })
      expect(await readGa4Config('h1', repo)).toBeNull()
    })
    it('null si falta measurement_id', async () => {
      const repo = makeConfigRepo({ h1: [{ key: 'ga4_api_secret', value: 's' }] })
      expect(await readGa4Config('h1', repo)).toBeNull()
    })
  })

  describe('buildGa4Payload', () => {
    it('arma events:[{name:"purchase", params:{transaction_id, value, currency, items}}]', () => {
      const body = buildGa4Payload(data)
      expect(body.client_id).toBe('client-abc-123')
      const ev = (body as any).events[0]
      expect(ev.name).toBe('purchase')
      expect(ev.params.transaction_id).toBe('rsv-456')
      expect(ev.params.value).toBe(200)
      expect(ev.params.currency).toBe('USD')
      expect(ev.params.items[0]).toMatchObject({
        item_id: 'room-A', item_category: 'hotel', price: 200, quantity: 1,
      })
    })
    it('client_id fallback determinístico si anonymousId vacío (NO genérico)', () => {
      const noAnon: ReservationTrackingData = { ...data, anonymousId: null }
      const body = buildGa4Payload(noAnon)
      // Fallback: 'server.<reservationId>' — NO 'anonymous' (achataría métrica de users).
      expect(body.client_id).toBe('server.rsv-456')
    })
    it('client_id respeta anonymousId si viene poblado (F3 3.18)', () => {
      const body = buildGa4Payload({ ...data, anonymousId: '  browser-xyz-789  ' })
      // Se respeta el valor (con trim).
      expect(body.client_id).toBe('browser-xyz-789')
    })
  })

  describe('fireGa4Conversion (HTTP integrado)', () => {
    it('skip silencioso si no creds → status=skipped, NO llama fetch', async () => {
      const configRepo = makeConfigRepo({ h1: [] })
      const { repo, created, updated } = makeTrackingRepo()
      const fetcher = mock(async () => ({ ok: true, status: 204, json: async () => ({}), text: async () => '' })) as any as TrackingFetcher
      const result = await fireGa4Conversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('skipped')
      expect(fetcher).not.toHaveBeenCalled()
      expect(created.length).toBe(1)
      expect(created[0].target).toBe('ga4')
      expect(updated[0].patch.status).toBe('skipped')
    })

    it('con creds → fire a MP v2 endpoint con measurement_id + api_secret', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'ga4_measurement_id', value: 'G-TEST1' },
          { key: 'ga4_api_secret', value: 'SECRET1' },
        ],
      })
      const { repo, updated } = makeTrackingRepo()
      let capturedUrl = ''
      let capturedBody: any
      const fetcher: TrackingFetcher = async (url, init) => {
        capturedUrl = url
        capturedBody = JSON.parse(init.body)
        return { ok: true, status: 204, json: async () => ({}), text: async () => '' }
      }
      const result = await fireGa4Conversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('sent')
      expect(capturedUrl).toContain('www.google-analytics.com/mp/collect')
      expect(capturedUrl).toContain('measurement_id=G-TEST1')
      expect(capturedUrl).toContain('api_secret=SECRET1')
      expect(capturedBody.events[0].name).toBe('purchase')
      expect(updated[0].patch.status).toBe('sent')
    })

    it('GA4 204 No Content → status=sent (sin body para log)', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'ga4_measurement_id', value: 'G-X' },
          { key: 'ga4_api_secret', value: 'Y' },
        ],
      })
      const { repo } = makeTrackingRepo()
      const fetcher: TrackingFetcher = async () => ({ ok: true, status: 204, json: async () => ({}), text: async () => '' })
      const result = await fireGa4Conversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('sent')
    })

    it('HTTP 400 → status=failed con código', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'ga4_measurement_id', value: 'G-X' },
          { key: 'ga4_api_secret', value: 'Y' },
        ],
      })
      const { repo, updated } = makeTrackingRepo()
      const fetcher: TrackingFetcher = async () => ({
        ok: false, status: 400, json: async () => ({ error: 'invalid api_secret' }), text: async () => '',
      })
      const result = await fireGa4Conversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('failed')
      expect(result.errorMessage).toContain('GA4 API 400')
      expect(updated[0].patch.status).toBe('failed')
    })
  })
})
