<template>
  <!--
    MapBlock — mapa embebido de Google Maps (sin API key, formato público de "compartir mapa"
    con `output=embed`) centrado en [hotel.latitude, hotel.longitude].

    GUARD de coords: si hotel.latitude=0 y hotel.longitude=0 (o fuera de rango) → NO renderizo
    nada (spec acceptance: "hotel.latitude=0 → el bloque no se renderiza"). El orquestador
    también OMITE el bloque por v-if — doble guard acá.

    FIX 2026-08-01 (pedido de usuario) — antes usaba Leaflet + tiles de OpenStreetMap con
    lazy-load manual vía IntersectionObserver + dynamic import. Reemplazado por un <iframe>:
    sin dependencia extra en el bundle, lazy-load nativo del browser (`loading="lazy"`) en vez
    de un observer a mano.
  -->
  <section v-if="hasValidCoords" class="bg-surface border-y border-border">
    <div class="max-w-6xl mx-auto px-6 py-16">
      <header class="mb-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Ubicación</p>
          <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
          <p v-if="description" class="mt-3 text-sm text-text-secondary max-w-2xl leading-relaxed">
            {{ description }}
          </p>
          <p v-else-if="fullAddress" class="mt-3 text-sm text-text-muted">{{ fullAddress }}</p>
        </div>
        <a
          v-if="externalMapUrl"
          :href="externalMapUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden sm:inline-flex items-center gap-2 text-xs font-bold text-cyan hover:text-cyan-light transition-colors whitespace-nowrap"
        >
          Ver en Google Maps ↗
        </a>
      </header>

      <div
        class="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-border bg-surface-dark shadow-card"
      >
        <iframe
          :src="mapSrc"
          width="100%"
          height="100%"
          style="border: 0"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
          :title="`Mapa — ${hotel.name}`"
        />
      </div>

      <a
        v-if="externalMapUrl"
        :href="externalMapUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="sm:hidden mt-3 inline-flex items-center gap-2 text-xs font-bold text-cyan"
      >
        Ver en Google Maps ↗
      </a>
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
  return t || 'Cómo llegar'
})

const description = computed(() => {
  const d = typeof cfg.value.description === 'string' ? cfg.value.description.trim() : ''
  return d || ''
})

const fullAddress = computed(() => {
  const parts = [
    props.hotel.address,
    props.hotel.locality,
    props.hotel.municipality,
    props.hotel.province,
    props.hotel.postalCode,
  ].filter((p): p is string => Boolean(p && p.trim()))
  return parts.join(', ')
})

// GUARD: si lat o lng son 0/null/NaN o fuera de rango → bloque entero omitido.
const hasValidCoords = computed(() => {
  const { latitude, longitude } = props.hotel
  return (
    typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    !(latitude === 0 && longitude === 0) &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  )
})

// Embed público de Google Maps (sin API key): formato clásico "compartir mapa" con output=embed.
const mapSrc = computed(() => {
  if (!hasValidCoords.value) return ''
  const { latitude, longitude } = props.hotel
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`
})

const externalMapUrl = computed(() => {
  if (!hasValidCoords.value) return null
  const { latitude, longitude } = props.hotel
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
})
</script>
