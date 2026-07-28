<template>
  <!--
    MapBlock — mapa Leaflet con marker en [hotel.latitude, hotel.longitude].
    LAZY-LOAD obligatorio (spec landing-builder): Leaflet (JS + CSS) NO se carga hasta que el
    bloque entra en viewport (IntersectionObserver). Recién ahí hago `await import('leaflet')`.

    GUARD de coords: si hotel.latitude=0 y hotel.longitude=0 (o fuera de rango) → NO renderizo
    nada (spec acceptance: "hotel.latitude=0 → el bloque no se renderiza"). El orquestador
    también OMITE el bloque por v-if — doble guard acá.

    Uso Leaflet vanilla sobre un `ref` (más simple que @vue-leaflet/vue-leaflet, sin extra deps
    reactivas que no necesitamos para 1 marker estático).
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
          Ver en OpenStreetMap ↗
        </a>
      </header>

      <!--
        El contenedor del mapa. Lo monto siempre (con guard hasValidCoords), pero Leaflet
        recién arranca cuando `visible=true` (IntersectionObserver dispara). Placeholder
        visual hasta que cargue.
      -->
      <div
        ref="containerRef"
        class="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-border bg-surface-dark shadow-card"
      >
        <div v-if="!mapReady" class="absolute inset-0 flex items-center justify-center">
          <div class="text-text-muted text-sm">Cargando mapa…</div>
        </div>
        <!-- Leaflet pinta acá adentro cuando arranca -->
      </div>

      <a
        v-if="externalMapUrl"
        :href="externalMapUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="sm:hidden mt-3 inline-flex items-center gap-2 text-xs font-bold text-cyan"
      >
        Ver en OpenStreetMap ↗
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'

// Import TIPO-only (se borra en runtime, no entra al bundle).
import type * as Leaflet from 'leaflet'

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

const externalMapUrl = computed(() => {
  if (!hasValidCoords.value) return null
  const { latitude, longitude } = props.hotel
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`
})

// ── Lazy-load del mapa ─────────────────────────────────────────────────────
const containerRef = ref<HTMLElement | null>(null)
const mapReady = ref(false)
let mapInstance: Leaflet.Map | null = null
let observer: IntersectionObserver | null = null
let leafletModule: typeof Leaflet | null = null

async function bootstrapMap() {
  if (mapInstance || !containerRef.value || !hasValidCoords.value) return

  // Dynamic import: Leaflet (y su CSS) NO entran al bundle principal ni se descargan
  // hasta este punto. Spec landing-builder "Lazy-load".
  const L = await import('leaflet')
  leafletModule = L
  // CSS también viene del package (Vite lo inyecta como <style> en runtime, no como <link>).
  await import('leaflet/dist/leaflet.css')

  if (!containerRef.value) return // el usuario pudo navegar fuera mientras cargaba

  const { latitude, longitude } = props.hotel
  mapInstance = L.map(containerRef.value, {
    center: [latitude, longitude],
    zoom: 15,
    scrollWheelZoom: false, // UX: scroll dentro del mapa no captura la rueda del page.
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapInstance)

  const marker = L.marker([latitude, longitude]).addTo(mapInstance)
  if (props.hotel.name) marker.bindPopup(props.hotel.name)

  mapReady.value = true
}

function teardownMap() {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
  mapReady.value = false
}

onMounted(() => {
  if (!containerRef.value) return
  // IntersectionObserver para disparar el lazy-load cuando el bloque es visible.
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void bootstrapMap()
            observer?.disconnect()
            observer = null
            break
          }
        }
      },
      { rootMargin: '200px' }, // un poco antes para que arranque sin que el usuario vea el placeholder
    )
    observer.observe(containerRef.value)
  } else {
    // Fallback (browser viejo): lazy-load inmediato.
    void bootstrapMap()
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  teardownMap()
})

// Si las coords cambian (raro en runtime pero posible tras re-fetch) → reseteo el mapa.
watch(() => [props.hotel.latitude, props.hotel.longitude], () => {
  teardownMap()
  if (leafletModule && containerRef.value) void bootstrapMap()
})
</script>

<style scoped>
/* Leaflet necesita altura explícita en su container — dada acá via Tailwind (h-[360px]).
   Estilos internos de Leaflet (zoom control, popup) vienen del CSS importado. */
</style>
