<template>
  <!--
    hotel-landing.vue — Orquestador de la landing pública (F1 1.6, solmi-direct-booking / Pieza B).
    Layout `none` (sin header/footer del panel SaaS) — el router tiene meta: { layout: 'none' }
    aunque el App.vue actual no consume el meta (cada página pública arma su propio layout).

    Flujo:
      1. GET /api/public/hotel/:slug            → hotel (PublicHotelInfo). Si 404 → empty state.
      2. En paralelo (Promise.allSettled):
         - GET /api/public/hotels/:slug/landing  → bloques activos ordenados.
         - GET /api/public/hotels/:slug/media    → media (404 tolerable, F0 endpoint futuro).
         - GET /api/public/hotels/:slug/reviews  → reviews (solo si bloque `reviews` activo).
      3. Renderiza cada bloque en `sortOrder`, eligiendo el componente por `type`.
      4. Inyecta JSON-LD (Hotel + AggregateRating + FAQPage) en <head>.

    Cada bloque tiene su propio guard interno; el orquestador además filtra los que no tienen
    data para mostrar (reviews sin reseñas, faq sin items, rooms sin endpoint F2 todavía, etc.).
  -->
  <div v-if="loading" class="min-h-screen bg-surface flex items-center justify-center">
    <div class="text-center">
      <div class="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-cyan/30 border-t-cyan animate-spin" />
      <p class="text-sm text-text-muted font-bold">Cargando…</p>
    </div>
  </div>

  <div v-else-if="error || !hotel" class="min-h-screen bg-surface flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-card w-full max-w-md p-8 text-center">
      <div class="text-4xl mb-3">🏝️</div>
      <h1 class="text-lg font-black text-navy">Hotel no encontrado</h1>
      <p class="text-sm text-text-muted mt-2">
        Este enlace no corresponde a un hotel con página pública activa.
      </p>
      <a href="/" class="inline-block mt-6 text-sm font-extrabold text-cyan hover:text-cyan-light">Volver al inicio</a>
    </div>
  </div>

  <main v-else>
    <component
      v-for="block in renderedBlocks"
      :key="block.type"
      :is="blockComponent(block.type)"
      :block="block"
      :hotel="hotel"
      :media="media"
      :reviews="reviews"
      :rooms="rooms"
    />

    <!--
      JSON-LD mínimo (F1 1.6): el composable `useHotelJsonLd` (task 1.10 / Pieza D) centraliza
      el schema completo con OpenGraph + meta dinámicos + sitemap. Acá alcanza con un
      <script type="application/ld+json"> válido en <head> (Hotel + AggregateRating + FAQPage).
      El <component :is="'script'"> trampa para Vue no monta scripts correctamente en <head>;
      por eso el orquestador inyecta via DOM en el watcher `jsonLd` (ver script setup).
    -->
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { PublicHotelService } from '@/services/PublicHotel.service'
import { LandingService } from '@/services/Landing.service'
import { ApiError } from '@/services/http'
import type {
  LandingBlock,
  LandingBlockType,
  PublicHotelInfo,
  PublicHotelMedia,
  PublicReviewsResponse,
  PublicLandingRoom,
} from '@/types'

import HeroBlock from '@/components/landing/HeroBlock.vue'
import GalleryBlock from '@/components/landing/GalleryBlock.vue'
import AmenitiesBlock from '@/components/landing/AmenitiesBlock.vue'
import MapBlock from '@/components/landing/MapBlock.vue'
import ReviewsBlock from '@/components/landing/ReviewsBlock.vue'
import RoomsBlock from '@/components/landing/RoomsBlock.vue'
import FaqBlock from '@/components/landing/FaqBlock.vue'
import CtaBlock from '@/components/landing/CtaBlock.vue'
import FooterBlock from '@/components/landing/FooterBlock.vue'

const route = useRoute()

const loading = ref(true)
const error = ref<string | null>(null)
const hotel = ref<PublicHotelInfo | null>(null)
const blocks = ref<LandingBlock[]>([])
const media = ref<PublicHotelMedia | null>(null)
const reviews = ref<PublicReviewsResponse | null>(null)
const rooms = ref<PublicLandingRoom[] | null>(null) // F2 no construido → siempre null por ahora.

// ─── Init ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  const slug = String(route.params.slug || '').trim()
  if (!slug) {
    error.value = 'missing-slug'
    loading.value = false
    return
  }
  try {
    hotel.value = await PublicHotelService.getBySlug(slug)

    // Mientras tanto, predigo si el bloque `reviews` estará activo para condicional el fetch.
    // El list de bloques determina el render; si el fetch de bloques falla, no hay reviews.
    const [blocksRes, mediaRes] = await Promise.allSettled([
      LandingService.get(slug),
      PublicHotelService.getMedia(slug),
    ])

    if (blocksRes.status === 'fulfilled') blocks.value = blocksRes.value
    // Si blocks falla, dejamos [] — la landing renderiza solo header/etc implícitamente; hoy no
    // hay fallback. El error signará con warning pero no bloquea la página completa.

    if (mediaRes.status === 'fulfilled') media.value = mediaRes.value
    // media 404 (F0 endpoint futuro en algunos deployments) → gallery/hero caen a gradiente.

    // Reviews: solo lo pido si hay bloque `reviews` activo (ahorra una request innecesaria).
    const hasReviewsBlock = blocks.value.some((b) => b.type === 'reviews')
    if (hasReviewsBlock) {
      try {
        reviews.value = await PublicHotelService.getReviews(slug, { limit: 12 })
      } catch {
        reviews.value = null // 404 tolerable — ReviewsBlock se omite si no hay data.
      }
    }

    // Rooms: F2 endpoint no construido todavía. Cuando exista, el fetch irá acá con
    // allSettled y `rooms` se poblará. Mientras tanto, `rooms=null` → RoomsBlock oculto.
    rooms.value = null
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      error.value = 'not-found'
    } else {
      error.value = e instanceof Error ? e.message : 'unknown'
    }
  } finally {
    loading.value = false
  }
})

// ─── Render: elegir componente por tipo + filtrar bloques sin data ─────────
const BLOCK_COMPONENTS: Record<LandingBlockType, unknown> = {
  hero: HeroBlock,
  gallery: GalleryBlock,
  amenities: AmenitiesBlock,
  location: MapBlock,
  reviews: ReviewsBlock,
  rooms: RoomsBlock,
  faq: FaqBlock,
  cta: CtaBlock,
  footer: FooterBlock,
}

function blockComponent(type: LandingBlockType) {
  return BLOCK_COMPONENTS[type]
}

/**
 * Filtra los bloques que el orquestador NO debe pintar porque falta data externa.
 * Cada BlockComponent tiene su propio guard, pero este filtro evita pedazos vacíos
 * (mejor SEO + layout limpio). Reglas:
 *   - gallery sin media.gallery           → omite
 *   - amenities sin hotel.amenities       → omite
 *   - location sin coords válidas (0,0)   → omite
 *   - reviews sin reviews/reseñas         → omite
 *   - rooms sin data F2 (rooms=null/[])   → omite (hasta que F2 exista)
 *   - faq sin items                       → omite
 * Los demás (hero, cta, footer) siempre renderizan (tienen defaults).
 */
const renderedBlocks = computed<LandingBlock[]>(() => {
  const list = [...blocks.value].sort((a, b) => a.sortOrder - b.sortOrder)
  return list.filter((b) => shouldRender(b))
})

function shouldRender(b: LandingBlock): boolean {
  switch (b.type) {
    case 'gallery':
      return (media.value?.gallery?.length ?? 0) > 0
    case 'amenities':
      return (hotel.value?.amenities?.length ?? 0) > 0
    case 'location': {
      const lat = hotel.value?.latitude
      const lng = hotel.value?.longitude
      return (
        typeof lat === 'number' && typeof lng === 'number' &&
        Number.isFinite(lat) && Number.isFinite(lng) &&
        !(lat === 0 && lng === 0) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      )
    }
    case 'reviews':
      return (reviews.value?.reviews?.length ?? 0) > 0
    case 'rooms':
      return (rooms.value?.length ?? 0) > 0
    case 'faq': {
      const items = (b.config ?? {}).items
      return Array.isArray(items) && items.length > 0
    }
    case 'hero':
    case 'cta':
    case 'footer':
      return true
    default:
      return true
  }
}

// ─── JSON-LD mínimo (F1 1.6) ──────────────────────────────────────────────
// El composable `useHotelJsonLd` (task 1.10 / Pieza D) centraliza todo el schema.
// Acá bastan Hotel/LodgingBusiness + AggregateRating (si hay reviews) + FAQPage (si hay FAQ).
// Lo inyecto via DOM en <head> cuando `hotel` + `blocks` están listos; lo saco en unmount.

const JSONLD_SCRIPT_ID = 'hotel-landing-jsonld'

const jsonLdPayload = computed<Record<string, unknown> | null>(() => {
  if (!hotel.value) return null
  const h = hotel.value

  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    'name': h.name,
    'url': typeof window !== 'undefined' ? window.location.href : `/h/${h.slug}`,
  }
  if (h.title || h.description) node['description'] = h.description || h.title
  if (h.accommodationType) node['@type'] = ['Hotel', ACCOMMODATION_MAP[h.accommodationType] ?? 'LodgingBusiness']
  if (h.starRating) {
    const stars = Number(h.starRating)
    if (Number.isFinite(stars)) node['starRating'] = { '@type': 'Rating', 'ratingValue': String(stars) }
  }

  // Imagen: hero media > logo.
  const heroUrl = media.value?.hero?.[0]?.url ?? h.logo
  if (heroUrl) node['image'] = [heroUrl]

  // Address (PostalAddress)
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

  // Geo
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

  // AggregateRating (solo si hay reviews y el aggregate trae score)
  const agg = reviews.value?.aggregate
  if (agg && agg.count > 0 && agg.score !== null) {
    node['aggregateRating'] = {
      '@type': 'AggregateRating',
      'ratingValue': String(agg.score.toFixed(1)),
      'reviewCount': agg.count,
    }
  }

  // Offer (cuando F2 traiga fromPrice). Mientras tanto no se agrega — mejor omitir que {price:0}.
  const hasRooms = (rooms.value?.length ?? 0) > 0
  if (hasRooms) {
    const minPrice = rooms.value
      ?.map((r) => r.fromPrice)
      .filter((p): p is number => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b)[0]
    if (minPrice !== undefined) {
      node['makesOffer'] = {
        '@type': 'Offer',
        'priceCurrency': h.currency || 'USD',
        'price': String(minPrice),
      }
    }
  }

  return node
})

const faqJsonLdPayload = computed<Record<string, unknown> | null>(() => {
  const faqBlock = blocks.value.find((b) => b.type === 'faq')
  if (!faqBlock) return null
  const items = (faqBlock.config ?? {}).items
  if (!Array.isArray(items) || items.length === 0) return null
  // Solo items con question+answer no-vacíos (defensivo; backend debería validar).
  const cleanItems = items
    .filter((it): it is { question: string; answer: string } =>
      typeof it === 'object' && it !== null &&
      typeof (it as { question: unknown }).question === 'string' &&
      typeof (it as { answer: unknown }).answer === 'string' &&
      (it as { question: string }).question.trim() !== '' &&
      (it as { answer: string }).answer.trim() !== '',
    )
    .map((it) => ({ '@type': 'Question', 'name': it.question, 'acceptedAnswer': { '@type': 'Answer', 'text': it.answer } }))
  if (cleanItems.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': cleanItems,
  }
})

function upsertJsonLd() {
  const scripts: Array<{ id: string; payload: Record<string, unknown> | null }> = [
    { id: `${JSONLD_SCRIPT_ID}-hotel`, payload: jsonLdPayload.value },
    { id: `${JSONLD_SCRIPT_ID}-faq`, payload: faqJsonLdPayload.value },
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

// Inyecto cuando hay data reactiva nueva (watch dispara en mount si ya había data).
watch([jsonLdPayload, faqJsonLdPayload], upsertJsonLd, { immediate: true })

onBeforeUnmount(() => {
  document.getElementById(`${JSONLD_SCRIPT_ID}-hotel`)?.remove()
  document.getElementById(`${JSONLD_SCRIPT_ID}-faq`)?.remove()
})

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
</script>
