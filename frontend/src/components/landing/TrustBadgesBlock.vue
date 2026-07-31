<template>
  <!--
    TrustBadgesBlock — fila de sellos de confianza debajo del hero (F1 hero-search-rooms-content).
    Config: {title?, items: [{icon, text}]}. El backend siembra 5 items por default (rate, refund,
    secure, no-fee, direct) en `landing/usecases/defaults.ts`. Mismo patrón de icon-map por emoji
    que AmenitiesBlock.vue, pero en una barra más angosta/compacta (línea de sellos, no grid de
    amenidades): iconos chicos, sin card con borde pesado.
  -->
  <section v-if="items.length > 0" class="max-w-6xl mx-auto px-6 py-10">
    <header v-if="title" class="mb-6 text-center">
      <h2 class="text-lg font-black text-navy tracking-tight">{{ title }}</h2>
    </header>

    <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-10">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="flex items-center gap-2.5"
      >
        <span class="text-base leading-none">{{ iconFor(item.icon) }}</span>
        <span class="text-xs sm:text-sm font-bold text-navy leading-tight">{{ item.text }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia, TrustBadgeItem } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t
})

const items = computed<TrustBadgeItem[]>(() => {
  const raw = cfg.value.items
  if (!Array.isArray(raw)) return []
  return raw.filter((it): it is TrustBadgeItem =>
    typeof it === 'object' && it !== null &&
    typeof (it as TrustBadgeItem).icon === 'string' &&
    typeof (it as TrustBadgeItem).text === 'string' &&
    (it as TrustBadgeItem).text.trim().length > 0)
})

// Map de icon key → emoji. Las 5 keys sembradas por el backend (defaults.ts) + variedad extra
// razonable para el admin. Lo que no matchea usa ✦ (mismo criterio que AmenitiesBlock.ICONS).
const ICONS: Record<string, string> = {
  rate: '🏆', refund: '🔄', secure: '🔒', 'no-fee': '💳', direct: '✅',
  support: '🎧', 'best-price': '💰', instant: '⚡',
}

function iconFor(icon: string): string {
  return ICONS[icon] ?? '✦'
}
</script>
