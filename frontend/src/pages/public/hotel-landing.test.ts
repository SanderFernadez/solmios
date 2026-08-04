// pages/public/hotel-landing.test.ts — Regresión del bug envelope (solmi-direct-booking).
//
// Reproduce el BLOCKER: la landing pública mostraba "Hotel no encontrado" cuando el hotel SÍ
// existía y estaba activo. El motivo: `LandingService.get` devuelve `{ data: [...] }` (envelope
// interno del service) y el componente lo asignaba sin desenvolver → `blocks.value.find()`
// desarrollaba TypeError y el catch lo convertía en error genérico.
//
// El test monta el componente con los servicios mockeados y verifica que con AMBAS formas
// (array plano y envelope `{data:[...]}`) el componente renderiza los bloques sin crashear.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
// FIX (hero-search-rooms-content): hotel-landing.vue ahora hace un fetch real de tarifas
// (BookingService.getRates) para poblar `rooms`. Sin mock, el fetch real cuelga bajo happy-dom
// (nunca resuelve dentro de flushPromises) y el componente queda trabado en loading=true.
vi.mock('@/services/Booking.service', () => ({
  BookingService: { getRates: vi.fn().mockRejectedValue(new Error('no rates in test')) },
}))
// Stub del composable JSON-LD para no meter DOM <script> en el test unitario (su lógica se
// cubre en useHotelJsonLd.test.ts).
vi.mock('@/composables/useHotelJsonLd', () => ({
  useHotelJsonLd: () => ({ hotelJsonLd: { value: null }, faqJsonLd: { value: null } }),
}))

import HotelLanding from './hotel-landing.vue'
import { LandingService } from '@/services/Landing.service'
import { PublicHotelService } from '@/services/PublicHotel.service'
import { BookingService } from '@/services/Booking.service'
import { ApiError } from '@/services/http'

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
 *  Navega a `/h/hotel-boutique-palma` antes de montar para que `useRoute().params.slug` esté seteado.
 *  `stubRooms: false` monta el RoomsBlock real (los tests de tarifas miran lo que publica). */
async function mountLanding({ stubRooms = true }: { stubRooms?: boolean } = {}) {
  const router = mkRouter()
  await router.push('/h/hotel-boutique-palma')
  await router.isReady()
  return mount(HotelLanding, {
    global: {
      stubs: {
        HeroBlock: true, GalleryBlock: true, AmenitiesBlock: true, MapBlock: true,
        ReviewsBlock: true, FaqBlock: true, CtaBlock: true, FooterBlock: true,
        RouterLink: true,
        ...(stubRooms ? { RoomsBlock: true } : {}),
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

// ─── Estadía mínima del hotel (bug: rango indicativo fijo en 2 noches) ──────────────────────
// El orquestador pedía SIEMPRE 2 noches. Un hotel con `booking_config.minNights >= 3` recibía
// 400 de `/rates` ("Estadía mínima: 3 noches"), el catch dejaba `rooms = null` y el bloque de
// habitaciones desaparecía ENTERO: web pública sin habitaciones ni precios.
describe('hotel-landing.vue — rango indicativo vs. estadía mínima del hotel', () => {
  const ROOMS_BLOCK = { id: 'b3', type: 'rooms', sortOrder: 3, active: true, config: {} }

  /** Respuesta de `/rates` para `nights` noches: 100/noche × nights en un único room type. */
  function ratesFor(nights: number) {
    return {
      roomTypes: [{
        id: 'double', name: 'double', fromPrice: 100 * nights, availableCount: 4,
        capacity: 2, surfaceArea: 24, taxBreakdown: [], photoUrl: null,
      }],
      currency: 'USD', taxes: [], nights, chargeCurrency: 'USD',
      checkIn: '2026-01-02', checkOut: '2026-01-05',
      cancellationPolicy: null, cancellationSummary: null,
    }
  }

  /** Noches pedidas en la n-ésima llamada a getRates (diff entre checkIn y checkOut). */
  function nightsOfCall(call: number): number {
    const q = vi.mocked(BookingService.getRates).mock.calls[call]?.[1]
    const ms = new Date(String(q?.checkOut)).getTime() - new Date(String(q?.checkIn)).getTime()
    return Math.round(ms / 86_400_000)
  }

  beforeEach(() => {
    vi.mocked(PublicHotelService.getBySlug).mockResolvedValue(HOTEL as any)
    vi.mocked(PublicHotelService.getMedia).mockResolvedValue(null as any)
    vi.mocked(PublicHotelService.getReviews).mockResolvedValue(null as any)
    vi.mocked(LandingService.get).mockResolvedValue([ROOMS_BLOCK] as any)
    vi.mocked(BookingService.getRates).mockReset()
  })

  afterEach(() => {
    // Restaura el default del mock de módulo para no contaminar otros tests del archivo.
    vi.mocked(BookingService.getRates).mockRejectedValue(new Error('no rates in test'))
  })

  it('pide el rango que el hotel declara como mínimo, en UNA sola consulta', async () => {
    // El hotel dice minNights:3 en su info pública, así que la primera consulta ya es válida.
    // (Antes esto costaba dos requests: una que fallaba con 400 y otra parseando el mensaje.)
    vi.mocked(PublicHotelService.getBySlug).mockResolvedValue({ ...HOTEL, minNights: 3 } as any)
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesFor(3) as any)

    const wrapper = await mountLanding()
    await flushPromises()

    expect(vi.mocked(BookingService.getRates)).toHaveBeenCalledTimes(1)
    expect(nightsOfCall(0)).toBe(3)

    const block = wrapper.findComponent({ name: 'RoomsBlock' })
    expect(block.exists()).toBe(true)
    expect((block.props('rooms') as unknown[]).length).toBe(1)
    // Las noches publicadas son las del rango REAL cotizado — RoomsBlock divide fromPrice por acá.
    expect(block.props('roomsNights')).toBe(3)
    expect(block.props('roomsError')).toBe(false)
  })

  it('con el rango de 3 noches el precio por noche sigue siendo el correcto', async () => {
    vi.mocked(PublicHotelService.getBySlug).mockResolvedValue({ ...HOTEL, minNights: 3 } as any)
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesFor(3) as any) // fromPrice = 300 total

    const wrapper = await mountLanding({ stubRooms: false })
    await flushPromises()

    const txt = wrapper.text().replace(/\s+/g, ' ')
    expect(txt).toContain('100') // 300 / 3 noches
    expect(txt).not.toContain('300') // nunca el total crudo rotulado "/noche"
  })

  it('un hotel sin minNights declarado usa el default de 2 noches', async () => {
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesFor(2) as any)

    await mountLanding()
    await flushPromises()

    expect(vi.mocked(BookingService.getRates)).toHaveBeenCalledTimes(1)
    expect(nightsOfCall(0)).toBe(2)
  })

  it('un minNights absurdo se limita al techo defensivo, no cotiza meses', async () => {
    vi.mocked(PublicHotelService.getBySlug).mockResolvedValue({ ...HOTEL, minNights: 999 } as any)
    vi.mocked(BookingService.getRates).mockResolvedValue(ratesFor(30) as any)

    await mountLanding()
    await flushPromises()

    expect(nightsOfCall(0)).toBe(30)
  })

  it('si /rates falla, el bloque queda en estado degradado (no desaparece)', async () => {
    vi.mocked(BookingService.getRates).mockRejectedValue(new ApiError(500, 'boom'))

    const wrapper = await mountLanding({ stubRooms: false })
    await flushPromises()

    expect(vi.mocked(BookingService.getRates)).toHaveBeenCalledTimes(1)
    // El bloque SIGUE en la página, con estado degradado y CTA — no se borra en silencio.
    expect(wrapper.text()).toContain('Tarifas no disponibles en este momento')
    expect(wrapper.text()).toContain('Consultar disponibilidad')
  })

  it('el hotel con el motor apagado (404) tampoco pierde la sección', async () => {
    vi.mocked(BookingService.getRates).mockRejectedValue(new ApiError(404, 'Hotel not found'))

    const wrapper = await mountLanding()
    await flushPromises()

    expect(vi.mocked(BookingService.getRates)).toHaveBeenCalledTimes(1)
    const block = wrapper.findComponent({ name: 'RoomsBlock' })
    expect(block.exists()).toBe(true)
    expect(block.props('roomsError')).toBe(true)
  })
})
