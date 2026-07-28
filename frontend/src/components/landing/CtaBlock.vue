<template>
  <!--
    CtaBlock — banda final con CTA grande al widget /book/:slug.
    Sin texto configurado → defaults en español. Siempre renderizable (no depende de data externa).
  -->
  <section class="bg-gradient-to-br from-navy via-navy-light to-blue relative overflow-hidden">
    <div class="absolute inset-0 opacity-20" aria-hidden="true">
      <div class="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-cyan/40 blur-3xl" />
      <div class="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-teal-light/30 blur-3xl" />
    </div>

    <div class="relative max-w-4xl mx-auto px-6 py-20 text-center">
      <h2 class="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
        {{ title }}
      </h2>
      <p v-if="subtitle" class="mt-5 text-base sm:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
        {{ subtitle }}
      </p>
      <router-link
        :to="bookingLink"
        class="inline-flex items-center gap-2 mt-9 bg-cyan hover:bg-cyan-light transition-colors text-navy font-extrabold text-base px-9 py-4 rounded-xl shadow-lg cursor-pointer"
      >
        {{ buttonText }}
        <span aria-hidden="true">→</span>
      </router-link>

      <div v-if="hotel.checkIn || hotel.checkOut" class="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-white/70 font-bold">
        <span v-if="hotel.checkIn">🕐 Check-in: {{ hotel.checkIn }}</span>
        <span v-if="hotel.checkOut">🕐 Check-out: {{ hotel.checkOut }}</span>
        <span v-if="hotel.freeCancellation" class="text-success-light">✓ Cancelación gratuita</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Reservá tu próxima estadía'
})

const subtitle = computed(() => {
  const s = typeof cfg.value.subtitle === 'string' ? cfg.value.subtitle.trim() : ''
  return s || `Mejor precio garantizado en ${props.hotel.name}.`
})

const buttonText = computed(() => {
  const b = typeof cfg.value.buttonText === 'string' ? cfg.value.buttonText.trim() : ''
  return b || 'Reservar ahora'
})

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)
</script>

<style scoped>
.success-light { color: #6EE7B7; }
</style>
