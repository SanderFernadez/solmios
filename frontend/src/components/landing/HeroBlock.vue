<template>
  <!--
    HeroBlock — banda superior con título/subtitle/CTA. 3 variants estructurales por templateId:
    - classic (default): full-bleed imagen + overlay, texto bottom-left (look histórico).
    - modern: split 2-col desktop (col izq fondo navy con texto, col der imagen object-cover);
              mobile stackea (texto arriba, imagen abajo).
    - boutique: centrado minimalista sobre imagen full-bleed con overlay más pesado, max-w-3xl,
                CTA centrado (tipografía serif la inyecta el hook global data-template=menu en
                hotel-landing.vue vía Playfair Display).
    El CTA siempre lleva a /book/:slug (widget F0). El theme llega vía inject('landingTheme').
    Tailwind purge: TODAS las utilities están literales en el template (no en strings/computed).
  -->

  <!-- ─── classic (default) ─────────────────────────────────────────────── -->
  <section
    v-if="templateId === 'classic'"
    class="relative isolate overflow-hidden min-h-[78vh] flex items-end"
  >
    <div class="absolute inset-0 -z-10">
      <HeroSlider
        v-if="backgroundImages.length > 0"
        :images="backgroundImages"
        :alt="hotel.name"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-navy via-navy-light to-blue" />
      <div class="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/20" />
    </div>

    <div class="max-w-6xl mx-auto w-full px-6 pb-16 pt-32 sm:pb-20">
      <div class="max-w-2xl">
        <div class="flex items-center gap-3 mb-4 text-white/90">
          <span v-if="hotel.starRating" class="flex items-center gap-0.5 text-gold-light [&_svg]:w-3.5 [&_svg]:h-3.5" v-html="filledStarRow(starCount)" />
          <span class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/70">
            {{ accommodationTypeLabel }}
          </span>
        </div>
        <h1 class="text-4xl sm:text-6xl font-black text-white leading-[1.05] tracking-tight">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-5 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
          {{ subtitle }}
        </p>
        <div v-if="!searchBarEnabled" class="mt-8 flex flex-wrap items-center gap-3">
          <router-link
            :to="bookingLink"
            class="inline-flex items-center gap-2 bg-cyan hover:bg-cyan-light transition-colors text-navy font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg cursor-pointer"
          >
            {{ ctaText }}
            <span aria-hidden="true">→</span>
          </router-link>
          <div v-if="hotel.freeCancellation" class="text-xs text-white/80 font-bold flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 text-success-light [&_svg]:w-3.5 [&_svg]:h-3.5" v-html="ICON_CHECK_CIRCLE" /> Cancelación gratis
          </div>
        </div>
      </div>
      <HeroSearchBar
        v-if="searchBarEnabled"
        :hotel-slug="hotel.slug"
        :cta-text="searchBarCtaText"
        class="mt-8 max-w-4xl"
      />
    </div>
  </section>

  <!-- ─── modern (split 2-col) ──────────────────────────────────────────── -->
  <section
    v-else-if="templateId === 'modern'"
    class="relative isolate overflow-hidden min-h-[78vh] grid md:grid-cols-2"
  >
    <!-- Col texto (navy sólido). Mobile: primera, desktop: izquierda -->
    <div class="bg-navy flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-16 sm:py-20 order-1">
      <div class="max-w-xl">
        <div class="flex items-center gap-3 mb-4 text-white/90">
          <span v-if="hotel.starRating" class="flex items-center gap-0.5 text-gold-light [&_svg]:w-3.5 [&_svg]:h-3.5" v-html="filledStarRow(starCount)" />
          <span class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/70">
            {{ accommodationTypeLabel }}
          </span>
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="mt-5 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
          {{ subtitle }}
        </p>
        <div v-if="!searchBarEnabled" class="mt-8 flex flex-wrap items-center gap-3">
          <router-link
            :to="bookingLink"
            class="inline-flex items-center gap-2 bg-cyan hover:bg-cyan-light transition-colors text-navy font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg cursor-pointer"
          >
            {{ ctaText }}
            <span aria-hidden="true">→</span>
          </router-link>
          <div v-if="hotel.freeCancellation" class="text-xs text-white/80 font-bold flex items-center gap-1.5">
            <span class="w-3.5 h-3.5 text-success-light [&_svg]:w-3.5 [&_svg]:h-3.5" v-html="ICON_CHECK_CIRCLE" /> Cancelación gratis
          </div>
        </div>
      </div>
      <HeroSearchBar
        v-if="searchBarEnabled"
        :hotel-slug="hotel.slug"
        :cta-text="searchBarCtaText"
        class="mt-8"
      />
    </div>
    <!-- Col imagen (object-cover full-height). Mobile: abajo, desktop: derecha.
         Wrap absoluto para estirar el slider/img al alto de la columna grid (el right col
         no tiene alto intrínseco — el grid lo estira al del hermano texto). -->
    <div class="relative min-h-[40vh] md:min-h-full order-2 bg-navy-light">
      <div v-if="backgroundImages.length > 0" class="absolute inset-0">
        <HeroSlider :images="backgroundImages" :alt="hotel.name" />
      </div>
      <div v-else class="absolute inset-0 bg-gradient-to-br from-navy via-navy-light to-blue" />
    </div>
  </section>

  <!-- ─── boutique (centrado minimalista) ───────────────────────────────── -->
  <section
    v-else
    class="relative isolate overflow-hidden min-h-[78vh] flex flex-col items-center justify-center"
  >
    <div class="absolute inset-0 -z-10">
      <HeroSlider
        v-if="backgroundImages.length > 0"
        :images="backgroundImages"
        :alt="hotel.name"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-navy via-navy-light to-blue" />
      <!-- Overlay más pesado que classic (legibilidad sobre texto centrado) -->
      <div class="absolute inset-0 bg-navy/80" />
    </div>

    <div class="max-w-3xl mx-auto w-full px-6 py-24 text-center">
      <div class="flex items-center justify-center gap-3 mb-5 text-white/90">
        <span v-if="hotel.starRating" class="text-gold-light text-sm tracking-wide">
          {{ '★'.repeat(starCount) }}
        </span>
        <span class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/70">
          {{ accommodationTypeLabel }}
        </span>
      </div>
      <h1 class="text-4xl sm:text-6xl font-black text-white leading-[1.05] tracking-tight">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="mt-6 text-base sm:text-lg text-white/85 leading-relaxed mx-auto max-w-2xl">
        {{ subtitle }}
      </p>
      <div v-if="!searchBarEnabled" class="mt-9 flex flex-wrap items-center justify-center gap-3">
        <router-link
          :to="bookingLink"
          class="inline-flex items-center gap-2 bg-cyan hover:bg-cyan-light transition-colors text-navy font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg cursor-pointer"
        >
          {{ ctaText }}
          <span aria-hidden="true">→</span>
        </router-link>
        <div v-if="hotel.freeCancellation" class="text-xs text-white/80 font-bold flex items-center gap-1.5">
          <span class="text-success-light">✓</span> Cancelación gratis
        </div>
      </div>
    </div>
    <HeroSearchBar
      v-if="searchBarEnabled"
      :hotel-slug="hotel.slug"
      :cta-text="searchBarCtaText"
      class="mt-8 mx-auto max-w-4xl text-left px-6"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import type { LandingBlock, LandingTheme, LandingTemplateId, PublicHotelInfo, PublicHotelMedia } from '@/types'
import HeroSearchBar from './HeroSearchBar.vue'
import HeroSlider from './HeroSlider.vue'
import { filledStarRow, ICON_CHECK_CIRCLE } from './landing-icons'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

// El orquestador (hotel-landing.vue) provee el theme. Default classic si no hay provider
// (p.ej. en stories/tests aislados) o si el backend no configuró theme todavía.
const themeRef = inject<import('vue').Ref<LandingTheme | null>>('landingTheme')
const templateId = computed<LandingTemplateId>(() => themeRef?.value?.templateId ?? 'classic')

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || props.hotel.title || props.hotel.name
})

const subtitle = computed(() => {
  const s = typeof cfg.value.subtitle === 'string' ? cfg.value.subtitle.trim() : ''
  return s || props.hotel.description || ''
})

const ctaText = computed(() => {
  const c = typeof cfg.value.ctaText === 'string' ? cfg.value.ctaText.trim() : ''
  return c || 'Reservar ahora'
})

// Buscador inline opcional (F1 hero-search-rooms-content). Hoteles ya seedeados NO tienen
// `searchBar` en su config persistido hasta que el admin lo prende desde el editor — leer
// SIEMPRE con optional chaining, nunca asumir que la key existe.
const searchBarEnabled = computed(() => {
  const sb = cfg.value.searchBar as { enabled?: unknown; ctaText?: unknown } | undefined
  return sb?.enabled === true
})

const searchBarCtaText = computed(() => {
  const sb = cfg.value.searchBar as { enabled?: unknown; ctaText?: unknown } | undefined
  const c = typeof sb?.ctaText === 'string' ? sb.ctaText.trim() : ''
  return c || 'Buscar disponibilidad'
})

/**
 * backgroundImages — lista ordenada de URLs para el fondo del hero. Resolución:
 *   1. `cfg.backgroundMediaIds` (array explícito del MediaPicker): resolve cada id contra
 *      `media.hero`, descarta los que no existan (foto borrada → no rompe).
 *   2. `cfg.backgroundMediaId` (single, legacy): una sola imagen, sin carrusel.
 *   3. `media.hero[]` (default): TODAS las hero del hotel → si hay varias, el slider rota
 *      sin configuración manual (comportamiento nuevo, alineado a la feature de carrusel).
 * Array vacío → HeroBlock renderiza el fallback gradient (sin <HeroSlider>).
 */
const backgroundImages = computed<string[]>(() => {
  const heroList = props.media?.hero ?? []
  const byId = new Map(heroList.map((m) => [m.id, m.url]))

  const idsRaw = cfg.value.backgroundMediaIds
  if (Array.isArray(idsRaw) && idsRaw.length > 0) {
    const resolved = idsRaw
      .map((id) => (typeof id === 'string' ? byId.get(id) : undefined))
      .filter((u): u is string => Boolean(u))
    if (resolved.length > 0) return resolved
  }

  const singleId = typeof cfg.value.backgroundMediaId === 'string' ? cfg.value.backgroundMediaId : null
  if (singleId && byId.has(singleId)) return [byId.get(singleId) as string]

  return heroList.map((m) => m.url)
})

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)

const starCount = computed(() => {
  const n = Number(props.hotel.starRating)
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 0
})

const accommodationTypeLabel = computed(() => {
  const raw = (props.hotel.accommodationType || '').toString()
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
})
</script>

<style scoped>
.success-light { color: var(--color-success-light); }
</style>
