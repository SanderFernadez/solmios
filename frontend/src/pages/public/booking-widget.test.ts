// booking-widget.test.ts — Deep-link de la landing hacia el widget embebible.
//
// Bug que se protege: el buscador de la landing genera `/book/:slug?checkIn&checkOut&guests&rooms
// &children` (HeroSearchBar.vue), pero `readInitParams` NO leía `children`. El huésped declaraba
// niños en la landing, tocaba "Ver disponibilidad" y llegaba al motor con 0 niños: la ocupación
// física quedaba por debajo de la real y el precio se movía entre una pantalla y la otra.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Ruta mutable: cada test escribe su query antes de montar.
const route: { params: Record<string, string>; query: Record<string, string> } = {
  params: { slug: 'hotel-demo' },
  query: {},
}

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('@/services/PublicHotel.service', () => ({
  PublicHotelService: { getBySlug: vi.fn().mockResolvedValue({ id: 'h1', name: 'Hotel Demo', logo: null }) },
}))
vi.mock('@/composables/useTracking', () => ({
  useTracking: () => ({ track: vi.fn() }),
  initTracking: vi.fn(),
}))
// El step 0 real monta el calendario y sale a la red: acá solo importa el parseo de la URL.
vi.mock('@/components/booking/SearchStep.vue', () => ({
  default: { name: 'SearchStep', template: '<div data-test="search-step" />' },
}))
vi.mock('@/services/Booking.service', () => ({
  BookingService: { getRates: vi.fn(), getCalendar: vi.fn() },
}))

import BookingWidget from './booking-widget.vue'
import { useBookingStore } from '@/composables/useBooking'

let wrapper: VueWrapper | null = null

async function render(query: Record<string, string>) {
  route.query = query
  wrapper = mount(BookingWidget)
  await flushPromises()
  return useBookingStore()
}

describe('booking-widget — parámetros del deep-link', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // El probe de geo-IP (Cloudflare Trace) no existe en tests: que falle es el camino normal
    // en dev y no debe romper el montaje.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin cloudflare')))
    wrapper?.unmount()
    wrapper = null
  })

  it('lee `?children` de la URL y lo suma a la ocupación física, sin tocar los adultos', async () => {
    const store = await render({
      checkIn: '2026-08-18', checkOut: '2026-08-21', guests: '2', children: '3', rooms: '1',
    })

    expect(store.checkIn).toBe('2026-08-18')
    expect(store.checkOut).toBe('2026-08-21')
    expect(store.guests).toBe(2) // adultos
    expect(store.children).toBe(3)
    expect(store.physicalGuests).toBe(5)
    expect(store.rooms).toBe(1)
  })

  it('sin `?children` en la URL el default sigue siendo 0 (link viejo intacto)', async () => {
    const store = await render({ checkIn: '2026-08-18', checkOut: '2026-08-21', guests: '2' })

    expect(store.children).toBe(0)
    expect(store.physicalGuests).toBe(2)
  })

  it('un `?children` basura no rompe el widget', async () => {
    const store = await render({ guests: '2', children: 'muchos' })

    expect(store.children).toBe(0)
    expect(store.physicalGuests).toBe(2)
  })
})
