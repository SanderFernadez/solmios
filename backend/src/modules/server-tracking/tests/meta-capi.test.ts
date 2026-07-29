// server-tracking/tests/meta-capi.test.ts — F3 3.11 usecase Meta CAPI + buildMetaPayload.
//
// Cubre el acceptance: "mockear Meta+GA4 HTTP → los 2 usecases disparan; hash verificado".
// Sin tocar la red: el fetcher es un mock que cuenta llamadas y devuelve 200 con body falso.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import { fireMetaConversion, buildMetaPayload, readMetaConfig } from '../usecases/meta-capi'
import type { ReservationTrackingData, TrackingFetcher } from '../types'

const log = silentLogger()

const data: ReservationTrackingData = {
  reservationId: 'rsv-123',
  hotelId: 'h1',
  roomId: 'room-9',
  totalAmount: 150.5,
  currency: 'USD',
  guestEmail: 'Juan.Perez@Example.com',
  guestPhone: '+1 809 555 0000',
  marketingAccepted: true,
  anonymousId: null,
}

/** Mock repo de configuration — devuelve filas según hotelId. */
function makeConfigRepo(configsByHotel: Record<string, Array<{ key: string; value: unknown }>>) {
  return {
    findMany: async (filters: any) => configsByHotel[filters?.hotelId] ?? [],
    findOne: async () => null,
    findById: async () => null,
    create: async () => ({} as any),
    update: async () => ({} as any),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}

/** Mock repo de tracking_events — captura creates y updates para aserciones. */
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

describe('F3 3.11 — Meta CAPI usecase', () => {
  describe('readMetaConfig', () => {
    it('devuelve creds si pixel_id + capi_token presentes', async () => {
      const repo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: '1234567890' },
          { key: 'meta_capi_token', value: 'EAAG...' },
          { key: 'meta_test_event_code', value: 'TEST123' },
        ],
      })
      const cfg = await readMetaConfig('h1', repo)
      expect(cfg).not.toBeNull()
      expect(cfg!.pixelId).toBe('1234567890')
      expect(cfg!.token).toBe('EAAG...')
      expect(cfg!.testCode).toBe('TEST123')
    })
    it('devuelve null si falta pixel_id', async () => {
      const repo = makeConfigRepo({ h1: [{ key: 'meta_capi_token', value: 'EAAG...' }] })
      expect(await readMetaConfig('h1', repo)).toBeNull()
    })
    it('devuelve null si falta capi_token', async () => {
      const repo = makeConfigRepo({ h1: [{ key: 'meta_pixel_id', value: '123' }] })
      expect(await readMetaConfig('h1', repo)).toBeNull()
    })
    it('devuelve null si hotel no tiene config', async () => {
      const repo = makeConfigRepo({ h1: [] })
      expect(await readMetaConfig('other', repo)).toBeNull()
    })
    it('testCode opcional — solo se setea si no vacío', async () => {
      const repo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: '123' },
          { key: 'meta_capi_token', value: 'tok' },
          { key: 'meta_test_event_code', value: '  ' }, // whitespace → se ignora
        ],
      })
      const cfg = await readMetaConfig('h1', repo)
      expect(cfg!.testCode).toBeUndefined()
    })
  })

  describe('buildMetaPayload', () => {
    it('arma event Purchase con event_id, action_source=system, custom_data', () => {
      const body = buildMetaPayload(data, { em: 'abc', ph: 'def' })
      expect(body).toHaveProperty('data')
      const event = (body as any).data[0]
      expect(event.event_name).toBe('Purchase')
      expect(event.event_id).toBe('rsv-123') // dedup
      expect(event.action_source).toBe('system')
      expect(event.custom_data).toMatchObject({
        value: 150.5, currency: 'USD', content_type: 'hotel', content_ids: ['room-9'],
      })
      expect(event.opt_in).toBe(true)
    })
    it('user_data con em y ph (hashed) cuando marketingAccepted=true', () => {
      const body = buildMetaPayload(data, { em: 'aabb', ph: 'ccdd' })
      const event = (body as any).data[0]
      expect(event.user_data.em).toEqual(['aabb'])
      expect(event.user_data.ph).toEqual(['ccdd'])
    })
    it('user_data VACÍO cuando marketingAccepted=false (sin PII)', () => {
      const noOpt = { ...data, marketingAccepted: false }
      const body = buildMetaPayload(noOpt, { em: 'aabb', ph: 'ccdd' })
      const event = (body as any).data[0]
      // Sin opt-in, los hashes se descartan (spec.md "Usuario rechaza consentimiento").
      expect(event.user_data).toEqual({})
      expect(event.opt_in).toBe(false)
    })
    it('test_event_code va al top-level del body si se pasa', () => {
      const body = buildMetaPayload(data, {}, 'TESTABC123')
      expect(body).toHaveProperty('test_event_code', 'TESTABC123')
      expect(body).toHaveProperty('data')
    })
  })

  describe('fireMetaConversion (HTTP integrado)', () => {
    it('skip silencioso si no hay creds → tracking event status=skipped, NO llama fetch', async () => {
      const configRepo = makeConfigRepo({ h1: [] }) // sin creds
      const { repo, created, updated } = makeTrackingRepo()
      const fetcher = mock(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })) as any as TrackingFetcher
      const result = await fireMetaConversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('skipped')
      expect(fetcher).not.toHaveBeenCalled()
      // Persistió 1 row (pending inicial) + 1 update (skipped).
      expect(created.length).toBe(1)
      expect(created[0].target).toBe('meta')
      expect(updated.length).toBe(1)
      expect(updated[0].patch.status).toBe('skipped')
    })

    it('con creds + opt-in → fire con hashes em y ph (Enhanced Conversions verificado)', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: 'PIXEL1' },
          { key: 'meta_capi_token', value: 'TOKEN1' },
        ],
      })
      const { repo, created, updated } = makeTrackingRepo()
      let capturedUrl = ''
      let capturedBody: any
      const fetcher: TrackingFetcher = async (url, init) => {
        capturedUrl = url
        capturedBody = JSON.parse(init.body)
        return { ok: true, status: 200, json: async () => ({ events_received: 1 }), text: async () => '' }
      }
      const result = await fireMetaConversion(data, repo, { configRepo, fetcher }, log)

      expect(result.status).toBe('sent')
      // URL apunta al endpoint Graph API con pixel_id + access_token.
      expect(capturedUrl).toContain('graph.facebook.com/v18.0/PIXEL1/events')
      expect(capturedUrl).toContain('access_token=TOKEN1')
      // Payload lleva los hashes em/ph esperados (no PII en claro).
      const event = capturedBody.data[0]
      expect(event.user_data.em[0]).toMatch(/^[0-9a-f]{64}$/)
      expect(event.user_data.ph[0]).toMatch(/^[0-9a-f]{64}$/)
      // Hashes correctos: em = sha256(normalizeEmail('Juan.Perez@Example.com')) y
      // ph = sha256(normalizePhone('+1 809 555 0000')). Verificado en enhanced-conversions.test.ts
      // con los mismos vectores del spec.md scenario "Hash correcto".
      // 2 filas: pending created + status updated.
      expect(created.length).toBe(1)
      expect(updated.length).toBe(1)
      expect(updated[0].patch.status).toBe('sent')
    })

    it('HTTP falla (500) → status=failed, errorMessage con código', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: 'PIXEL1' },
          { key: 'meta_capi_token', value: 'TOKEN1' },
        ],
      })
      const { repo, updated } = makeTrackingRepo()
      const fetcher: TrackingFetcher = async () => ({
        ok: false, status: 500, json: async () => ({ error: 'OAuthException' }), text: async () => '',
      })
      const result = await fireMetaConversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('failed')
      expect(result.errorMessage).toContain('Meta API 500')
      expect(updated[0].patch.status).toBe('failed')
    })

    it('excepción de red → status=failed, NO propaga', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: 'PIXEL1' },
          { key: 'meta_capi_token', value: 'TOKEN1' },
        ],
      })
      const { repo, updated } = makeTrackingRepo()
      const fetcher: TrackingFetcher = async () => { throw new Error('ECONNRESET') }
      const result = await fireMetaConversion(data, repo, { configRepo, fetcher }, log)
      expect(result.status).toBe('failed')
      expect(result.errorMessage).toContain('ECONNRESET')
      expect(updated[0].patch.status).toBe('failed')
    })

    it('test_event_code se propaga al body si está en configuration', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: 'PIXEL1' },
          { key: 'meta_capi_token', value: 'TOKEN1' },
          { key: 'meta_test_event_code', value: 'TESTABC' },
        ],
      })
      const { repo } = makeTrackingRepo()
      let capturedBody: any
      const fetcher: TrackingFetcher = async (_url, init) => {
        capturedBody = JSON.parse(init.body)
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      }
      await fireMetaConversion(data, repo, { configRepo, fetcher }, log)
      expect(capturedBody.test_event_code).toBe('TESTABC')
    })

    it('sin opt-in → user_data va vacío (sin hashes)', async () => {
      const configRepo = makeConfigRepo({
        h1: [
          { key: 'meta_pixel_id', value: 'PIXEL1' },
          { key: 'meta_capi_token', value: 'TOKEN1' },
        ],
      })
      const { repo } = makeTrackingRepo()
      let capturedBody: any
      const fetcher: TrackingFetcher = async (_url, init) => {
        capturedBody = JSON.parse(init.body)
        return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
      }
      const noOpt: ReservationTrackingData = { ...data, marketingAccepted: false }
      await fireMetaConversion(noOpt, repo, { configRepo, fetcher }, log)
      expect(capturedBody.data[0].user_data).toEqual({})
    })
  })
})
