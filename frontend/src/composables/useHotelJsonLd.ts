// composables/useHotelJsonLd.ts — JSON-LD (Hotel/LodgingBusiness + FAQPage) de la landing
// pública de un hotel (F1 1.10, solmi-direct-booking / Pieza D).
//
// Centraliza el schema.org que antes vivía inline en `pages/public/hotel-landing.vue`. El
// orquestador solo le pasa los refs con la data cargada (hotel, media, reviews, blocks, rooms)
// y el composable:
//   1. Devuelve `hotelJsonLd` y `faqJsonLd` como `ComputedRef` (objetos JS listos para
//      `JSON.stringify`).
//   2. Inyecta/actualiza los `<script type="application/ld+json">` en `<head>` cuando la data
//      cambia (watch immediate), y los elimina en `onBeforeUnmount`.
//
// behaviour idéntico al inline original (commit 555bf82, Pieza B):
//   - `aggregateRating` SOLO si `aggregate.count > 0 && aggregate.score !== null`.
//   - `makesOffer` solo si hay rooms con `fromPrice` válido (F2). Hasta que F2 exista, se omite.
//   - `FAQPage` solo si el bloque `faq` trae items con question+answer no-vacíos.
//   - `image` = primera hero media > logo (sin hero, cae a logo si existe).
//
// El composable NO hace fetch: consume los refs que el orquestador ya cargó (regla: sin fetch
// fuera de services). Tampoco depende de `window` para construir el payload (solo para inyectar);
// el campo `url` usa `window.location.href` si está disponible, si no `/h/<slug>` (SSR/tests).

import { computed, onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import type {
  LandingBlock,
  PublicHotelInfo,
  PublicHotelMedia,
  PublicLandingRoom,
  PublicReviewsResponse,
} from '@/types'

// accommodationType (DB) → schema.org type. El default es 'Hotel'; si llega un valor raro
// cae a 'LodgingBusiness' (genérico safe). Mismo mapa que el inline original.
const ACCOMMODATION_MAP: Record<string, string> = {
  hotel: 'Hotel',
  hostel: 'Hostel',
  resort: 'Resort',
  motel: 'Motel',
  villa: 'LodgingBusiness',
  apartment: 'Apartment',
  guest_house: 'LodgingBusiness',
  bed_and_breakfast: 'BedAndBreakfast',
}

export interface UseHotelJsonLdInput {
  hotel: Ref<PublicHotelInfo | null>
  media: Ref<PublicHotelMedia | null>
  reviews: Ref<PublicReviewsResponse | null>
  blocks: Ref<LandingBlock[]>
  rooms: Ref<PublicLandingRoom[] | null>
  /**
   * Noches del rango indicativo con el que se pidieron los `rooms`. `fromPrice` es el TOTAL de
   * la estadía (ver types/booking.ts), así que el precio del Offer se divide por esto para
   * publicar el mismo precio por noche que muestra la página. Sin esto, Google recibiría el
   * total de N noches como si fuera el precio, y no coincidiría con el contenido visible.
   */
  roomsNights?: Ref<number>
  /** Prefijo del id del `<script>` inyectado (default 'hotel-landing-jsonld'). */
  idPrefix?: string
}

export interface UseHotelJsonLdResult {
  /** Payload Hotel/LodgingBusiness (null si no hay hotel). Lista para JSON.stringify. */
  hotelJsonLd: ComputedRef<Record<string, unknown> | null>
  /** Payload FAQPage (null si no hay bloque faq con items válidos). */
  faqJsonLd: ComputedRef<Record<string, unknown> | null>
}

/**
 * Genera e inyecta el JSON-LD de la landing pública. Ver docstring del archivo.
 */
export function useHotelJsonLd(input: UseHotelJsonLdInput): UseHotelJsonLdResult {
  const { hotel, media, reviews, blocks, rooms, roomsNights } = input
  const idPrefix = input.idPrefix ?? 'hotel-landing-jsonld'

  const hotelJsonLd = computed<Record<string, unknown> | null>(() => {
    const h = hotel.value
    if (!h) return null

    const node: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      'name': h.name,
      'url': typeof window !== 'undefined' ? window.location.href : `/h/${h.slug}`,
    }
    if (h.title || h.description) node['description'] = h.description || h.title
    // FE fix (audit) — Evitar `@type: ['Hotel', 'Hotel']` cuando accommodationType==='hotel':
    // schema.org no acepta tipos duplicados y Google Markup Validator warna. Si el mapped
    // type ya es 'Hotel', dejamos string; si es distinto, array (Hotel + específico).
    if (h.accommodationType) {
      const mapped = ACCOMMODATION_MAP[h.accommodationType] ?? 'LodgingBusiness'
      node['@type'] = mapped === 'Hotel' ? 'Hotel' : ['Hotel', mapped]
    }
    if (h.starRating) {
      const stars = Number(h.starRating)
      if (Number.isFinite(stars)) node['starRating'] = { '@type': 'Rating', 'ratingValue': String(stars) }
    }
    // FIX (auditoría SEO) — telephone/checkinTime/checkoutTime existían en PublicHotelInfo pero
    // nunca se exponían en el structured data (campos que Google SÍ usa para el rich snippet).
    if (h.phone) node['telephone'] = h.phone
    if (h.checkIn) node['checkinTime'] = h.checkIn
    if (h.checkOut) node['checkoutTime'] = h.checkOut

    // Imagen: primera hero media > logo (sin hero cae a logo si existe).
    const heroUrl = media.value?.hero?.[0]?.url ?? h.logo
    if (heroUrl) node['image'] = [heroUrl]

    // Address (PostalAddress) — solo si alguna parte existe.
    const addressParts = [h.address, h.locality, h.municipality, h.province, h.postalCode]
      .filter((p): p is string => Boolean(p && p.trim()))
    if (addressParts.length > 0) {
      const addr: Record<string, unknown> = { '@type': 'PostalAddress' }
      if (h.address) addr['streetAddress'] = h.address
      if (h.locality) addr['addressLocality'] = h.locality
      if (h.municipality) addr['addressRegion'] = h.municipality
      if (h.province) addr['addressRegion'] = addr['addressRegion'] ?? h.province
      if (h.postalCode) addr['postalCode'] = h.postalCode
      node['address'] = addr
    }

    // Geo — descarta (0,0) y fuera de rango.
    if (!(h.latitude === 0 && h.longitude === 0) &&
        Number.isFinite(h.latitude) && Number.isFinite(h.longitude) &&
        h.latitude >= -90 && h.latitude <= 90 && h.longitude >= -180 && h.longitude <= 180) {
      node['geo'] = { '@type': 'GeoCoordinates', 'latitude': h.latitude, 'longitude': h.longitude }
    }

    // AmenityFeature
    if (h.amenities && h.amenities.length > 0) {
      node['amenityFeature'] = h.amenities.map((a) => ({
        '@type': 'LocationFeatureSpecification',
        'name': a,
        'value': true,
      }))
    }

    // AggregateRating (solo si hay reviews y el aggregate trae score). Mismo guard que el inline.
    const agg = reviews.value?.aggregate
    if (agg && agg.count > 0 && agg.score !== null) {
      node['aggregateRating'] = {
        '@type': 'AggregateRating',
        'ratingValue': String(agg.score.toFixed(1)),
        'reviewCount': agg.count,
      }
    }

    // makesOffer — solo cuando F2 traiga rooms con fromPrice válido. Mientras tanto, omitir
    // es mejor que emitir `{price: 0}` (que Google rechaza y queda peor).
    const hasRooms = (rooms.value?.length ?? 0) > 0
    if (hasRooms) {
      const minPrice = rooms.value
        ?.map((r) => r.fromPrice)
        .filter((p): p is number => typeof p === 'number' && p > 0)
        .sort((a, b) => a - b)[0]
      if (minPrice !== undefined) {
        // Mismo saneo que RoomsBlock: fromPrice es el total de la estadía consultada, el Offer
        // publica el precio POR NOCHE para no contradecir lo que el visitante ve en la página.
        const n = roomsNights?.value
        const nights = typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 1
        node['makesOffer'] = {
          '@type': 'Offer',
          'priceCurrency': h.currency || 'USD',
          'price': String(minPrice / nights),
        }
      }
    }

    return node
  })

  const faqJsonLd = computed<Record<string, unknown> | null>(() => {
    // DEFENSIVO (bug envelope, solmi-direct-booking): si el caller pasa un `blocks` que no es
    // array (ej. `{ data: [...] }` sin desenvolver), no crasquemos la landing entera —
    // devolvemos null y el FAQPage JSON-LD simplemente se omite. Mismo guard defensivo que
    // hotel-landing.vue; este es el segundo nivel de protección.
    const list = Array.isArray(blocks.value) ? blocks.value : []
    const faqBlock = list.find((b) => b.type === 'faq')
    if (!faqBlock) return null
    const items = (faqBlock.config ?? {}).items
    if (!Array.isArray(items) || items.length === 0) return null
    // Solo items con question+answer no-vacíos (defensivo; el backend debería validar).
    const cleanItems = items
      .filter((it): it is { question: string; answer: string } =>
        typeof it === 'object' && it !== null &&
        typeof (it as { question: unknown }).question === 'string' &&
        typeof (it as { answer: unknown }).answer === 'string' &&
        (it as { question: string }).question.trim() !== '' &&
        (it as { answer: string }).answer.trim() !== '',
      )
      .map((it) => ({
        '@type': 'Question',
        'name': it.question,
        'acceptedAnswer': { '@type': 'Answer', 'text': it.answer },
      }))
    if (cleanItems.length === 0) return null
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': cleanItems,
    }
  })

  // ─── DOM injection (idempotente) ─────────────────────────────────────────
  // El `<component :is="'script'">` de Vue no monta scripts en <head> correctamente; por eso
  // la inyección es por DOM. Si la data cambia, actualiza el textContent; si pasa a null,
  // elimina el tag. `typeof document === 'undefined'` guarda para SSR/tests sin DOM.
  function upsert() {
    if (typeof document === 'undefined') return
    const scripts: Array<{ id: string; payload: Record<string, unknown> | null }> = [
      { id: `${idPrefix}-hotel`, payload: hotelJsonLd.value },
      { id: `${idPrefix}-faq`, payload: faqJsonLd.value },
    ]
    for (const { id, payload } of scripts) {
      let tag = document.getElementById(id) as HTMLScriptElement | null
      if (!payload) {
        tag?.remove()
        continue
      }
      if (!tag) {
        tag = document.createElement('script')
        tag.type = 'application/ld+json'
        tag.id = id
        document.head.appendChild(tag)
      }
      tag.textContent = JSON.stringify(payload)
    }
  }

  // watch dispara en mount si ya había data (immediate). Si los refs cambian después, actualiza.
  watch([hotelJsonLd, faqJsonLd], upsert, { immediate: true })

  onBeforeUnmount(() => {
    if (typeof document === 'undefined') return
    document.getElementById(`${idPrefix}-hotel`)?.remove()
    document.getElementById(`${idPrefix}-faq`)?.remove()
  })

  return { hotelJsonLd, faqJsonLd }
}
