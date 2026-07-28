<template>
  <!--
    AmenitiesBlock — chips de amenidades (hotel.amenities: string[]).
    Si hotel.amenities es null/[] el orquestador OMITE este bloque (v-if allá); doble guard acá.
  -->
  <section v-if="amenities.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header v-if="title" class="mb-8 text-center">
      <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Servicios</p>
      <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
    </header>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <div
        v-for="a in amenities"
        :key="a"
        class="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3.5 hover:border-cyan/50 hover:shadow-card transition-all"
      >
        <span class="text-xl w-8 h-8 flex items-center justify-center rounded-lg bg-cyan/10">{{ iconFor(a) }}</span>
        <span class="text-sm font-bold text-navy leading-tight">{{ labelFor(a) }}</span>
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
  return t || 'Comodidades'
})

const amenities = computed<string[]>(() => props.hotel.amenities ?? [])

// Map de amenity slug → emoji. Catálogo razonable; lo que no matchea usa ✦.
// Esto es cosmético, no afecta datos ni SEO.
const ICONS: Record<string, string> = {
  wifi: '📶', 'wi-fi': '📶', internet: '📶',
  pool: '🏊', piscina: '🏊',
  parking: '🅿️', estacionamiento: '🅿️',
  breakfast: '🥐', desayuno: '🥐',
  ac: '❄️', 'aire-acondicionado': '❄️', air_conditioning: '❄️',
  gym: '🏋️', gimnasio: '🏋️',
  spa: '💆',
  restaurant: '🍽️', restaurante: '🍽️',
  bar: '🍸',
  tv: '📺',
  'room-service': '🛎️', servicio_habitacion: '🛎️',
  pets: '🐕', mascotas: '🐕',
  beach: '🏖️', playa: '🏖️',
  laundry: '🧺', lavanderia: '🧺',
  kitchen: '🍳', cocina: '🍳',
  tv_cable: '📺', cable: '📺',
  safe: '🔒', caja_fuerte: '🔒',
  elevator: '🛗', ascensor: '🛗',
  garden: '🌳', jardin: '🌳',
  terrace: '☀️', terraza: '☀️',
}

function iconFor(a: string): string {
  const key = a.toLowerCase().trim().replace(/\s+/g, '_')
  return ICONS[key] ?? '✦'
}

function labelFor(a: string): string {
  // Si es slug kebab/snake → capitalizo palabras; si ya es texto con espacios lo dejo.
  if (a.includes(' ')) return a
  return a
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
</script>
