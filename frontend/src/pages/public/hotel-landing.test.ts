// pages/public/hotel-landing.test.ts — Regresión del bug envelope (solmi-direct-booking).
//
// Reproduce el BLOCKER: la landing pública mostraba "Hotel no encontrado" cuando el hotel SÍ
// existía y estaba activo. El motivo: `LandingService.get` devuelve `{ data: [...] }` (envelope
// interno del service) y el componente lo asignaba sin desenvolver → `blocks.value.find()`
// desarrollaba TypeError y el catch lo convertía en error genérico.
//
// El test monta el componente con los servicios mockeados y verifica que con AMBAS formas
// (array plano y envelope `{data:[...]}`) el componente renderiza los bloques sin crashear.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

vi.mock('@/services/Landing.service', () => ({
  LandingService: { get: vi.fn() },
}))
vi.mock('@/services/PublicHotel.service', () => ({
  PublicHotelService: {
    getBySlug: vi.fn(),
    getMedia: vi.fn(),
    getReviews: vi.fn(),
  },
}))
// Stub del composable JSON-LD para no meter DOM <script> en el test unitario (su lógica se
// cubre en useHotelJsonLd.test.ts).
vi.mock('@/composables/useHotelJsonLd', () => ({
  useHotelJsonLd: () => ({ hotelJsonLd: { value: null }, faqJsonLd: { value: null } }),
}))

import HotelLanding from './hotel-landing.vue'
import { LandingService } from '@/services/Landing.service'
import { PublicHotelService } from '@/services/PublicHotel.service'

const HOTEL = {
  id: 'h1', slug: 'hotel-boutique-palma', name: 'Hotel Boutique Palma',
  title: 'Hotel Boutique Palma', description: 'Desc', accommodationType: 'hotel',
  starRating: 4, amenities: [], latitude: 0, longitude: 0, currency: 'USD',
}

function mkRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/h/:slug', name: 'public-hotel', component: HotelLanding }],
  })
}

/** Monta la landing con stubs de los 9 block components (no nos interesa su render acá).
 *  Navega a `/h/hotel-boutique-palma` antes de montar para que `useRoute().params.slug` esté seteado. */
async function mountLanding() {
  const router = mkRouter()
  await router.push('/h/hotel-boutique-palma')
  await router.isReady()
  return mount(HotelLanding, {
    global: {
      stubs: {
        HeroBlock: true, GalleryBlock: true, AmenitiesBlock: true, MapBlock: true,
        ReviewsBlock: true, RoomsBlock: true, FaqBlock: true, CtaBlock: true, FooterBlock: true,
        RouterLink: true,
      },
      plugins: [router],
    },
  })
}

describe('hotel-landing.vue — envelope defensivo', () => {
  beforeEach(() => {
    vi.mocked(PublicHotelService.getBySlug).mockResolvedValue(HOTEL as any)
    vi.mocked(PublicHotelService.getMedia).mockResolvedValue(null as any)
    vi.mocked(PublicHotelService.getReviews).mockResolvedValue(null as any)
  })

  it('renderiza bloques cuando LandingService devuelve un array plano', async () => {
    vi.mocked(LandingService.get).mockResolvedValue([
      { id: 'b1', type: 'hero', sortOrder: 1, active: true, config: {} },
      { id: 'b2', type: 'faq', sortOrder: 2, active: true, config: { items: [
        { question: 'Q', answer: 'A' },
      ] } },
    ] as any)

    const wrapper = await mountLanding()
    await flushPromises()

    // No entró al empty state ("Hotel no encontrado").
    expect(wrapper.text()).not.toContain('Hotel no encontrado')
    // Renderizó el componente main (al menos 1 bloque — hero siempre pinta).
    expect(wrapper.find('main').exists()).toBe(true)
    // El stub de FaqBlock recibe el bloque faq con items (hero + faq visibles).
    expect(wrapper.findAllComponents({ name: 'FaqBlock' }).length).toBeGreaterThan(0)
  })

  it('renderiza sin crashear cuando LandingService devuelve { data: [...] } (bug real)', async () => {
    // Este es exactamente el caso de prod: el service envelope queda sin desenvolver.
    // Antes del fix, esto derivaba en "Hotel no encontrado".
    vi.mocked(LandingService.get).mockResolvedValue({
      data: [
        { id: 'b1', type: 'hero', sortOrder: 1, active: true, config: {} },
        { id: 'b2', type: 'faq', sortOrder: 2, active: true, config: { items: [
          { question: 'Q', answer: 'A' },
        ] } },
      ],
    } as any)

    const wrapper = await mountLanding()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Hotel no encontrado')
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'FaqBlock' }).length).toBeGreaterThan(0)
  })

  it('no revienta si el service devuelve un shape inesperado (defensa forward)', async () => {
    vi.mocked(LandingService.get).mockResolvedValue({ foo: 'bar' } as any)

    const wrapper = await mountLanding()
    await flushPromises()

    // El hero siempre pinta (siempre renderea). Lo importante es que NO traba la landing.
    expect(wrapper.text()).not.toContain('Hotel no encontrado')
    expect(wrapper.find('main').exists()).toBe(true)
  })
})
