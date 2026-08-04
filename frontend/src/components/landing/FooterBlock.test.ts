// FooterBlock.test.ts — Los dos destinos del "Reservar →" del pie.
//
// Dentro de la landing abre el modal de reserva en su PRIMER paso (el pie no conoce fechas ni
// habitación → `openBooking()` sin argumentos). Fuera de la landing —sin provider— se conserva el
// link al widget embebible `/book/:slug`. El resto del pie (contacto, "Powered by SolmiOS") no se
// toca en ninguno de los dos caminos.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import FooterBlock from './FooterBlock.vue'
import { LANDING_BOOKING_KEY } from '@/composables/useLandingBooking'
import type { LandingBlock, PublicHotelInfo } from '@/types'

const HOTEL = {
  id: 'h1', slug: 'hotel-demo', name: 'Hotel Demo', currency: 'USD', email: 'hola@demo.test',
} as unknown as PublicHotelInfo
const BLOCK = { id: 'b1', type: 'footer', sortOrder: 9, active: true, config: {} } as unknown as LandingBlock

function render(openBooking?: ReturnType<typeof vi.fn>) {
  return mount(FooterBlock, {
    props: { block: BLOCK, hotel: HOTEL, media: null },
    global: {
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      ...(openBooking ? { provide: { [LANDING_BOOKING_KEY as symbol]: openBooking } } : {}),
    },
  })
}

describe('FooterBlock — CTA de reserva', () => {
  it('en la landing abre el modal en su primer paso (sin preselección)', async () => {
    const openBooking = vi.fn()
    const w = render(openBooking)

    const cta = w.get('button')
    expect(cta.text()).toContain('Reservar')
    expect(w.findAll('a[href="/book/hotel-demo"]')).toHaveLength(0)

    await cta.trigger('click')
    expect(openBooking).toHaveBeenCalledTimes(1)
    expect(openBooking).toHaveBeenCalledWith()

    // El pie sigue entero: "Powered by SolmiOS" no se convirtió en botón.
    expect(w.get('a[href="/"]').text()).toContain('Powered by SolmiOS')
  })

  it('sin la landing (widget embebible) conserva el link a /book/:slug', () => {
    const w = render()

    expect(w.findAll('button')).toHaveLength(0)
    const cta = w.get('a[href="/book/hotel-demo"]')
    expect(cta.text()).toContain('Reservar')
  })
})
