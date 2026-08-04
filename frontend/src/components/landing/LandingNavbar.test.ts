// LandingNavbar.test.ts — Los dos destinos del "Reservar ahora" de la barra superior.
//
// Dentro de la landing abre el modal de reserva en su PRIMER paso (la barra no conoce fechas ni
// habitación → `openBooking()` sin argumentos). Fuera de la landing —sin provider— se conserva el
// link al widget embebible `/book/:slug`. Los anchors de sección (#rooms, #galeria…) son `<a>` de
// scroll interno y no se tocan en ninguno de los dos caminos.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import LandingNavbar from './LandingNavbar.vue'
import { LANDING_BOOKING_KEY } from '@/composables/useLandingBooking'

const ANCHORS = { storytelling: false, gallery: false, rooms: true, location: false, reviews: false }

function render(openBooking?: ReturnType<typeof vi.fn>) {
  return mount(LandingNavbar, {
    props: { hotelName: 'Hotel Demo', hotelSlug: 'hotel-demo', anchors: ANCHORS },
    global: {
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      ...(openBooking ? { provide: { [LANDING_BOOKING_KEY as symbol]: openBooking } } : {}),
    },
  })
}

describe('LandingNavbar — CTA de reserva', () => {
  it('en la landing abre el modal en su primer paso (sin preselección)', async () => {
    const openBooking = vi.fn()
    const w = render(openBooking)

    const cta = w.get('button')
    expect(cta.text()).toContain('Reservar ahora')
    expect(w.findAll('a[href="/book/hotel-demo"]')).toHaveLength(0)

    await cta.trigger('click')
    expect(openBooking).toHaveBeenCalledTimes(1)
    expect(openBooking).toHaveBeenCalledWith()

    // Los anchors de sección siguen siendo links de scroll.
    expect(w.get('a[href="#rooms"]').text()).toBe('Habitaciones')
  })

  it('sin la landing (widget embebible) conserva el link a /book/:slug', () => {
    const w = render()

    expect(w.findAll('button')).toHaveLength(0)
    const cta = w.get('a[href="/book/hotel-demo"]')
    expect(cta.text()).toContain('Reservar ahora')
  })
})
