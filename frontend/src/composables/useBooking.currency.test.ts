// useBooking.currency.test.ts — La moneda que se MUESTRA es la que el backend efectivamente
// devolvió, no la que el usuario pidió.
//
// El backend convierte con `configuration('currency_rates')` y, cuando no tiene tasa para la
// moneda pedida, degrada: cotiza en su moneda base y lo declara en `currency`. Antes el store
// hacía `currencyPreference || ratesResponse.currency`, así que la preferencia pisaba esa
// respuesta: se pedía EUR, el backend contestaba precios en USD, y el widget los rotulaba
// "€80.00". El huésped veía un precio en una moneda que nadie convirtió y Stripe le cobraba en
// `chargeCurrency`. Reproducido en local contra la API real con ?currency=EUR y ?currency=DOP.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useBookingStore } from './useBooking'
import { BookingService } from '@/services/Booking.service'
import type { PublicRatesResponse } from '@/types'

vi.mock('@/services/Booking.service', () => ({
  BookingService: { getRates: vi.fn(), getUpsells: vi.fn().mockResolvedValue([]) },
}))

/** El backend NO pudo convertir: devuelve su moneda base aunque se le haya pedido otra. */
function ratesIn(currency: string): PublicRatesResponse {
  return {
    roomTypes: [{
      id: 'double', name: 'double', fromPrice: 240, availableCount: 3, capacity: 2,
      surfaceArea: 20, taxBreakdown: [], photoUrl: null,
    }],
    currency,
    chargeCurrency: 'USD',
    nights: 3,
    taxes: [],
    checkIn: '2026-08-10',
    checkOut: '2026-08-13',
  } as unknown as PublicRatesResponse
}

describe('useBooking — moneda de display', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('si el backend no convirtió, muestra SU moneda, no la elegida', async () => {
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesIn('USD'))
    const store = useBookingStore()
    store.currencyPreference = 'EUR'
    store.init('demo', { checkIn: '2026-08-10', checkOut: '2026-08-13' })
    await store.search()

    expect(store.displayCurrency).toBe('USD')
    expect(store.currencyUnavailable).toBe(true)
  })

  it('si el backend sí convirtió, muestra la moneda elegida y no avisa nada', async () => {
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesIn('EUR'))
    const store = useBookingStore()
    store.currencyPreference = 'EUR'
    store.init('demo', { checkIn: '2026-08-10', checkOut: '2026-08-13' })
    await store.search()

    expect(store.displayCurrency).toBe('EUR')
    expect(store.currencyUnavailable).toBe(false)
  })

  it('sin preferencia (auto) nunca avisa, aunque haya respuesta', async () => {
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesIn('USD'))
    const store = useBookingStore()
    store.init('demo', { checkIn: '2026-08-10', checkOut: '2026-08-13' })
    await store.search()

    expect(store.displayCurrency).toBe('USD')
    expect(store.currencyUnavailable).toBe(false)
  })
})
