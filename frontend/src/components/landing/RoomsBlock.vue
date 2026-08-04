<template>
  <!--
    RoomsBlock — Lista tipos de habitación con foto + "From $X" + CTA.
    Consume GET /api/public/hotels/:slug/rates (mapeado por el orquestador a PublicLandingRoom[]).
    Si `rooms` es null o vacío → el bloque NO renderiza (no se inventan precios).
    Config por CONTENIDO (showSpecs, featuredRoomId/featuredBadgeText) — sin variantes de layout.

    CTA: dentro de la landing abre `BookingModal` con ESA habitación preseleccionada
    (`provideLandingBooking`), sin sacar al huésped de la página. Fuera de la landing (o si el
    provider no está) cae al link de siempre hacia `/book/:slug`, el widget embebible.
  -->
  <section v-if="rooms && rooms.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header class="mb-10 flex items-end justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Habitaciones</p>
        <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
        <p class="mt-1.5 text-sm text-text-secondary">Diseñadas para tu confort y descanso.</p>
      </div>
      <button
        v-if="openBooking"
        type="button"
        class="hidden sm:inline-flex items-center gap-1.5 text-xs font-extrabold text-navy hover:text-cyan transition-colors shrink-0 cursor-pointer"
        @click="openBooking()"
      >
        Ver todas las habitaciones
        <span aria-hidden="true">→</span>
      </button>
      <router-link
        v-else
        :to="bookingLink"
        class="hidden sm:inline-flex items-center gap-1.5 text-xs font-extrabold text-navy hover:text-cyan transition-colors shrink-0 cursor-pointer"
      >
        Ver todas las habitaciones
        <span aria-hidden="true">→</span>
      </router-link>
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
            class="absolute top-3 left-3 inline-flex items-center gap-1 bg-gold text-navy text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-md"
          >
            <span v-html="ICON_STAR" />
            {{ featuredBadgeText }}
          </span>
        </div>
        <div class="p-5 flex flex-col gap-3 flex-1">
          <h3 class="font-black text-navy text-lg leading-tight">{{ room.name }}</h3>
          <div v-if="specParts(room).length > 0" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-text-muted">
            <span v-for="(part, i) in specParts(room)" :key="i" class="inline-flex items-center gap-1">
              <span v-html="part.icon" />
              {{ part.label }}
            </span>
          </div>
          <div class="mt-auto pt-3 border-t border-border flex items-end justify-between">
            <div v-if="room.fromPrice !== null && room.fromPrice !== undefined">
              <div class="text-[10px] uppercase tracking-wide text-text-muted">Desde</div>
              <div class="text-xl font-black text-navy">
                {{ formatPrice(pricePerNight(room)) }}<span class="text-xs font-bold text-text-muted ml-1">/noche</span>
              </div>
            </div>
            <button
              v-if="openBooking"
              type="button"
              class="bg-navy hover:bg-navy-light text-white text-xs font-extrabold px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              @click="openBooking({ roomTypeId: room.id })"
            >
              {{ ctaText }}
            </button>
            <router-link
              v-else
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
import { useLandingBooking } from '@/composables/useLandingBooking'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia, PublicLandingRoom } from '@/types'

const ICON_USER = '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5"/></svg>'
const ICON_RULER = '<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v3M11 7v3M15 7v3"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3L22 9.3l-5 4.8 1.2 6.9L12 17.8l-6.2 3.2L7 14.1 2 9.3l7.1-1z"/></svg>'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
  rooms: PublicLandingRoom[] | null
  /**
   * Noches del rango indicativo con el que el orquestador pidió `GET /rates`
   * (hotel-landing.vue). Necesario porque `room.fromPrice` es el TOTAL de la estadía para
   * ese type (ver types/booking.ts:RoomTypeRate.fromPrice), NO el precio por noche — sin
   * dividir, la landing publicaba el total rotulado "/noche" (≈ el doble del precio real).
   * Opcional para que el bloque siga renderizando si se usa aislado (default 1 noche).
   */
  roomsNights?: number
}>()

/** `null` fuera de la landing → el CTA vuelve a ser un link al widget. */
const openBooking = useLandingBooking()

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

function specParts(room: PublicLandingRoom): { icon: string; label: string }[] {
  if (!showSpecs.value) return []
  const parts: { icon: string; label: string }[] = []
  if (typeof room.capacity === 'number' && room.capacity > 0) {
    parts.push({ icon: ICON_USER, label: `${room.capacity} adulto${room.capacity === 1 ? '' : 's'}` })
  }
  if (typeof room.surfaceArea === 'number' && room.surfaceArea > 0) {
    parts.push({ icon: ICON_RULER, label: `${room.surfaceArea} m²` })
  }
  return parts
}

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)

/** Noches del rango indicativo, saneadas (>0). Mismo criterio que el widget en
 *  components/booking/RoomsStep.vue:perNight (`store.nights > 0 ? store.nights : 1`). */
const nights = computed(() => {
  const n = Number(props.roomsNights)
  return Number.isFinite(n) && n > 0 ? n : 1
})

/** `fromPrice` es el TOTAL de la estadía → dividir por las noches del rango consultado.
 *  El redondeo lo hace `formatPrice` (maximumFractionDigits: 0), como en el resto del bloque. */
function pricePerNight(room: PublicLandingRoom): number {
  return (room.fromPrice ?? 0) / nights.value
}

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
