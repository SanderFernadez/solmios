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
    data para mostrar (reviews sin reseñas, faq sin items, rooms sin tarifas disponibles, etc.).
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
      <router-link to="/" class="inline-block mt-6 text-sm font-extrabold text-cyan hover:text-cyan-light">Volver al inicio</router-link>
    </div>
  </div>

  <main v-else :style="themeCssVars" :data-template="activeTemplate">
    <!--
      JSON-LD (F1 1.10): el composable `useHotelJsonLd` (Pieza D) arma el payload Hotel +
      FAQPage y los inyecta como `<script type="application/ld+json">` en `<head>` (idempotente,
      los limpia en unmount). El `<component :is="'script'">` de Vue no monta scripts en <head>
      correctamente — por eso el composable inyecta via DOM.
    -->

    <!-- Playfair Display solo para boutique (carga condicional, font-display swap, fallback DM Sans) -->
    <link
      v-if="activeTemplate === 'boutique'"
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700;900&display=swap"
    />

    <!-- FIX (rediseño visual post-QA usuario) — la landing no tenía NINGÚN navbar, gap grande
         vs. referencias de hoteles boutique reales. Overlay transparente sobre el hero, anchors
         condicionales a los bloques que efectivamente van a renderizar. -->
    <LandingNavbar
      :hotel-name="hotel.name"
      :hotel-slug="hotel.slug"
      :anchors="{
        storytelling: renderedBlocks.some((b) => b.type === 'storytelling'),
        gallery: renderedBlocks.some((b) => b.type === 'gallery'),
        rooms: renderedBlocks.some((b) => b.type === 'rooms'),
        location: renderedBlocks.some((b) => b.type === 'location'),
        reviews: renderedBlocks.some((b) => b.type === 'reviews'),
      }"
    />

    <component
      v-for="block in renderedBlocks"
      :id="ANCHOR_IDS[block.type]"
      :key="block.type"
      :is="blockComponent(block.type)"
      :block="block"
      :hotel="hotel"
      :media="media"
      :reviews="reviews"
      :rooms="rooms"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { PublicHotelService } from '@/services/PublicHotel.service'
import { LandingService } from '@/services/Landing.service'
import { BookingService } from '@/services/Booking.service'
import { ApiError } from '@/services/http'
import { useHotelJsonLd } from '@/composables/useHotelJsonLd'
import { useHotelMetaTags } from '@/composables/useHotelMetaTags'
import type {
  LandingBlock,
  LandingBlockType,
  LandingTheme,
  LandingTemplateId,
  PublicHotelInfo,
  PublicHotelMedia,
  PublicReviewsResponse,
  PublicLandingRoom,
  RoomTypeRate,
} from '@/types'
import { PRESET_MAP } from '@/types/landing'

import LandingNavbar from '@/components/landing/LandingNavbar.vue'
import HeroBlock from '@/components/landing/HeroBlock.vue'
import TrustBadgesBlock from '@/components/landing/TrustBadgesBlock.vue'
import StorytellingBlock from '@/components/landing/StorytellingBlock.vue'
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
const rooms = ref<PublicLandingRoom[] | null>(null) // Poblado por GET /rates (indicativo) en onMounted.

// ─── Theme (Task B — preset + custom overrides) ───────────────────────────
// El backend manda `theme: { templateId, colors?, fonts? }` (post-Task A). El orquestador
// lo provee a los bloques vía inject('landingTheme') (Hero/Gallery renderizan variants
// estructurales según templateId). El CSS override va en el <main> vía :style="themeCssVars"
// → CSS custom properties que pisan los tokens `@theme` de main.css para todo el subtree.
const theme = ref<LandingTheme | null>(null)
provide('landingTheme', theme)

/** templateId efectivo (default classic si el backend no manda theme). */
const activeTemplate = computed<LandingTemplateId>(
  () => theme.value?.templateId ?? 'classic',
)

/**
 * themeCssVars — merge PRESET_MAP[templateId] + theme.colors (custom) → objeto de CSS custom
 * properties `{ '--color-navy': '#...', '--color-navy-light': '#...', ... }`. camelCase → kebab.
 * Las utilities `bg-navy`/`text-cyan`/etc. de Tailwind v4 compilan a `var(--color-navy)` →
 * heredan el override del <main> automáticamente. Si el backend manda un color inválido
 * (string vacío o no-hex), se cae al preset (no lo overridea).
 *
 * Nota: `--color-surface-dark` en @theme es el token, pero ThemeTokens usa `surfaceDark`
 * (camelCase) → el rename va acá para que el override aplique.
 */
const themeCssVars = computed<Record<string, string>>(() => {
  const templateId = activeTemplate.value
  const preset = PRESET_MAP[templateId] ?? PRESET_MAP.classic
  const overrides = theme.value?.colors ?? {}
  // Merge shallow: preset first, overrides ganadores. Solo tokens declarados en ThemeTokens.
  const merged = { ...preset, ...overrides } as Record<string, string>
  const vars: Record<string, string> = {}
  for (const [camelKey, value] of Object.entries(merged)) {
    if (typeof value !== 'string' || value.trim() === '') continue
    // camelCase → kebab-case (navyLight → navy-light).
    const kebab = camelKey.replace(/([A-Z])/g, '-$1').toLowerCase()
    vars[`--color-${kebab}`] = value
  }
  return vars
})

// ─── Rooms (F1 hero-search-rooms-content) ──────────────────────────────────
// Bug UTC conocido del repo (ver CalendarView.vue:162 isoOf): `toISOString()` convierte a UTC
// antes de cortar, rompe "mañana" en zonas UTC-negativas (Santo Domingo, UTC-4). Construimos la
// fecha local a mano con getFullYear/getMonth/getDate, nunca toISOString ni parseo de string.
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function indicativeDateRange(): { checkIn: string; checkOut: string } {
  const now = new Date()
  const checkInDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const checkOutDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
  return { checkIn: localIso(checkInDate), checkOut: localIso(checkOutDate) }
}

/** Prettify simple de un roomType string ('double' → 'Double'). Sin mapa de labels centralizado
 *  (mismo criterio de estilo que AmenitiesBlock.vue:labelFor — capitaliza palabras kebab/snake). */
function prettifyRoomType(type: string): string {
  if (type.includes(' ')) return type
  return type
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function mapRoomTypeRate(rt: RoomTypeRate): PublicLandingRoom {
  return {
    id: rt.id,
    name: prettifyRoomType(rt.name),
    fromPrice: rt.fromPrice,
    availableCount: rt.availableCount,
    capacity: rt.capacity,
    surfaceArea: rt.surfaceArea,
    photoUrl: null,
  }
}

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

    if (blocksRes.status === 'fulfilled') {
      // DEFENSIVO (bug envelope, solmi-direct-booking): históricamente el backend envolvía la
      // lista en `{ data: [...] }` sobre el envelope del framework `{ success, data }` que
      // http.ts:263-270 YA desenvolvió. Tras Task A (commit 5df115a), el contract formal es
      // `{ data: LandingBlock[], theme: LandingTheme | null }`, pero soportamos ambas formas
      // (array plano, envelope sin theme, envelope con theme) para que un refactor del backend
      // no vuelva a romper la página ("Hotel no encontrado" por TypeError en useHotelJsonLd).
      const v = blocksRes.value as
        | LandingBlock[]
        | { data?: LandingBlock[]; theme?: LandingTheme | null }
      if (Array.isArray(v)) {
        blocks.value = v
      } else {
        blocks.value = v?.data ?? []
        theme.value = v?.theme ?? null
      }
    }
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

    // Rooms (F1 hero-search-rooms-content): tarifas indicativas vía GET /rates (mañana + 2
    // noches, 2 adultos — mismo default que useBooking.ts). Tolerante: un hotel con el booking
    // engine desactivado devuelve 400/404 acá, igual que reviews/media — no rompe la página.
    try {
      const { checkIn, checkOut } = indicativeDateRange()
      const ratesRes = await BookingService.getRates(slug, { checkIn, checkOut, guests: 2 })
      rooms.value = (ratesRes.roomTypes ?? []).map(mapRoomTypeRate)
    } catch {
      rooms.value = null
    }
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
  'trust-badges': TrustBadgesBlock,
  storytelling: StorytellingBlock,
  gallery: GalleryBlock,
  amenities: AmenitiesBlock,
  location: MapBlock,
  reviews: ReviewsBlock,
  rooms: RoomsBlock,
  faq: FaqBlock,
  cta: CtaBlock,
  footer: FooterBlock,
}

/** Anchors para los links del navbar (`#hero`/`#rooms`/`#location`/`#reviews`). Los demás
 *  types no tienen link en el navbar → sin id (evita colisiones de id si el hotel tiene
 *  varios bloques del mismo type renderizados — no pasa hoy, 1 por type, pero es defensivo). */
const ANCHOR_IDS: Partial<Record<LandingBlockType, string>> = {
  hero: 'hero',
  storytelling: 'experiencias',
  gallery: 'galeria',
  rooms: 'rooms',
  location: 'location',
  reviews: 'reviews',
}

function blockComponent(type: LandingBlockType) {
  return BLOCK_COMPONENTS[type]
}

/**
 * Filtra los bloques que el orquestador NO debe pintar porque falta data externa.
 * Cada BlockComponent tiene su propio guard, pero este filtro evita pedazos vacíos
 * (mejor SEO + layout limpio). Reglas:
 *   - storytelling sin description NI mediaIds → omite (guard liviano acá; el componente
 *     hace el guard fino con la resolución real contra media.gallery)
 *   - gallery sin media.gallery           → omite
 *   - amenities sin hotel.amenities       → omite
 *   - location sin coords válidas (0,0)   → omite
 *   - reviews sin reviews/reseñas         → omite
 *   - rooms sin tarifas (GET /rates falló o vacío) → omite
 *   - faq sin items                       → omite
 * Los demás (hero, trust-badges, cta, footer) siempre renderizan (tienen defaults).
 */
const renderedBlocks = computed<LandingBlock[]>(() => {
  const list = [...blocks.value].sort((a, b) => a.sortOrder - b.sortOrder)
  return list.filter((b) => shouldRender(b))
})

function shouldRender(b: LandingBlock): boolean {
  switch (b.type) {
    case 'storytelling': {
      const cfg = (b.config ?? {}) as Record<string, unknown>
      const hasDescription = typeof cfg.description === 'string' && cfg.description.trim().length > 0
      const hasMedia = Array.isArray(cfg.mediaIds) && cfg.mediaIds.length > 0
      return hasDescription || hasMedia
    }
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
    case 'trust-badges':
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

// FIX (auditoría UX/SEO) — la landing no tenía meta description dinámica ni ningún tag
// og:*/twitter:* — compartir el link de un hotel mostraba branding genérico de la SPA en vez
// del hotel. Ver composable para la limitación honesta (SPA sin SSR real).
useHotelMetaTags({ hotel, media })

// FIX 2026-07-31 (QA en prod) — la pestaña del navegador quedaba con el título genérico del
// SPA ("SolmiOS — Hospitality OS") en TODAS las landings públicas en vez del nombre del hotel
// (afecta SEO + UX de pestañas múltiples). Se restaura el default al salir para no filtrar el
// nombre del hotel a otras páginas del panel que no setean su propio título.
const DEFAULT_TITLE = 'SolmiOS — Hospitality OS'
watch(hotel, (h) => {
  document.title = h?.name ? `${h.name} — Reserva directa` : DEFAULT_TITLE
}, { immediate: true })
onBeforeUnmount(() => { document.title = DEFAULT_TITLE })
</script>

<!--
  Estilos NO scoped (Task B): los selectores por atributo `main[data-template='...']` necesitan
  perforar scope. Tailwind v4 ya genera utilities; acá solo detalles puntuales (tipografía
  boutique + cards editoriales).
-->
<style>
/* Boutique: headings en Playfair Display (cargado por <link> condicional en el template),
   fallback DM Sans (font-sans). Solo aplicado dentro del main con data-template=boutique. Las
   reglas viven acá (no scoped) para perforar el scope de hotel-landing y llegar a los bloques. */
main[data-template='boutique'] h1,
main[data-template='boutique'] h2 {
  font-family: 'Playfair Display', 'DM Sans', Georgia, serif;
  letter-spacing: -0.01em;
}

/* Boutique: cards editoriales — radius menor (0.5rem), fondo crema cálido y borde vino sutil.
   Suma los dos detalles que diferencian .card boutique de la card default (16px, blanca). */
main[data-template='boutique'] .card {
  border-radius: 0.5rem;
  background: #FFFCF7;
  border-color: rgba(74, 29, 29, 0.12);
}
</style>
