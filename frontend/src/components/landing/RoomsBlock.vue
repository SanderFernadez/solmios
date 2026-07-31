<template>
  <!--
    RoomsBlock — Lista tipos de habitación con foto + "From $X" + CTA.
    Consume GET /api/public/hotels/:slug/rates (mapeado por el orquestador a PublicLandingRoom[]).
    Si `rooms` es null o vacío → el bloque NO renderiza (no se inventan precios).
    Config por CONTENIDO (showSpecs, featuredRoomId/featuredBadgeText) — sin variantes de layout.
  -->
  <section v-if="rooms && rooms.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header class="mb-10 text-center">
      <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Habitaciones</p>
      <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
    </header>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="room in rooms"
        :key="room.id"
        class="bg-white rounded-2xl border border-border overflow-hidden shadow-card hover:shadow-card-hover transition-all flex flex-col"
      >
        <div class="relative aspect-[4/3] bg-surface-dark overflow-hidden">
          <img
            v-if="room.photoUrl"
            :src="room.photoUrl"
            :alt="room.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
          <span
            v-if="isFeatured(room)"
            class="absolute top-3 left-3 bg-cyan text-navy text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-md"
          >
            {{ featuredBadgeText }}
          </span>
        </div>
        <div class="p-5 flex flex-col gap-3 flex-1">
          <h3 class="font-black text-navy text-lg leading-tight">{{ room.name }}</h3>
          <div v-if="specsLabel(room)" class="text-xs font-bold text-text-muted">
            {{ specsLabel(room) }}
          </div>
          <div class="mt-auto pt-2 flex items-end justify-between">
            <div v-if="room.fromPrice !== null && room.fromPrice !== undefined">
              <div class="text-[10px] uppercase tracking-wide text-text-muted">Desde</div>
              <div class="text-xl font-black text-navy">
                {{ formatPrice(room.fromPrice) }}<span class="text-xs font-bold text-text-muted ml-1">/noche</span>
              </div>
            </div>
            <router-link
              :to="bookingLink"
              class="bg-navy hover:bg-navy-light text-white text-xs font-extrabold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              {{ ctaText }}
            </router-link>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia, PublicLandingRoom } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
  rooms: PublicLandingRoom[] | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Alojamientos'
})

const ctaText = computed(() => {
  const c = typeof cfg.value.ctaText === 'string' ? cfg.value.ctaText.trim() : ''
  return c || 'Reservar'
})

// showSpecs: default true (config admin puede apagarlo explícitamente con false).
const showSpecs = computed(() => cfg.value.showSpecs !== false)

// featuredRoomId es, en la práctica, un roomType string (no un UUID físico — ver
// types/landing.ts:RoomsBlockConfig). Matchea contra room.id (= RoomTypeRate.id).
const featuredRoomId = computed(() => {
  const v = cfg.value.featuredRoomId
  return typeof v === 'string' && v.length > 0 ? v : null
})

const featuredBadgeText = computed(() => {
  const t = typeof cfg.value.featuredBadgeText === 'string' ? cfg.value.featuredBadgeText.trim() : ''
  return t || 'Más reservada'
})

function isFeatured(room: PublicLandingRoom): boolean {
  return featuredRoomId.value !== null && featuredRoomId.value === room.id
}

function specsLabel(room: PublicLandingRoom): string {
  if (!showSpecs.value) return ''
  const parts: string[] = []
  if (typeof room.capacity === 'number' && room.capacity > 0) {
    parts.push(`${room.capacity} adulto${room.capacity === 1 ? '' : 's'}`)
  }
  if (typeof room.surfaceArea === 'number' && room.surfaceArea > 0) {
    parts.push(`${room.surfaceArea} m²`)
  }
  return parts.join(' · ')
}

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)

function formatPrice(amount: number): string {
  try {
    return new Intl.NumberFormat('es', {
      style: 'currency',
      currency: props.hotel.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${Math.round(amount)}`
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
