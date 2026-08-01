<template>
  <!--
    MapBlock — mapa de [hotel.latitude, hotel.longitude], 2 tiers:
      - CON `hotel.googleMapsApiKey` (resuelta server-side, config KV `google_maps`): SDK de
        Google Maps real vía `useGoogleMaps.ts` — mapa interactivo (zoom/pan), mismo mecanismo
        que ya usa el admin en `pages/settings/index.vue` (issue GitLab #426).
      - SIN key (o si la key falla/está restringida a otro dominio): <iframe> embed público
        (`output=embed`), sin key, lazy-load nativo (`loading="lazy"`). Degradación, no error.

    GUARD de coords: si hotel.latitude=0 y hotel.longitude=0 (o fuera de rango) → NO renderizo
    nada (spec acceptance: "hotel.latitude=0 → el bloque no se renderiza"). El orquestador
    también OMITE el bloque por v-if — doble guard acá.
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

      <!--
        FIX (verificado en local con key dummy) — `mapContainerRef` NUNCA puede tener hijos
        gestionados por Vue: `google.maps.Map` toma control total del DOM interno del elemento
        que se le pasa, y si Vue intenta después sacar un `v-if` de ADENTRO de ese mismo
        elemento (el `<iframe>`), revienta con "Cannot read properties of null (reading
        'insertBefore')" — Google ya movió/borró el nodo que Vue esperaba encontrar. Por eso acá
        van DOS elementos hermanos, no uno anidado: el iframe (Vue lo controla) y un div vacío
        aparte (Google lo controla, Vue nunca le toca los hijos).
      -->
      <div class="relative w-full h-[360px] sm:h-[440px] rounded-2xl overflow-hidden border border-border bg-surface-dark shadow-card">
        <iframe
          v-if="!sdkReady"
          :src="mapSrc"
          width="100%"
          height="100%"
          style="border: 0"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
          :title="`Mapa — ${hotel.name}`"
        />
        <div v-show="sdkReady" ref="mapContainerRef" class="absolute inset-0" />
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'
import { loadGoogleMaps } from '@/composables/useGoogleMaps'

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

// ── Tier interactivo (SDK) — solo si hay key Y el bloque entró en viewport ────────────────
const mapContainerRef = ref<HTMLElement | null>(null)
const sdkReady = ref(false)
let mapInstance: google.maps.Map | null = null
let markerInstance: google.maps.Marker | null = null
let observer: IntersectionObserver | null = null

async function bootstrapInteractiveMap(): Promise<void> {
  const key = props.hotel.googleMapsApiKey
  if (!key || !hasValidCoords.value) return // sin key o coords inválidas → se queda con el iframe

  const maps = await loadGoogleMaps(key)
  if (!maps || !mapContainerRef.value) return // key inválida/restringida/carga falló (gm_authFailure) → iframe (sdkReady sigue false)

  // FIX (verificado en local con key dummy) — `mapContainerRef` está en `v-show="sdkReady"`,
  // o sea `display:none` hasta acá. Construir `google.maps.Map` sobre un contenedor con
  // display:none le da 0×0 de tamaño y el SDK revienta adentro (IntersectionObserver interno
  // sobre un nodo sin layout). Por eso el orden es: primero revelar el contenedor (sdkReady=true
  // saca el `display:none`), esperar el próximo tick para que Vue aplique el cambio al DOM real,
  // RECIÉN AHÍ construir el mapa — nunca al revés.
  sdkReady.value = true
  await nextTick()
  if (!mapContainerRef.value) return // el componente se desmontó mientras esperaba el tick

  const { latitude, longitude } = props.hotel
  mapInstance = new maps.Map(mapContainerRef.value, {
    center: { lat: latitude, lng: longitude },
    zoom: 15,
    disableDefaultUI: false,
    scrollwheel: false, // UX: scroll dentro del mapa no captura la rueda del page (mismo criterio que el mapa admin).
  })
  markerInstance = new maps.Marker({ position: { lat: latitude, lng: longitude }, map: mapInstance, title: props.hotel.name })
}

function teardownInteractiveMap(): void {
  markerInstance = null
  mapInstance = null
  sdkReady.value = false
}

onMounted(() => {
  if (!mapContainerRef.value) return
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void bootstrapInteractiveMap()
            observer?.disconnect()
            observer = null
            break
          }
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(mapContainerRef.value)
  } else {
    void bootstrapInteractiveMap() // fallback browser viejo sin IntersectionObserver: carga inmediata
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  teardownInteractiveMap()
})
</script>
