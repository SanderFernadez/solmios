// RoomsStep.test.ts — La leyenda de impuestos del widget embebible.
//
// Bug que se protege: `fromPrice` viene PRE-impuestos (public-rates.ts devuelve el `taxBreakdown`
// aparte) y la tarjeta decía "Incluye 18% ITBIS" en los tres idiomas. Era una leyenda falsa — el
// huésped paga fromPrice + esos impuestos — y encima contradecía a la landing, que ya anuncia el
// impuesto como agregado. Una diferencia de precio descubierta en el paso de pago es la causa
// clásica de abandono del carrito.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/Booking.service', () => ({
  BookingService: { getRates: vi.fn(), getCalendar: vi.fn(), getUpsells: vi.fn() },
}))

import RoomsStep from './RoomsStep.vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore, type BookingLocale } from '@/composables/useBookingI18n'
import type { PublicRatesResponse } from '@/types/booking'

function ratesResponse(): PublicRatesResponse {
  return {
    currency: 'USD',
    chargeCurrency: 'USD',
    nights: 3,
    checkIn: '2026-08-18',
    checkOut: '2026-08-21',
    taxes: [{ name: 'ITBIS', rate: 18 }],
    cancellationPolicy: null,
    cancellationSummary: null,
    roomTypes: [
      {
        id: 'double',
        name: 'double',
        fromPrice: 300,
        availableCount: 5,
        capacity: 2,
        surfaceArea: 24,
        taxBreakdown: [{ name: 'ITBIS', rate: 18, amount: 54 }],
        photoUrl: null,
      },
    ],
  } as unknown as PublicRatesResponse
}

function render(locale: BookingLocale): VueWrapper {
  const store = useBookingStore()
  store.init('hotel-demo')
  store.ratesResponse = ratesResponse()
  useBookingI18nStore().setLocale(locale)
  return mount(RoomsStep)
}

describe('RoomsStep — leyenda de impuestos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Un caso por idioma: el texto viejo mentía en los TRES, así que arreglar solo el español
  // dejaba el bug vivo para la mitad de los huéspedes del widget.
  const cases: Array<{ locale: BookingLocale; mentira: RegExp; verdad: RegExp }> = [
    { locale: 'es', mentira: /Incluye/i, verdad: /\+\s*impuestos/i },
    { locale: 'en', mentira: /Includes/i, verdad: /\+\s*taxes/i },
    { locale: 'pt', mentira: /Inclui/i, verdad: /\+\s*impostos/i },
  ]

  for (const c of cases) {
    it(`[${c.locale}] anuncia el impuesto como AGREGADO, nunca como incluido`, () => {
      const w = render(c.locale)
      const text = w.text()

      expect(text).not.toMatch(c.mentira)
      expect(text).toMatch(c.verdad)
      // Y sigue detallando qué impuesto es y a qué tasa.
      expect(text).toContain('18% ITBIS')
      w.unmount()
    })
  }

  it('sin impuestos configurados no muestra ninguna leyenda', () => {
    const store = useBookingStore()
    store.init('hotel-demo')
    const res = ratesResponse()
    res.roomTypes[0].taxBreakdown = []
    store.ratesResponse = res
    useBookingI18nStore().setLocale('es')

    const w = mount(RoomsStep)
    expect(w.text()).not.toMatch(/\+\s*impuestos/i)
    w.unmount()
  })
})
