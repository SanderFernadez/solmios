// bookingengine/tests/public-rates.test.ts — F2 2.4 (spec booking-widget).
//
// Cubre el endpoint GET /api/public/hotels/:slug/rates a nivel usecase (controller es delgado).
//
// Aceptancia (tasks.md 2.4):
//  - respuesta incluye roomTypes con fromPrice + availableCount + taxBreakdown.
//  - taxBreakdown se computa sobre fromPrice con la tasa de configuration('taxes').
//  - currency: cuando ?currency=X y hay rates guardadas, convierte desde hotels.currency.
//
// Casos:
//  (1) Happy path — 1 room type, 2 noches, ITBIS 18% desde configuration('taxes').
//  (2) fromPrice = price × nights (TOTAL de la estadía, no por noche).
//  (3) taxBreakdown trae name/rate/amount correcto.
//  (4) availableCount viene del availability.check (D11 urgencia).
//  (5) Hotel inexistente/pausado → 404 (anti-enumeración).
//  (6) checkIn faltante → 400; checkOut <= checkIn → 400.
//  (7) Conversión de moneda: hotel DOP, ?currency=USD, rates guardadas → convierte.
//  (8) Sin rates guardadas → degrada a hotels.currency (display=charge=base).
//  (9) Sin configuration('taxes') → fallback a hotels.taxRate / hotels.taxName.
import { describe, it, expect } from 'bun:test'
import { getPublicRates } from '../usecases/public-rates'
import type { AvailabilityResult } from '../types'

const makeAvailability = (roomTypes: any[]): { checkAvailability: () => Promise<AvailabilityResult> } => ({
  checkAvailability: async () => ({
    hotelId: 'h1', hotelName: 'Test', checkIn: '2026-08-10', checkOut: '2026-08-12', nights: 2, roomTypes,
  }),
})

const makeConfig = (rows: Record<string, any[]>) => ({
  findMany: async (_filters: any) => {
    // Match por key (ignoramos hotelId — los tests lo controlan vía este helper).
    const key = _filters?.key
    return rows[key] ?? []
  },
})

const makeHotels = (hotel: any) => ({
  findOne: async () => hotel,
})

const baseHotel = (overrides: Partial<any> = {}): any => ({
  id: 'h1', name: 'Caribe Paradise', slug: 'caribe-paradise',
  onlineBookingStatus: 'active', currency: 'USD',
  taxRate: 18, taxName: 'ITBIS',
  ...overrides,
})

/** Mock de `BookingConfig` — FIX 2026-07-31 (enabled/minNights/maxNights/cancellationPolicy
 *  dejan de ser decorativos). `null` = sin fila (comportamiento default: sin restricciones). */
const makeBookingConfig = (row: any | null) => ({ findOne: async () => row })

describe('getPublicRates — F2 2.4', () => {
  it('happy path: roomTypes con fromPrice + availableCount + taxBreakdown', async () => {
    const deps = {
      hotels: makeHotels(baseHotel()),
      availability: makeAvailability([
        { roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] },
      ]),
      config: makeConfig({ taxes: [{ value: [{ activo: true, tasa: 18, nombre: 'ITBIS' }] }] } as any),
    }
    // Hack: el helper devuelve array por key; configuration guarda {value: [...]} dentro de una row.
    // Reescribo el config para que devuelva la row completa con su `value`.
    deps.config = {
      findMany: async (f: any) => f?.key === 'taxes'
        ? [{ value: [{ activo: true, tasa: 18, nombre: 'ITBIS' }] }]
        : [],
    } as any

    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-12',
    })

    expect(res.status).toBe(200)
    const rt = res.body.roomTypes[0]
    expect(rt.id).toBe('standard')
    expect(rt.name).toBe('standard')
    // fromPrice = 100/noche × 2 noches = 200 (TOTAL, no por noche).
    expect(rt.fromPrice).toBe(200)
    expect(rt.availableCount).toBe(5)
    expect(rt.taxBreakdown).toEqual([{ name: 'ITBIS', rate: 18, amount: 36 }])
    expect(res.body.currency).toBe('USD')
    expect(res.body.taxes).toEqual([{ name: 'ITBIS', rate: 18 }])
    expect(res.body.chargeCurrency).toBe('USD')
    expect(res.body.nights).toBe(2)
  })

  it('fromPrice es TOTAL de la estadía (price × nights), no por noche', async () => {
    const deps = {
      hotels: makeHotels(baseHotel()),
      availability: makeAvailability([
        { roomType: 'suite', available: 2, price: 250, currency: 'USD', capacity: 4, amenities: [] },
      ]),
      config: { findMany: async () => [] } as any,
    }
    // 3 noches → 250 × 3 = 750.
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-13',
    })
    expect(res.body.roomTypes[0].fromPrice).toBe(750)
    expect(res.body.nights).toBe(3)
  })

  it('availableCount viene del availability.check (D11 urgencia)', async () => {
    const deps = {
      hotels: makeHotels(baseHotel()),
      availability: makeAvailability([
        { roomType: 'standard', available: 1, price: 100, currency: 'USD', capacity: 2, amenities: [] },
      ]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-12',
    })
    expect(res.body.roomTypes[0].availableCount).toBe(1)
  })

  it('hotel inexistente → 404', async () => {
    const deps = {
      hotels: { findOne: async () => null } as any,
      availability: makeAvailability([]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'no-existe', {
      checkIn: '2026-08-10', checkOut: '2026-08-12',
    })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Hotel not found')
  })

  it('hotel pausado (onlineBookingStatus!=active) → MISMO 404 (anti-enumeración)', async () => {
    const deps = {
      hotels: makeHotels(baseHotel({ onlineBookingStatus: 'paused' })),
      availability: makeAvailability([]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-12',
    })
    expect(res.status).toBe(404)
  })

  it('checkIn faltante → 400', async () => {
    const deps = {
      hotels: makeHotels(baseHotel()),
      availability: makeAvailability([]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '', checkOut: '2026-08-12',
    })
    expect(res.status).toBe(400)
  })

  it('checkOut <= checkIn → 400', async () => {
    const deps = {
      hotels: makeHotels(baseHotel()),
      availability: makeAvailability([]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-12', checkOut: '2026-08-12',
    })
    expect(res.status).toBe(400)
  })

  it('conversión de moneda: hotel DOP + ?currency=USD + rates → convierte', async () => {
    const deps = {
      hotels: makeHotels(baseHotel({ currency: 'DOP' })),
      availability: makeAvailability([
        { roomType: 'standard', available: 3, price: 5800, currency: 'DOP', capacity: 2, amenities: [] },
      ]),
      config: {
        findMany: async (f: any) => {
          if (f?.key === 'taxes') return [{ value: [{ activo: true, tasa: 18, nombre: 'ITBIS' }] }]
          if (f?.key === 'currency_rates') return [{
            value: { base: 'USD', rates: { USD: 1, EUR: 0.92, DOP: 58 } },
          }]
          return []
        },
      } as any,
    }
    // 1 noche: 5800 DOP. Convertir a USD: 5800 / 58 = 100 USD.
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-11', currency: 'USD',
    })
    expect(res.body.currency).toBe('USD')
    expect(res.body.chargeCurrency).toBe('DOP') // cobro siempre en base
    expect(res.body.roomTypes[0].fromPrice).toBe(100)
    // taxBreakdown.amount se computa sobre el fromPrice en DISPLAY currency (USD).
    expect(res.body.roomTypes[0].taxBreakdown[0].amount).toBe(18) // 18% de 100
  })

  it('sin rates guardadas → degrada a hotels.currency (display=base)', async () => {
    const deps = {
      hotels: makeHotels(baseHotel({ currency: 'EUR' })),
      availability: makeAvailability([
        { roomType: 'standard', available: 4, price: 100, currency: 'EUR', capacity: 2, amenities: [] },
      ]),
      config: { findMany: async () => [] } as any, // ni taxes ni currency_rates
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-12', currency: 'USD',
    })
    // No hay rates → display = base (EUR), sin conversión.
    expect(res.body.currency).toBe('EUR')
    expect(res.body.chargeCurrency).toBe('EUR')
    expect(res.body.roomTypes[0].fromPrice).toBe(200) // 100 × 2 noches
  })

  it('sin configuration(taxes) → fallback a hotels.taxRate / hotels.taxName', async () => {
    const deps = {
      hotels: makeHotels(baseHotel({ taxRate: 10, taxName: 'IVA' })),
      availability: makeAvailability([
        { roomType: 'standard', available: 3, price: 100, currency: 'USD', capacity: 2, amenities: [] },
      ]),
      config: { findMany: async () => [] } as any,
    }
    const res = await getPublicRates(deps as any, 'caribe-paradise', {
      checkIn: '2026-08-10', checkOut: '2026-08-12',
    })
    expect(res.body.taxes).toEqual([{ name: 'IVA', rate: 10 }])
    // 200 × 10% = 20.
    expect(res.body.roomTypes[0].taxBreakdown).toEqual([{ name: 'IVA', rate: 10, amount: 20 }])
  })

  // ─── FIX 2026-07-31 — booking_config deja de ser decorativo ────────────────────
  describe('bookingConfig (enabled/minNights/maxNights/cancellationPolicy)', () => {
    it('enabled=false → MISMO 404 anti-enumeración (toggle "Inactivo" del admin ahora sí apaga el motor)', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig({ hotelId: 'h1', enabled: false }),
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Hotel not found')
    })

    it('sin fila de bookingConfig (nunca tocó la pantalla) → NO bloquea, comportamiento default', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig(null),
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.status).toBe(200)
    })

    it('sin bookingConfig cableado (compat callers viejos) → NO bloquea', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.status).toBe(200)
    })

    it('estadía por debajo de minNights → 400 con mensaje claro', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig({ hotelId: 'h1', enabled: true, minNights: 3 }),
      }
      // 2 noches pedidas, mínimo 3.
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('mínima: 3')
    })

    it('estadía por encima de maxNights → 400 con mensaje claro', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig({ hotelId: 'h1', enabled: true, maxNights: 5 }),
      }
      // 3 noches (10→13), máximo 5 — OK. Probamos con un rango de 7 noches.
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-17' })
      expect(res.status).toBe(400)
      expect(res.body.error).toContain('máxima: 5')
    })

    it('estadía dentro de [minNights, maxNights] → 200 normal', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig({ hotelId: 'h1', enabled: true, minNights: 2, maxNights: 10 }),
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-13' })
      expect(res.status).toBe(200)
    })

    it('cancellationPolicy se expone en la respuesta (antes se guardaba y nunca se leía)', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
        bookingConfig: makeBookingConfig({ hotelId: 'h1', enabled: true, cancellationPolicy: 'Cancelación gratis hasta 48h antes' }),
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.body.cancellationPolicy).toBe('Cancelación gratis hasta 48h antes')
    })

    it('sin cancellationPolicy configurada → null (no revienta, no string vacío confuso)', async () => {
      const deps = {
        hotels: makeHotels(baseHotel()),
        availability: makeAvailability([{ roomType: 'standard', available: 5, price: 100, currency: 'USD', capacity: 2, amenities: [] }]),
        config: { findMany: async () => [] } as any,
      }
      const res = await getPublicRates(deps as any, 'caribe-paradise', { checkIn: '2026-08-10', checkOut: '2026-08-12' })
      expect(res.body.cancellationPolicy).toBeNull()
    })
  })
})
