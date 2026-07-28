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
      JSON-LD (F1 1.10): el composable `useHotelJsonLd` (Pieza D) arma el payload Hotel +
      FAQPage y los inyecta como `<script type="application/ld+json">` en `<head>` (idempotente,
      los limpia en unmount). El `<component :is="'script'">` de Vue no monta scripts en <head>
      correctamente — por eso el composable inyecta via DOM.
    -->
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { PublicHotelService } from '@/services/PublicHotel.service'
import { LandingService } from '@/services/Landing.service'
import { ApiError } from '@/services/http'
import { useHotelJsonLd } from '@/composables/useHotelJsonLd'
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

// ─── JSON-LD (F1 1.10 — composable useHotelJsonLd, Pieza D) ────────────────
// El composable arma los payloads Hotel/LodgingBusiness + FAQPage y los inyecta en <head>
// (watch immediate + cleanup en onBeforeUnmount). El orquestador solo le pasa los refs; mismo
// comportamiento que el inline original (commit 555bf82): aggregateRating solo si count>0 y
// score!=null, FAQPage solo con items válidos, makesOffer omitido hasta F2.
useHotelJsonLd({ hotel, media, reviews, blocks, rooms })
</script>
