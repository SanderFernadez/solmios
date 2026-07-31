// bookingengine/tests/public-ota-prices.test.ts — Tests del comparativo OTA (F3 3.15).
//
// Cubre acceptance del task:
//   • directo < OTA → {showComparison: true, savings}
//   • directo > OTA → {showComparison: false} (NO revelar tarifa OTA)
//   • directo == OTA → {showComparison: false} (igual no cuenta como "ahorrás")
//   • StayAPI no configurado → {showComparison: false} (graceful)
//   • StayAPI falla → {showComparison: false} (graceful)
//   • hotel no existe / no activo → 404 plano (anti-enumeración)
//   • currency conversion OTA → hotel currency
//   • sin disponibilidad directa → {showComparison: false}
//
// Sin DB real: repos mock + fetcher StayAPI inyectable.
import { describe, it, expect } from 'bun:test'
import type { RepositoryAdapter } from 'arckode-framework'
import { silentLogger } from 'arckode-framework/testing'
import { getPublicOtaPrices, __test__ } from '../usecases/public-ota-prices'
import type { StayApiPricesFetcher } from '../../../connectors/stayapi-ota-prices'

const log = silentLogger()

function makeHotelsRepo(hotel: any): RepositoryAdapter<any> {
  return {
    findOne: async () => hotel,
    findMany: async () => (hotel ? [hotel] : []),
    findById: async () => hotel,
    create: async () => ({}), update: async () => ({}), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

function makeConfigRepo(map: Record<string, any[]>): RepositoryAdapter<any> {
  // map: { 'h1': [{key:'stayapi_api_key', value:...}] } — findMany({hotelId}) devuelve por key
  return {
    findMany: async (q: any) => {
      const hotelId = q?.hotelId
      return map[hotelId] ?? []
    },
    findById: async () => null, findOne: async () => null,
    create: async () => ({}), update: async () => ({}), delete: async () => true,
    count: async () => 0, paginate: async () => ({ data: [], total: 0, limit: 20, offset: 0, pages: 0 }),
  }
}

function makeAvailability(roomTypes: any[]) {
  return {
    checkAvailability: async () => ({
      hotelId: 'h1', hotelName: 'test', checkIn: '2026-08-01', checkOut: '2026-08-04', nights: 3,
      roomTypes, available: roomTypes.length > 0,
    }),
  }
}

const HOTEL = { id: 'h1', slug: 'hotel-a', currency: 'USD', onlineBookingStatus: 'active' }

const QUERY = { checkIn: '2026-08-01', checkOut: '2026-08-04' } // 3 noches

describe('getPublicOtaPrices — acceptance del task 3.15', () => {
  it('directo < OTA → showComparison: true con savings', async () => {
    // Directo: 100/noche × 3 = 300. OTA más barata: 120/noche × 3 = 360.
    // Ahorro: 60 USD.
    const directRoom = [{ roomType: 'std', price: 100, available: 5 }]
    const fetcher: StayApiPricesFetcher = async (ota) => ({
      data: { total: ota === 'booking' ? 360 : 380, currency: 'USD' },
    })
    const config = makeConfigRepo({
      h1: [
        { key: 'stayapi_api_key', value: 'k' },
        { key: 'stayapi_hotel_ids', value: { booking: 'b1', airbnb: 'a1' } },
      ],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect(res.status).toBe(200)
    expect((res.body as any).showComparison).toBe(true)
    expect((res.body as any).savings).toBe(60)
    expect((res.body as any).currency).toBe('USD')
    expect((res.body as any).vsSource).toBe('booking')
  })

  it('directo > OTA → showComparison: false (NO revelar tarifa OTA)', async () => {
    // Directo: 150/noche × 3 = 450. OTA: 100/noche × 3 = 300 (más barata).
    const directRoom = [{ roomType: 'std', price: 150, available: 5 }]
    const fetcher: StayApiPricesFetcher = async () => ({ data: { total: 300, currency: 'USD' } })
    const config = makeConfigRepo({
      h1: [
        { key: 'stayapi_api_key', value: 'k' },
        { key: 'stayapi_hotel_ids', value: { booking: 'b1' } },
      ],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect(res.status).toBe(200)
    const body = res.body as any
    expect(body.showComparison).toBe(false)
    expect(body.savings).toBeNull()
    // CRÍTICO: no filtrar el precio OTA en la respuesta (anti-promoción).
    expect(body.otaPrice).toBeUndefined()
  })

  it('directo == OTA → showComparison: false (igual no es "ahorrás")', async () => {
    const directRoom = [{ roomType: 'std', price: 100, available: 5 }] // 300 total
    const fetcher: StayApiPricesFetcher = async () => ({ data: { total: 300, currency: 'USD' } })
    const config = makeConfigRepo({
      h1: [
        { key: 'stayapi_api_key', value: 'k' },
        { key: 'stayapi_hotel_ids', value: { booking: 'b1' } },
      ],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(false)
  })

  it('StayAPI no configurado → showComparison: false (graceful)', async () => {
    const directRoom = [{ roomType: 'std', price: 100, available: 5 }]
    let fetcherCalls = 0
    const fetcher: StayApiPricesFetcher = async () => { fetcherCalls++; return { data: undefined } }
    // Sin creds en configuration
    const config = makeConfigRepo({ h1: [] })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(false)
    expect(fetcherCalls).toBe(0) // ni siquiera llamó a StayAPI
  })

  it('StayAPI falla (todas las OTAs) → showComparison: false', async () => {
    const directRoom = [{ roomType: 'std', price: 100, available: 5 }]
    const fetcher: StayApiPricesFetcher = async () => { throw new Error('StayAPI down') }
    const config = makeConfigRepo({
      h1: [
        { key: 'stayapi_api_key', value: 'k' },
        { key: 'stayapi_hotel_ids', value: { booking: 'b1', airbnb: 'a1' } },
      ],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(false)
  })

  it('hotel no existe → 404 plano (anti-enumeración)', async () => {
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(null), availability: makeAvailability([]), config: makeConfigRepo({}) },
      'no-existe', QUERY,
    )
    expect(res.status).toBe(404)
    expect((res.body as any).error).toBe('Hotel not found')
  })

  it('hotel pausado (onlineBookingStatus != active) → 404 mismo mensaje', async () => {
    const paused = { ...HOTEL, onlineBookingStatus: 'paused' }
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(paused), availability: makeAvailability([]), config: makeConfigRepo({}) },
      'hotel-a', QUERY,
    )
    expect(res.status).toBe(404)
    expect((res.body as any).error).toBe('Hotel not found')
  })

  it('sin checkIn/checkOut → 400', async () => {
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability([]), config: makeConfigRepo({}) },
      'hotel-a', { checkIn: '', checkOut: '' },
    )
    expect(res.status).toBe(400)
  })

  it('sin disponibilidad directa → showComparison: false', async () => {
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability([]), config: makeConfigRepo({ h1: [{ key: 'stayapi_api_key', value: 'k' }, { key: 'stayapi_hotel_ids', value: { booking: 'b1' } }] }) },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(false)
  })

  it('convierte currency OTA → currency del hotel', async () => {
    // Hotel en EUR, OTA en USD. Directo: 100 EUR × 3 = 300 EUR. OTA: 360 USD → ~331 EUR.
    // Ahorro esperado: ~31 EUR (depende del rate).
    const hotelEUR = { ...HOTEL, currency: 'EUR' }
    const directRoom = [{ roomType: 'std', price: 100, available: 5 }]
    const fetcher: StayApiPricesFetcher = async () => ({ data: { total: 360, currency: 'USD' } })
    const rates = { base: 'USD', rates: { USD: 1, EUR: 0.92 } }
    const config = makeConfigRepo({
      h1: [
        { key: 'stayapi_api_key', value: 'k' },
        { key: 'stayapi_hotel_ids', value: { booking: 'b1' } },
      ],
      platform: [{ key: 'currency_rates', value: rates }],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(hotelEUR), availability: makeAvailability(directRoom), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(true)
    expect((res.body as any).currency).toBe('EUR')
    // 360 USD × 0.92 = 331.2 EUR - 300 EUR directo = 31.2 EUR de ahorro
    expect((res.body as any).savings).toBeCloseTo(31.2, 1)
  })
})

describe('computeDirectPrice + convertAmount (helpers)', () => {
  it('computeDirectPrice devuelve el más bajo × noches', async () => {
    const availability = { roomTypes: [{ price: 120 }, { price: 80 }, { price: 200 }] } as any
    const total = await __test__.computeDirectPrice(availability, 3)
    expect(total).toBe(240) // 80 × 3
  })

  it('computeDirectPrice en 0 sin roomTypes', async () => {
    const total = await __test__.computeDirectPrice({ roomTypes: [] } as any, 3)
    expect(total).toBe(0)
  })

  it('convertAmount sin rates → devuelve el monto original', () => {
    expect(__test__.convertAmount(100, 'USD', 'EUR', null)).toBe(100)
  })

  it('convertAmount con rates base-USD convierte correctamente', () => {
    const rates = { USD: 1, EUR: 0.92 }
    // 100 USD → 92 EUR
    expect(__test__.convertAmount(100, 'USD', 'EUR', rates)).toBe(92)
  })

  it('convertAmount miss de rate → devuelve original (degradación graceful)', () => {
    const rates = { USD: 1 }
    expect(__test__.convertAmount(100, 'EUR', 'USD', rates)).toBe(100) // sin rate EUR, no convierte
  })

  it('PRICE_EPSILON > 0', () => {
    expect(__test__.PRICE_EPSILON).toBeGreaterThan(0)
  })
})

// ─── FIX 2026-07-31 — el toggle "Comparar con OTAs" del admin deja de ser decorativo ───
describe('getPublicOtaPrices — bookingConfig.showComparison', () => {
  it('showComparison=false en bookingConfig → apaga SIN llamar a StayAPI (ahorra la request externa)', async () => {
    let fetcherCalled = false
    const fetcher: StayApiPricesFetcher = async () => { fetcherCalled = true; return { data: { total: 300, currency: 'USD' } } }
    const config = makeConfigRepo({
      h1: [{ key: 'stayapi_api_key', value: 'k' }, { key: 'stayapi_hotel_ids', value: { booking: 'b1' } }],
    })
    const bookingConfig = { findOne: async () => ({ hotelId: 'h1', showComparison: false }) }
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability([{ roomType: 'std', price: 100, available: 5 }]), config, otaFetcher: fetcher, bookingConfig: bookingConfig as any },
      'hotel-a', QUERY,
    )
    expect(res.status).toBe(200)
    expect((res.body as any).showComparison).toBe(false)
    expect(fetcherCalled).toBe(false)
  })

  it('showComparison=true en bookingConfig → compara normal', async () => {
    const fetcher: StayApiPricesFetcher = async () => ({ data: { total: 360, currency: 'USD' } })
    const config = makeConfigRepo({
      h1: [{ key: 'stayapi_api_key', value: 'k' }, { key: 'stayapi_hotel_ids', value: { booking: 'b1' } }],
    })
    const bookingConfig = { findOne: async () => ({ hotelId: 'h1', showComparison: true }) }
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability([{ roomType: 'std', price: 100, available: 5 }]), config, otaFetcher: fetcher, bookingConfig: bookingConfig as any },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(true)
  })

  it('sin bookingConfig cableado (compat callers viejos) → compara normal', async () => {
    const fetcher: StayApiPricesFetcher = async () => ({ data: { total: 360, currency: 'USD' } })
    const config = makeConfigRepo({
      h1: [{ key: 'stayapi_api_key', value: 'k' }, { key: 'stayapi_hotel_ids', value: { booking: 'b1' } }],
    })
    const res = await getPublicOtaPrices(
      { hotels: makeHotelsRepo(HOTEL), availability: makeAvailability([{ roomType: 'std', price: 100, available: 5 }]), config, otaFetcher: fetcher },
      'hotel-a', QUERY,
    )
    expect((res.body as any).showComparison).toBe(true)
  })
})
