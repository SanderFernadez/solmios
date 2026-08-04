// CtaBlock.test.ts — Los dos destinos del CTA grande de la banda final.
//
// Dentro de la landing abre el modal de reserva en su PRIMER paso (a diferencia del hero, este
// CTA no lleva fechas ni habitación preseleccionada → `openBooking()` sin argumentos). Fuera de
// la landing —sin provider— se conserva el link al widget embebible `/book/:slug`.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import CtaBlock from './CtaBlock.vue'
import { LANDING_BOOKING_KEY } from '@/composables/useLandingBooking'
import type { LandingBlock, PublicHotelInfo } from '@/types'

const HOTEL = { id: 'h1', slug: 'hotel-demo', name: 'Hotel Demo', currency: 'USD' } as unknown as PublicHotelInfo
const BLOCK = { id: 'b1', type: 'cta', sortOrder: 1, active: true, config: {} } as unknown as LandingBlock

function render(openBooking?: ReturnType<typeof vi.fn>) {
  return mount(CtaBlock, {
    props: { block: BLOCK, hotel: HOTEL, media: null },
    global: {
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      ...(openBooking ? { provide: { [LANDING_BOOKING_KEY as symbol]: openBooking } } : {}),
    },
  })
}

describe('CtaBlock — CTA de reserva', () => {
  it('en la landing abre el modal en su primer paso (sin preselección)', async () => {
    const openBooking = vi.fn()
    const w = render(openBooking)

    const cta = w.get('button')
    expect(cta.text()).toContain('Reservar ahora')
    expect(w.findAll('a[href="/book/hotel-demo"]')).toHaveLength(0)

    await cta.trigger('click')
    expect(openBooking).toHaveBeenCalledTimes(1)
    // Sin argumentos: el modal arranca en su primer paso, no en habitaciones.
    expect(openBooking).toHaveBeenCalledWith()
  })

  it('sin la landing (widget embebible) conserva el link a /book/:slug', () => {
    const w = render()

    expect(w.findAll('button')).toHaveLength(0)
    const link = w.get('a[href]')
    expect(link.attributes('href')).toBe('/book/hotel-demo')
    expect(link.text()).toContain('Reservar ahora')
  })
})
