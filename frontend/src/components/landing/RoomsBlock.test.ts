// RoomsBlock.test.ts — Los dos destinos del CTA de una card de habitación.
//
// Dentro de la landing el CTA abre el modal de reserva con ESA habitación preseleccionada (el
// huésped no abandona `/h/:slug`). Fuera de la landing —sin provider— se conserva el link al
// widget embebible `/book/:slug`, que es un producto aparte y no se toca.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import RoomsBlock from './RoomsBlock.vue'
import { LANDING_BOOKING_KEY } from '@/composables/useLandingBooking'
import type { LandingBlock, PublicHotelInfo, PublicLandingRoom } from '@/types'

const HOTEL = { id: 'h1', slug: 'hotel-demo', name: 'Hotel Demo', currency: 'USD' } as unknown as PublicHotelInfo
const BLOCK = { id: 'b1', type: 'rooms', sortOrder: 1, active: true, config: {} } as unknown as LandingBlock
const ROOMS: PublicLandingRoom[] = [
  { id: 'double', name: 'Double', fromPrice: 300, availableCount: 4, capacity: 2, surfaceArea: 24, photoUrl: null },
  { id: 'suite', name: 'Suite', fromPrice: 600, availableCount: 2, capacity: 4, surfaceArea: 48, photoUrl: null },
]

function render(openBooking?: ReturnType<typeof vi.fn>) {
  return mount(RoomsBlock, {
    props: { block: BLOCK, hotel: HOTEL, media: null, rooms: ROOMS, roomsNights: 3 },
    global: {
      stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } },
      ...(openBooking ? { provide: { [LANDING_BOOKING_KEY as symbol]: openBooking } } : {}),
    },
  })
}

describe('RoomsBlock — CTA de reserva', () => {
  it('en la landing abre el modal con la habitación clickeada preseleccionada', () => {
    const openBooking = vi.fn()
    const w = render(openBooking)

    const ctas = w.findAll('article button')
    expect(ctas).toHaveLength(2)

    ctas[1]!.trigger('click')
    expect(openBooking).toHaveBeenCalledWith({ roomTypeId: 'suite' })
  })

  it('sin la landing (widget embebible) conserva el link a /book/:slug', () => {
    const w = render()

    expect(w.findAll('article button')).toHaveLength(0)
    const links = w.findAll('a[href]')
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((l) => l.attributes('href') === '/book/hotel-demo')).toBe(true)
  })
})

// Regresión del bug que este bloque vino a arreglar: `fromPrice` es el TOTAL de la estadía
// consultada, y la card lo publicaba crudo con el sufijo "/noche" → la web del hotel anunciaba
// el precio multiplicado por la cantidad de noches del rango indicativo.
describe('RoomsBlock — precio por noche', () => {
  it('divide el total de la estadía por las noches consultadas', () => {
    const w = render()
    const txt = w.text().replace(/\s+/g, ' ')
    // 300 / 3 noches = 100 y 600 / 3 = 200. Los totales crudos NO pueden aparecer.
    expect(txt).toContain('100')
    expect(txt).toContain('200')
    expect(txt).not.toContain('300')
    expect(txt).not.toContain('600')
  })

  it('sin roomsNights cae a 1 noche en vez de dividir por algo inventado', () => {
    const w = mount(RoomsBlock, {
      props: { block: BLOCK, hotel: HOTEL, media: null, rooms: ROOMS },
      global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
    })
    expect(w.text().replace(/\s+/g, ' ')).toContain('300')
  })
})
