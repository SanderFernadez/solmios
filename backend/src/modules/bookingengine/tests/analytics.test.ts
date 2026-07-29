// bookingengine/tests/analytics.test.ts — Tests del funnel F4 4.1 (D13).
// Cubre:
//   - getAnalytics devuelve funnel con 7 steps en orden canónico.
//   - dropOff calculado correctamente entre steps consecutivos.
//   - Sin trackingRepo (legacy tests), el funnel devuelve 0 en todos los steps (no crashea).
//   - dual-write en track(): además de conversion_events, persiste tracking_events con
//     target='internal'.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { AnalyticsUseCase } from '../usecases/analytics'
import type { ConversionEventDTO, CreateConversionEventDTO } from '../types'

interface CaptureResult {
  eventsCreated: ConversionEventDTO[]
  trackingCreated: any[]
}

function makeCapturingRepos(): { events: RepositoryAdapter<ConversionEventDTO>; tracking: RepositoryAdapter<any>; capture: CaptureResult } {
  const capture: CaptureResult = { eventsCreated: [], trackingCreated: [] }
  const events: RepositoryAdapter<ConversionEventDTO> = {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => {
      const saved = { id: `ev-${capture.eventsCreated.length + 1}`, ...data } as ConversionEventDTO
      capture.eventsCreated.push(saved)
      return saved
    },
    update: async () => ({} as ConversionEventDTO),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
  const tracking: RepositoryAdapter<any> = {
    findMany: async () => [],
    findById: async () => null,
    findOne: async () => null,
    create: async (data) => {
      capture.trackingCreated.push(data)
      return { id: `tr-${capture.trackingCreated.length}`, ...data }
    },
    update: async () => ({}),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
  return { events, tracking, capture }
}

/** Repo que devuelve filas de tracking_events ya persistidas (simula reads del funnel). */
function trackingRepoWithRows(rows: Array<{ event: string; createdAt?: string }>): RepositoryAdapter<any> {
  return {
    findMany: async () => rows,
    findById: async () => null,
    findOne: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => true,
    count: async () => 0,
    paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

const eventsEmptyRepo: RepositoryAdapter<ConversionEventDTO> = {
  findMany: async () => [],
  findById: async () => null,
  findOne: async () => null,
  create: async (data) => ({ id: 'ev-1', ...data } as ConversionEventDTO),
  update: async () => ({} as ConversionEventDTO),
  delete: async () => true,
  count: async () => 0,
  paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
}

describe('AnalyticsUseCase — Funnel (F4 4.1)', () => {
  it('devuelve funnel con 7 steps en orden canónico y sin trackingRepo (legacy)', async () => {
    const uc = new AnalyticsUseCase(eventsEmptyRepo)
    const result = await uc.getAnalytics('hotel-1')
    expect(result.funnel).toHaveLength(7)
    const steps = result.funnel.map((s) => s.step)
    expect(steps).toEqual(['view', 'search', 'select', 'upsell', 'form', 'pay', 'confirm'])
    // Sin datos, todos los counts son 0 y los dropOffs también (excepto el último = null).
    expect(result.funnel.every((s, i) => (i === 6 ? s.dropOff === null : s.dropOff === 0))).toBe(true)
    expect(result.funnel.every((s) => s.count === 0)).toBe(true)
  })

  it('cuenta events por step y calcula dropOff entre consecutivos', async () => {
    // Simula un funnel real: 100 views → 60 search → 40 select → 30 upsell → 25 form → 20 pay → 18 confirm
    const rows: Array<{ event: string }> = []
    for (let i = 0; i < 100; i++) rows.push({ event: 'view' })
    for (let i = 0; i < 60; i++) rows.push({ event: 'search' })
    for (let i = 0; i < 40; i++) rows.push({ event: 'select' })
    for (let i = 0; i < 30; i++) rows.push({ event: 'upsell' })
    for (let i = 0; i < 25; i++) rows.push({ event: 'form' })
    for (let i = 0; i < 20; i++) rows.push({ event: 'pay' })
    for (let i = 0; i < 18; i++) rows.push({ event: 'confirm' })

    const uc = new AnalyticsUseCase(eventsEmptyRepo, trackingRepoWithRows(rows))
    const result = await uc.getAnalytics('hotel-1')

    const expected = [
      { step: 'view', count: 100, dropOff: 60 },     // 60/100 = 60%
      { step: 'search', count: 60, dropOff: 67 },    // 40/60 = 66.67% → round 67
      { step: 'select', count: 40, dropOff: 75 },    // 30/40 = 75%
      { step: 'upsell', count: 30, dropOff: 83 },    // 25/30 = 83.33% → round 83
      { step: 'form', count: 25, dropOff: 80 },      // 20/25 = 80%
      { step: 'pay', count: 20, dropOff: 90 },       // 18/20 = 90%
      { step: 'confirm', count: 18, dropOff: null }, // último step
    ]
    expect(result.funnel.map((s) => ({ step: s.step, count: s.count, dropOff: s.dropOff }))).toEqual(expected)
  })

  it('dropOff = 0 cuando el step actual tiene count=0 (no hay tráfico para medir conversión)', async () => {
    // 10 views pero 0 search → dropOff(view) debería ser 0, no NaN.
    const rows: Array<{ event: string }> = []
    for (let i = 0; i < 10; i++) rows.push({ event: 'view' })

    const uc = new AnalyticsUseCase(eventsEmptyRepo, trackingRepoWithRows(rows))
    const result = await uc.getAnalytics('hotel-1')

    expect(result.funnel[0]!.count).toBe(10)
    expect(result.funnel[0]!.dropOff).toBe(0) // sin search → 0% conversión
    expect(result.funnel[1]!.count).toBe(0)
    expect(result.funnel[1]!.dropOff).toBe(0) // sin propio tráfico → 0
  })

  it('track() hace dual-write: persiste en conversion_events Y tracking_events con target=internal', async () => {
    const { events, tracking, capture } = makeCapturingRepos()
    const uc = new AnalyticsUseCase(events, tracking)

    const dto: CreateConversionEventDTO = {
      hotelId: 'hotel-1',
      sessionId: 'sess-1',
      event: 'view',
      roomType: 'double',
      amount: 100,
    }
    await uc.track(dto)

    // conversion_events
    expect(capture.eventsCreated).toHaveLength(1)
    expect(capture.eventsCreated[0]!.event).toBe('view')

    // tracking_events (dual-write)
    expect(capture.trackingCreated).toHaveLength(1)
    const t = capture.trackingCreated[0]!
    expect(t.hotelId).toBe('hotel-1')
    expect(t.event).toBe('view')
    expect(t.target).toBe('internal')
    expect(t.status).toBe('sent')
    expect(t.meta.sessionId).toBe('sess-1')
    expect(t.meta.roomType).toBe('double')
    expect(t.meta.amount).toBe(100)
    expect(typeof t.timestamp).toBe('string')
  })

  it('track() NO crashea si el trackingRepo falla (best-effort: el evento ya quedó en conversion_events)', async () => {
    const failingTracking: RepositoryAdapter<any> = {
      findMany: async () => [],
      findById: async () => null,
      findOne: async () => null,
      create: async () => { throw new Error('ORM explode') },
      update: async () => ({}),
      delete: async () => true,
      count: async () => 0,
      paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
    }
    const uc = new AnalyticsUseCase(eventsEmptyRepo, failingTracking)

    // Debería resolver sin lanzar — el fallo del dual-write es silencioso.
    const result = await uc.track({ hotelId: 'h1', sessionId: 's1', event: 'view' })
    expect(result.event).toBe('view')
  })
})
