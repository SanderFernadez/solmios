// composables/useHotelJsonLd.test.ts — Regresión del bug envelope (solmi-direct-booking).
//
// El backend de landing devuelve `{ success, data: { data: [...] } }` (doble wrap: envelope
// del framework + envelope interno del service). `http.ts` desenvuelve SOLO el del framework,
// así que el caller recibe `{ data: [...] }` aunque la signatura diga `LandingBlock[]`. Antes
// del fix, `blocks.value.find()` rompía con TypeError y tiraba abajo la landing entera.
//
// Este test garantiza que el composable NO crashea si `blocks` viene en cualquiera de las 3
// formas: array plano (happy path), envelope `{data:[...]}` (bug real), o cualquier otra cosa
// (defensa forward). El FAQPage simplemente se omite si no hay FAQ válido.
import { describe, it, expect } from 'vitest'
import { ref, nextTick } from 'vue'
import { useHotelJsonLd } from './useHotelJsonLd'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia, PublicLandingRoom, PublicReviewsResponse } from '@/types'

function mkHotel(): PublicHotelInfo {
  return {
    id: 'h1', slug: 'demo', name: 'Hotel Demo', title: 'Demo', description: 'desc',
    accommodationType: 'hotel', starRating: 4, address: 'Calle 1', locality: 'City',
    municipality: 'State', province: 'Prov', postalCode: '12345',
    latitude: 0, longitude: 0, amenities: [], currency: 'USD', logo: '',
  } as unknown as PublicHotelInfo
}

function mkInputs(blocks: unknown) {
  return {
    hotel: ref<PublicHotelInfo | null>(mkHotel()),
    media: ref<PublicHotelMedia | null>(null),
    reviews: ref<PublicReviewsResponse | null>(null),
    // Forzamos el tipo desconocido al ref para simular el bug (el runtime puede traer
    // cualquier shape aunque la signatura diga `LandingBlock[]`). El casteo es intencional:
    // el punto del test es verificar que el composable sobrevive a un shape que miente.
    blocks: ref(blocks) as any,
    rooms: ref<PublicLandingRoom[] | null>(null),
    // idPrefix custom para que el test no pueda chocar con scripts de otros tests en el DOM.
    idPrefix: 'test-jsonld',
  }
}

describe('useHotelJsonLd — defensive envelope handling', () => {
  it('FAQ array plano: genera FAQPage si hay bloque faq con items válidos', async () => {
    const blocks: LandingBlock[] = [
      { id: 'b1', type: 'faq', sortOrder: 1, active: true, config: { items: [
        { question: '¿Hay estacionamiento?', answer: 'Sí, gratuito.' },
      ] } } as unknown as LandingBlock,
    ]
    const { faqJsonLd } = useHotelJsonLd(mkInputs(blocks))
    await nextTick()
    expect(faqJsonLd.value).not.toBeNull()
    expect((faqJsonLd.value as Record<string, unknown>)['@type']).toBe('FAQPage')
  })

  it('NO crashea cuando blocks viene envuelto en { data: [...] } (bug real)', async () => {
    // Este es el caso que rompia la landing en prod: el service envelope quedaba sin desenvolver.
    const wrapped = { data: [
      { id: 'b1', type: 'faq', sortOrder: 1, active: true, config: { items: [
        { question: 'Q1', answer: 'A1' },
      ] } },
    ] }
    const { faqJsonLd, hotelJsonLd } = useHotelJsonLd(mkInputs(wrapped))
    await nextTick()
    // El guard defensivo devuelve [] → no crashea, simplemente no genera FAQPage.
    expect(faqJsonLd.value).toBeNull()
    // El hotel JSON-LD sigue funcionando (es independiente de blocks).
    expect(hotelJsonLd.value).not.toBeNull()
    expect((hotelJsonLd.value as Record<string, unknown>)['name']).toBe('Hotel Demo')
  })

  it('NO crashea cuando blocks es null/undefined/string (defensa forward)', async () => {
    for (const weird of [null, undefined, 'not-an-array', { foo: 'bar' }, 42]) {
      const { faqJsonLd } = useHotelJsonLd(mkInputs(weird))
      await nextTick()
      expect(faqJsonLd.value).toBeNull()
    }
  })
})

// `fromPrice` es el TOTAL de la estadía consultada, no el precio de una noche. La landing lo
// divide por las noches para mostrarlo; el Offer del JSON-LD tiene que publicar EL MISMO
// número, o Google recibe un precio que no aparece en ninguna parte de la página.
describe('useHotelJsonLd — makesOffer publica precio por noche', () => {
  function mkInputsWithRooms(fromPrice: number, nights?: number) {
    const base = mkInputs([])
    return {
      ...base,
      rooms: ref<PublicLandingRoom[] | null>([
        { id: 'std', name: 'Standard', fromPrice } as unknown as PublicLandingRoom,
      ]),
      ...(nights === undefined ? {} : { roomsNights: ref(nights) }),
    }
  }

  it('divide el total de la estadía por las noches consultadas', async () => {
    const { hotelJsonLd } = useHotelJsonLd(mkInputsWithRooms(5000, 2))
    await nextTick()
    const offer = (hotelJsonLd.value as Record<string, unknown>)['makesOffer'] as Record<string, unknown>
    expect(offer['price']).toBe('2500')
  })

  it('sin roomsNights cae a 1 noche (no inventa una división)', async () => {
    const { hotelJsonLd } = useHotelJsonLd(mkInputsWithRooms(5000))
    await nextTick()
    const offer = (hotelJsonLd.value as Record<string, unknown>)['makesOffer'] as Record<string, unknown>
    expect(offer['price']).toBe('5000')
  })

  it('roomsNights inválido (0/NaN) no produce Infinity ni NaN', async () => {
    for (const bad of [0, NaN, -3]) {
      const { hotelJsonLd } = useHotelJsonLd(mkInputsWithRooms(5000, bad))
      await nextTick()
      const offer = (hotelJsonLd.value as Record<string, unknown>)['makesOffer'] as Record<string, unknown>
      expect(offer['price']).toBe('5000')
    }
  })
})
