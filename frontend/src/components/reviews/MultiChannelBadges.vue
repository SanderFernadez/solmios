<template>
  <!--
    MultiChannelBadges.vue — Badges multi-canal de reseñas (F3 3.16, solmi-direct-booking).
    Muestra UN badge por fuente externa (Google, TripAdvisor, Booking, Airbnb, Expedia) con
    ícono + score + count. Se inyecta en:
      - ReviewsBlock.vue (landing F1) — variant 'landing' (badges grandes).
      - RoomsStep.vue (widget F2) — variant 'compact' (badges inline chiquitos).

    Spec reputation-aggregator/spec.md:168-172 — "Si hay reviews Google → badge 'Google ⭐ 4.5 (N)'".
    ACCEPTANCE 3.16: badges renderizan SOLO si la fuente tiene reviews (count > 0). Si perSource
    no trae una fuente o su count es 0, no se pinta el badge (no badge vacío).

    El score agregado global lo muestra el hermano `AggregateScore.vue`; este componente es
    SOLAMENTE el breakdown por canal (los "credibility badges" estilo TripAdvisor widget).

    `direct` no se muestra acá — ese es el "propio" (SOLMI Score) y va en AggregateScore. Acá
    van las fuentes EXTERNAS que dan credibilidad cross-channel (Google, TripAdvisor, Booking…).
  -->
  <ul v-if="visibleSources.length > 0" :class="wrapperClass">
    <li
      v-for="source in visibleSources"
      :key="source.channel"
    >
      <a
        v-if="source.url"
        :href="source.url"
        target="_blank"
        rel="nofollow noopener noreferrer"
        :class="badgeClass"
        :title="`${source.label} · ${source.score.toFixed(1)} (${source.count})`"
      >
        <component :is="source.icon" class="shrink-0" :class="iconClass" />
        <span class="font-black tabular-nums">{{ source.score.toFixed(1) }}</span>
        <span :class="countClass">({{ source.count }})</span>
      </a>
      <span
        v-else
        :class="badgeClass"
        :title="`${source.label} · ${source.score.toFixed(1)} (${source.count})`"
      >
        <component :is="source.icon" class="shrink-0" :class="iconClass" />
        <span class="font-black tabular-nums">{{ source.score.toFixed(1) }}</span>
        <span :class="countClass">({{ source.count }})</span>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, h, type FunctionalComponent } from 'vue'
import type { PublicReviewAggregate } from '@/types'

/**
 * Variantes visuales:
 *  - 'landing' (default): badges grandes con label visible, ideal para el ReviewsBlock.
 *  - 'compact': badges inline sin label, para inyectar en RoomsStep / widget F2 donde el
 *    espacio es mobile-first y solo queremos el ícono + score.
 */
type Variant = 'landing' | 'compact'

const props = withDefaults(defineProps<{
  aggregate: PublicReviewAggregate | null
  variant?: Variant
}>(), {
  variant: 'landing',
})

/** Stat de una fuente externa ya resuelto para render (con label + icono Vue). */
interface SourceBadge {
  channel: string
  label: string
  score: number
  count: number
  url: string | null
  icon: FunctionalComponent
}

/** Orden estable: Google primero (mayor reconocimiento), TripAdvisor después (travel-specific),
 *  luego las OTAs. `direct` se excluye (va en AggregateScore, no acá). */
const CHANNEL_ORDER = ['google', 'tripadvisor', 'booking', 'airbnb', 'expedia'] as const

const CHANNEL_LABELS: Record<string, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  airbnb: 'Airbnb',
  expedia: 'Expedia',
}

const wrapperClass = computed(() =>
  props.variant === 'compact'
    ? 'flex flex-wrap items-center gap-1.5'
    : 'flex flex-wrap items-center gap-2',
)

const badgeClass = computed(() =>
  props.variant === 'compact'
    ? 'inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[11px] text-navy hover:border-cyan transition'
    : 'inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs text-navy shadow-card hover:border-cyan transition',
)

const iconClass = computed(() =>
  props.variant === 'compact' ? 'w-3 h-3' : 'w-4 h-4',
)

const countClass = computed(() =>
  props.variant === 'compact' ? 'text-[10px] text-text-muted' : 'text-[11px] text-text-muted',
)

/**
 * Filtra y mapea perSource a la lista de badges visibles. Solo incluye fuentes con count > 0
 * Y con score válido (number > 0). `direct` se excluye (va en AggregateScore).
 */
const visibleSources = computed<SourceBadge[]>(() => {
  const perSource = props.aggregate?.perSource
  if (!perSource) return []
  const out: SourceBadge[] = []
  for (const channel of CHANNEL_ORDER) {
    const stat = perSource[channel]
    if (!stat) continue
    const count = Number(stat.count) || 0
    const score = Number(stat.score)
    if (count <= 0 || !Number.isFinite(score)) continue
    out.push({
      channel,
      label: CHANNEL_LABELS[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1),
      score,
      count,
      url: null,
      icon: iconForChannel(channel),
    })
  }
  return out
})

/** Ícono SVG inline por canal (sin importar librería externa). Cada uno es un FunctionalComponent
 *  que renderea un <svg> con viewBox 24x24 (mismo convención que Lucide / Heroicons). */
function iconForChannel(channel: string): FunctionalComponent {
  switch (channel) {
    case 'google':
      // Glyph "G" simplificado. Color oficial via currentColor + clases; usamos el multicolor
      // del brand solo cuando el variant es landing (mejor contraste sobre blanco).
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('path', { d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z', fill: '#4285F4' }),
          h('path', { d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z', fill: '#34A853' }),
          h('path', { d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z', fill: '#FBBC05' }),
          h('path', { d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z', fill: '#EA4335' }),
        ])
    case 'tripadvisor':
      // Owl minimalista (TripAdvisor brand). Single-color para no pelear con el brand oficial.
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('path', { d: 'M12 9.5c-2.6 0-5 1.5-6.3 3.5H3l1.5-2.2C3.7 11.2 3 12.5 3 14c0 2.8 2.2 5 5 5 1.7 0 3.2-.8 4-2.2.8 1.4 2.3 2.2 4 2.2 2.8 0 5-2.2 5-5 0-1.5-.7-2.8-1.5-3.2L20.5 13h-2.7c-1.3-2-3.7-3.5-6.3-3.5zM8 12.5c1.4 0 2.5 1.1 2.5 2.5S9.4 17.5 8 17.5 5.5 16.4 5.5 15s1.1-2.5 2.5-2.5zm8 0c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5zM8 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' }),
        ])
    case 'booking':
      // Booking.com: chunk "B." brand simplificado.
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('path', { d: 'M5 4h5.5a3.5 3.5 0 0 1 2.4 6 3.5 3.5 0 0 1-2.4 6H5V4zm3 2.5v2.7h2.5a1.35 1.35 0 1 0 0-2.7H8zm0 5v2.7h2.7a1.35 1.35 0 1 0 0-2.7H8z' }),
          h('path', { d: 'M17 7l1 1 1-1-1-1z M19 14l1 1 1-1-1-1z' }),
        ])
    case 'airbnb':
      // Airbnb glyph (A con corazón).
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('path', { d: 'M12 2c-.7 0-1.3.4-1.7 1C8.8 5.4 7 8.4 5.6 11.2c-.9 1.8-1.6 3.5-1.6 5 0 3.2 2.5 5.8 5.6 5.8 1.3 0 2.4-.5 3.4-1.3.4-.3.7-.6 1-.9.3.3.6.6 1 .9 1 1 2.1 1.5 3.4 1.5 3.1 0 5.6-2.6 5.6-5.8 0-1.6-.7-3.2-1.6-5C20.9 8.4 19.1 5.4 17.6 3c-.4-.6-1-1-1.7-1-.5 0-1 .2-1.4.7-.4.5-.5 1.1-.5 1.7 0 .6.2 1.1.5 1.6.3.5.7 1.1 1.1 1.8 1 1.6 2 3.4 2.7 5 .4.9.6 1.6.6 2.2 0 1.6-1.2 2.9-2.7 2.9-.6 0-1.2-.2-1.7-.7-.5-.4-.9-1-1.4-1.8-.4-.7-.9-1.4-1.6-1.4s-1.2.7-1.6 1.4c-.5.8-.9 1.4-1.4 1.8-.5.5-1.1.7-1.7.7-1.5 0-2.7-1.3-2.7-2.9 0-.6.2-1.3.6-2.2.7-1.6 1.7-3.4 2.7-5 .4-.7.8-1.3 1.1-1.8.3-.5.5-1 .5-1.6 0-.6-.1-1.2-.5-1.7C13 2.2 12.5 2 12 2z' }),
        ])
    case 'expedia':
      // Expedia: avioncito/globo simplificado.
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('path', { d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 14l-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7z' }),
        ])
    default:
      // Source no contemplada → círculo con inicial. Caemos acá si el backend agrega otra fuente
      // (ej. 'holiday_extra' / 'ornot') sin que el frontend la tenga catalogada todavía.
      return () =>
        h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' }, [
          h('circle', { cx: '12', cy: '12', r: '10' }),
        ])
  }
}
</script>
