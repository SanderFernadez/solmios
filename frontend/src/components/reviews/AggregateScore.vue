<template>
  <!--
    AggregateScore.vue — Score agregado destacado (F3 3.16, solmi-direct-booking).
    Renderiza el promedio global de TODAS las fuentes (directas + externas) con estrellas
    visuales + count total. Es el "SOLMI Score" del spec reputation-aggregator/spec.md:173.

    Props:
      - aggregate: si es null o count=0 → NO renderiza (v-if caller decide; acá doble guard).
      - score null (publishReviewScore=false) → muestra solo count, sin score (spec 0.11).
      - variant 'hero' | 'inline':
          · 'hero' (default): grande, con círculo de color + label "Score agregado".
          · 'inline': compacto inline para inyectar en ReviewsBlock junto a los badges.

    Diferencia con MultiChannelBadges: este componente muestra el PROMEDIO global; el hermano
    muestra el breakdown por canal. Ambos se inyectan juntos en el ReviewsBlock.
  -->
  <div
    v-if="aggregate && aggregate.count > 0"
    :class="wrapperClass"
  >
    <!-- Score numérico. Si publishReviewScore=false, score viene null → mostramos solo count. -->
    <div :class="scoreBoxClass">
      <span v-if="aggregate.score !== null" class="font-black tabular-nums leading-none" :class="scoreNumberClass">
        {{ aggregate.score.toFixed(1) }}
      </span>
      <span v-else class="font-black leading-none" :class="scoreNumberClass">—</span>
      <span v-if="aggregate.score !== null" class="text-text-muted" :class="maxLabelClass">/ 5</span>
    </div>

    <div :class="textColClass">
      <!-- Estrellas (solo si hay score). Score redondeado al entero más cercano. -->
      <div v-if="aggregate.score !== null" :class="[starsClass, 'flex items-center gap-0.5 [&_svg]:w-3.5 [&_svg]:h-3.5']" aria-hidden="true">
        <span class="text-gold-light flex" v-html="starRow(aggregate.score ?? 0)" />
      </div>
      <p :class="countLabelClass">
        {{ countLabel }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublicReviewAggregate } from '@/types'
import { starRow } from '@/components/landing/landing-icons'

type Variant = 'hero' | 'inline'

const props = withDefaults(defineProps<{
  aggregate: PublicReviewAggregate | null
  variant?: Variant
  /** Texto del label cuando hay score. Default "Reseñas verificadas". */
  label?: string
}>(), {
  variant: 'hero',
  label: 'Reseñas verificadas',
})

const wrapperClass = computed(() =>
  props.variant === 'hero'
    ? 'flex items-center gap-4 bg-white rounded-2xl border border-border px-5 py-3 shadow-card'
    : 'flex items-center gap-2',
)

const scoreBoxClass = computed(() =>
  props.variant === 'hero'
    ? 'flex items-baseline gap-1 text-navy'
    : 'flex items-baseline gap-0.5 text-navy',
)

const scoreNumberClass = computed(() => {
  if (props.aggregate?.score === null || props.aggregate?.score === undefined) {
    return props.variant === 'hero' ? 'text-3xl' : 'text-base'
  }
  return props.variant === 'hero' ? 'text-3xl' : 'text-base'
})

const maxLabelClass = computed(() =>
  props.variant === 'hero' ? 'text-sm' : 'text-[10px]',
)

const textColClass = computed(() =>
  props.variant === 'hero' ? 'flex flex-col gap-1' : 'flex flex-col',
)

const starsClass = computed(() =>
  props.variant === 'hero' ? 'text-sm leading-none' : 'text-xs leading-none',
)

const countLabelClass = computed(() =>
  props.variant === 'hero'
    ? 'text-[11px] uppercase tracking-wide text-text-muted'
    : 'text-[11px] text-text-muted',
)

const countLabel = computed(() => {
  const n = props.aggregate?.count ?? 0
  if (n === 1) return `1 ${props.label}`
  return `${n} ${props.label}`
})
</script>
