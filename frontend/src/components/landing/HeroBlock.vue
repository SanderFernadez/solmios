<template>
  <!--
    HeroBlock — banda superior con título/subtitle/CTA sobre imagen (media.hero[0]) o gradiente.
    El CTA lleva a /book/:slug (widget F0). Si no hay imagen hero, cae a gradiente navy→blue.
    Sin texto configurado → usa hotel.name + description (i18n ya resuelto por el backend).
  -->
  <section class="relative isolate overflow-hidden min-h-[78vh] flex items-end">
    <!-- Fondo -->
    <div class="absolute inset-0 -z-10">
      <img
        v-if="backgroundImage"
        :src="backgroundImage"
        :alt="hotel.name"
        class="w-full h-full object-cover"
        loading="eager"
        fetchpriority="high"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-navy via-navy-light to-blue" />
      <!-- Overlay legibilidad (siempre, incluso con imagen) -->
      <div class="absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/40 to-navy/20" />
    </div>

    <div class="max-w-6xl mx-auto w-full px-6 pb-16 pt-32 sm:pb-20">
      <div class="max-w-2xl">
        <!-- Estrellas + tipo -->
        <div class="flex items-center gap-3 mb-4 text-white/90">
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
        <p v-if="subtitle" class="mt-5 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
          {{ subtitle }}
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
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

const backgroundImage = computed(() => {
  // backgroundMediaId se resuelve contra media.hero (si viene); si no, la primera hero disponible.
  const heroList = props.media?.hero ?? []
  if (heroList.length === 0) return null
  const wantedId = typeof cfg.value.backgroundMediaId === 'string' ? cfg.value.backgroundMediaId : null
  const wanted = wantedId ? heroList.find((m) => m.id === wantedId) : null
  return (wanted ?? heroList[0]).url
})

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)

const starCount = computed(() => {
  const n = Number(props.hotel.starRating)
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 0
})

// accommodationType viene como slug ('hotel'|'hostel'|'resort'...) — capitalizo para display.
const accommodationTypeLabel = computed(() => {
  const raw = (props.hotel.accommodationType || '').toString()
  if (!raw) return ''
  return raw.charAt(0).toUpperCase() + raw.slice(1)
})
</script>

<style scoped>
.success-light { color: #6EE7B7; }
</style>
