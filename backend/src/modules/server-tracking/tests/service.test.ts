// server-tracking/tests/service.test.ts — F3 3.11/3.12 facade del módulo (ServerTrackingService).
//
// Cubre el acceptance 3.12: "confirmar reserva con creds configuradas → 2 events fire +
// persisten en tracking_events". Y la orquestación paralela (Promise.allSettled) con
// tolerancia a fallos: si Meta cae, GA4 igual dispara, y viceversa.
//
// Sin tocar la red: fetchers mockeados. Sin DB: repos in-memory.
import { describe, it, expect, mock } from 'bun:test'
import { silentLogger } from 'arckode-framework/testing'
import type { CacheAdapter } from 'arckode-framework'
import { ServerTrackingService } from '../service'
import type { TrackingFetcher } from '../types'

const log = silentLogger()
const silentCache: CacheAdapter = {
  get: async () => null, set: async () => {}, delete: async () => {}, flush: async () => {},
}

const reservation = {
  id: 'rsv-1', hotelId: 'h1', roomId: 'room-1', totalAmount: 100, currency: 'USD',
  marketingAccepted: true, guestId: 'g1',
}
const guest = { id: 'g1', email: 'test@example.com', phone: '+1 555 0100' }

function makeReservationsRepo(reservationRow: any = reservation) {
  return {
    findOne: async (filters: any) => (filters?.id === reservationRow.id ? reservationRow : null),
    findById: async () => reservationRow, findMany: async () => [reservationRow],
    create: async () => ({} as any), update: async () => ({} as any), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}
function makeGuestsRepo(guestRow: any = guest) {
  return {
    findOne: async (filters: any) => (filters?.id === guestRow.id ? guestRow : null),
    findById: async () => guestRow, findMany: async () => [guestRow],
    create: async () => ({} as any), update: async () => ({} as any), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  } as any
}
function makeConfigRepo(configsByHotel: Record<string, any[]> = {}) {
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

describe('F3 3.12 — ServerTrackingService.fireAll (orquestación)', () => {
  it('reserva existe + creds completas → 2 fires (Meta + GA4) persisten con status=sent', async () => {
    const configRepo = makeConfigRepo({
      h1: [
        { key: 'meta_pixel_id', value: 'PX1' }, { key: 'meta_capi_token', value: 'TK1' },
        { key: 'ga4_measurement_id', value: 'G-1' }, { key: 'ga4_api_secret', value: 'S1' },
      ],
    })
    const { repo, created, updated } = makeTrackingRepo()
    const fetcher: TrackingFetcher = async () => ({ ok: true, status: 204, json: async () => ({}), text: async () => '' })
    const service = new ServerTrackingService(repo, log, silentCache, {
      reservationsRepo: makeReservationsRepo(),
      guestsRepo: makeGuestsRepo(),
      configRepo,
      fetcher,
    })

    const result = await service.fireAll('rsv-1')

    expect(result.data).not.toBeNull()
    expect(result.meta.status).toBe('sent')
    expect(result.ga4.status).toBe('sent')
    // 2 filas persistidas (1 por target — Meta y GA4).
    expect(created.length).toBe(2)
    const targets = created.map((c) => c.target).sort()
    expect(targets).toEqual(['ga4', 'meta'])
    // 2 updates (cada fila updated a sent).
    expect(updated.length).toBe(2)
    expect(updated.every((u) => u.patch.status === 'sent')).toBe(true)
  })

  it('si Meta cae (HTTP 500) pero GA4 OK → result.meta=failed, result.ga4=sent', async () => {
    const configRepo = makeConfigRepo({
      h1: [
        { key: 'meta_pixel_id', value: 'PX1' }, { key: 'meta_capi_token', value: 'TK1' },
        { key: 'ga4_measurement_id', value: 'G-1' }, { key: 'ga4_api_secret', value: 'S1' },
      ],
    })
    const { repo } = makeTrackingRepo()
    // Promise.allSettled NO garantiza orden de ejecución entre Meta y GA4. Distinguimos
    // por URL: Meta cae al endpoint graph.facebook.com, GA4 a google-analytics.com.
    const fetcher: TrackingFetcher = async (url) => {
      if (url.includes('graph.facebook.com')) {
        return { ok: false, status: 500, json: async () => ({ error: 'meta down' }), text: async () => '' }
      }
      return { ok: true, status: 204, json: async () => ({}), text: async () => '' }
    }
    const service = new ServerTrackingService(repo, log, silentCache, {
      reservationsRepo: makeReservationsRepo(),
      guestsRepo: makeGuestsRepo(),
      configRepo,
      fetcher,
    })
    const result = await service.fireAll('rsv-1')
    expect(result.meta.status).toBe('failed')
    expect(result.ga4.status).toBe('sent')
  })

  it('sin creds de ningún externo → ambos status=skipped, NO llama fetch', async () => {
    const configRepo = makeConfigRepo({ h1: [] })
    const { repo, created } = makeTrackingRepo()
    const fetcher = mock(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })) as any as TrackingFetcher
    const service = new ServerTrackingService(repo, log, silentCache, {
      reservationsRepo: makeReservationsRepo(),
      guestsRepo: makeGuestsRepo(),
      configRepo,
      fetcher,
    })
    const result = await service.fireAll('rsv-1')
    expect(result.meta.status).toBe('skipped')
    expect(result.ga4.status).toBe('skipped')
    expect(fetcher).not.toHaveBeenCalled()
    // Las filas se crearon (pending) pero se updatearon a skipped.
    expect(created.length).toBe(2)
  })

  it('reserva NO existe → data=null, no persiste nada', async () => {
    const configRepo = makeConfigRepo({ h1: [] })
    const { repo, created } = makeTrackingRepo()
    const service = new ServerTrackingService(repo, log, silentCache, {
      reservationsRepo: makeReservationsRepo({ ...reservation, id: 'other' }),
      guestsRepo: makeGuestsRepo(),
      configRepo,
      fetcher: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }),
    })
    const result = await service.fireAll('rsv-1')
    expect(result.data).toBeNull()
    expect(result.meta.status).toBe('skipped')
    expect(result.ga4.status).toBe('skipped')
    expect(created.length).toBe(0)
  })

  it('fireTest (sin reservationId) → arma payload sintético con reservationId test-*', async () => {
    const configRepo = makeConfigRepo({
      h1: [
        { key: 'meta_pixel_id', value: 'PX1' }, { key: 'meta_capi_token', value: 'TK1' },
        { key: 'ga4_measurement_id', value: 'G-1' }, { key: 'ga4_api_secret', value: 'S1' },
      ],
    })
    const { repo } = makeTrackingRepo()
    const fetcher: TrackingFetcher = async () => ({ ok: true, status: 204, json: async () => ({}), text: async () => '' })
    const service = new ServerTrackingService(repo, log, silentCache, {
      reservationsRepo: makeReservationsRepo(),
      guestsRepo: makeGuestsRepo(),
      configRepo,
      fetcher,
    })
    const result = await service.fireTest('h1')
    expect(result.meta.status).toBe('sent')
    expect(result.ga4.status).toBe('sent')
  })

  it('listEvents filtra por hotelId del caller (multi-tenant)', async () => {
    const configRepo = makeConfigRepo({ h1: [] })
    const events = [
      { id: 'e1', hotelId: 'h1', event: 'confirm', target: 'meta', status: 'sent', timestamp: '2026-07-01' },
      { id: 'e2', hotelId: 'h2', event: 'confirm', target: 'ga4', status: 'sent', timestamp: '2026-07-01' },
    ]
    const trackingRepo = {
      ...makeTrackingRepo().repo,
      paginate: mock(async (filters: any) => ({
        data: events.filter((e) => e.hotelId === filters.hotelId), total: 1, limit: 50, offset: 0, pages: 1,
      })),
    } as any
    const service = new ServerTrackingService(trackingRepo, log, silentCache, {
      reservationsRepo: makeReservationsRepo(), guestsRepo: makeGuestsRepo(), configRepo,
      fetcher: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }),
    })
    const result = await service.listEvents({}, 'h1')
    expect(result.length).toBe(1)
    expect(result[0].hotelId).toBe('h1')
  })
})
