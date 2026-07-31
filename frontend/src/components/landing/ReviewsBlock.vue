<template>
  <!--
    ReviewsBlock — reseñas + aggregate (consume endpoint F0 /api/public/hotels/:slug/reviews).
    El orquestador YA hizo el fetch y pasa `reviews` (PublicReviewsResponse | null).
    Si `reviews.aggregate.count === 0` o no hay reviews → el orquestador OMITE el bloque
    (v-if allá); doble guard acá por si llega vacío.
  -->
  <section v-if="reviews && visibleReviews.length > 0" class="bg-surface border-y border-border">
    <div class="max-w-6xl mx-auto px-6 py-16">
      <header class="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Opiniones</p>
          <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
          <!-- F3 3.16 — Badges multi-canal (Google/TripAdvisor/Booking/Airbnb/Expedia). Solo se
               renderizan si hay reviews de esas fuentes (count > 0). Componente defensivo. -->
          <MultiChannelBadges
            v-if="hasExternalSources"
            :aggregate="aggregate"
            variant="landing"
            class="mt-3"
          />
        </div>

        <!-- F3 3.16 — Aggregate score destacado (promedio global de TODAS las fuentes).
             Reemplaza el inline viejo (commit 5a4e5ea) por el componente reutilizable.
             Se muestra solo si count > 0 (score null si publishReviewScore=false). -->
        <AggregateScore
          v-if="aggregate.count > 0"
          :aggregate="aggregate"
          variant="hero"
        />
      </header>

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(r, i) in visibleReviews"
          :key="i"
          class="bg-white rounded-2xl border border-border p-5 shadow-card"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-0.5 text-gold-light [&_svg]:w-3.5 [&_svg]:h-3.5" v-html="starRow(r.rating)" />
            <div class="text-[10px] uppercase tracking-wide text-text-muted">{{ channelLabel(r.channel) }}</div>
          </div>
          <p v-if="r.title" class="font-extrabold text-navy text-sm mb-1.5">{{ r.title }}</p>
          <p v-if="r.comment" class="text-sm text-text-secondary leading-relaxed line-clamp-4">{{ r.comment }}</p>
          <div class="mt-4 flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-cyan/15 text-cyan font-black text-xs flex items-center justify-center">
              {{ initial(r.authorName) }}
            </div>
            <div class="leading-tight">
              <div class="text-xs font-bold text-navy">{{ r.authorName || 'Huésped verificado' }}</div>
              <div v-if="r.date" class="text-[10px] text-text-muted">{{ formatDate(r.date) }}</div>
            </div>
          </div>
        </article>
      </div>

      <!-- Backlink TripAdvisor OBLIGATORIO (reputation-aggregator/spec.md:111-115): si hay
           reviews de TripAdvisor visibles, la landing DEBE linkear a la página oficial —
           TripAdvisor puede suspender la API key si no hay backlink. rel=nofollow por spec. -->
      <p v-if="tripadvisorBacklink" class="mt-8 text-center text-[11px] text-text-muted">
        <a :href="tripadvisorBacklink" target="_blank" rel="nofollow noopener noreferrer" class="font-bold text-navy hover:underline">
          Reviews by TripAdvisor
        </a>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  LandingBlock,
  PublicHotelInfo,
  PublicHotelMedia,
  PublicReview,
  PublicReviewsResponse,
} from '@/types'
import MultiChannelBadges from '@/components/reviews/MultiChannelBadges.vue'
import AggregateScore from '@/components/reviews/AggregateScore.vue'
import { starRow } from './landing-icons'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
  reviews: PublicReviewsResponse | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Lo que dicen nuestros huéspedes'
})

const maxItems = computed(() => {
  const n = Number(cfg.value.maxItems)
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 6
})

const aggregate = computed(() => props.reviews?.aggregate ?? { score: null, count: 0, perSource: {} })

const visibleReviews = computed<PublicReview[]>(() =>
  (props.reviews?.reviews ?? []).slice(0, maxItems.value),
)

/** Hay AL MENOS una fuente externa con reviews (Google/TripAdvisor/Booking/Airbnb/Expedia)?
 *  `direct` no cuenta — las externas son las que aportan credibilidad cross-channel. */
const EXTERNAL_SOURCE_CHANNELS = new Set(['google', 'tripadvisor', 'booking', 'airbnb', 'expedia'])
const hasExternalSources = computed(() => {
  const per = aggregate.value.perSource
  if (!per) return false
  for (const ch of EXTERNAL_SOURCE_CHANNELS) {
    const stat = per[ch]
    if (stat && Number(stat.count) > 0) return true
  }
  return false
})

/** Backlink obligatorio (spec.md:111-115): URL de la primera review de TripAdvisor con
 *  `sourceUrl` entre TODAS las traídas (no solo las visibles/recortadas por maxItems) —
 *  el requisito es "si TripAdvisor está activo", no "si aparece en esta página". */
const tripadvisorBacklink = computed<string | null>(() => {
  const all = props.reviews?.reviews ?? []
  const withUrl = all.find((r) => r.channel === 'tripadvisor' && r.sourceUrl)
  return withUrl?.sourceUrl ?? null
})

function initial(name: string | null): string {
  if (!name) return 'H'
  return name.trim().charAt(0).toUpperCase()
}

function channelLabel(channel: string): string {
  if (!channel || channel === 'direct') return 'Reserva directa'
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<style scoped>
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
