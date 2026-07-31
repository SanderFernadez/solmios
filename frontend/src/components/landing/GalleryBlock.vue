<template>
  <!--
    GalleryBlock — grilla de fotos (media.gallery). 3 variants por templateId:
    - classic (default): grid 4-col con primera foto grande (col-span-2 row-span-2).
    - modern: masonry vía CSS `columns` (2 desktop / 1 mobile), items con break-inside-avoid.
    - boutique: editorial 2-col con fotos más altas (auto-rows-[280px]), sin foto grande.
    Si NO hay media.gallery, el orquestador no debería renderizar este bloque (v-if allá); acá
    guard con v-if="photos.length > 0" por si lo activan sin fotos. Tailwind purge: utilities
    literales en cada branch (no en computed strings).
  -->
  <section v-if="photos.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header v-if="title" class="mb-8 flex items-end justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Galería</p>
        <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
      </div>
      <p class="hidden sm:block text-sm text-text-muted">{{ photos.length }} fotos</p>
    </header>

    <!-- ─── classic: grid 4-col con foto grande ─────────────────────────── -->
    <div
      v-if="templateId === 'classic'"
      class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 auto-rows-[160px] sm:auto-rows-[200px]"
    >
      <button
        v-for="(p, i) in photos.slice(0, 8)"
        :key="p.id"
        type="button"
        class="group relative overflow-hidden rounded-2xl bg-surface-dark cursor-pointer"
        :class="i === 0 ? 'col-span-2 row-span-2' : ''"
        @click="openLightbox(i)"
      >
        <img
          :src="p.url"
          :alt="p.alt || hotel.name"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span v-if="i === 7 && photos.length > 8" class="absolute inset-0 bg-navy/60 flex items-center justify-center text-white font-extrabold text-lg">
          +{{ photos.length - 8 }}
        </span>
        <!-- Nombre puesto en el admin (antes solo iba al alt invisible del <img>) -->
        <span
          v-if="p.alt"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent px-3 py-2 text-left text-xs font-bold text-white truncate"
        >{{ p.alt }}</span>
      </button>
    </div>

    <!-- ─── modern: masonry (CSS columns) ──────────────────────────────── -->
    <div
      v-else-if="templateId === 'modern'"
      class="columns-1 sm:columns-2 gap-3 sm:gap-4"
    >
      <button
        v-for="(p, i) in photos.slice(0, 8)"
        :key="p.id"
        type="button"
        class="group relative overflow-hidden rounded-2xl bg-surface-dark cursor-pointer mb-3 sm:mb-4 break-inside-avoid block w-full"
        @click="openLightbox(i)"
      >
        <img
          :src="p.url"
          :alt="p.alt || hotel.name"
          class="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span v-if="i === 7 && photos.length > 8" class="absolute inset-0 bg-navy/60 flex items-center justify-center text-white font-extrabold text-lg">
          +{{ photos.length - 8 }}
        </span>
        <!-- Nombre puesto en el admin (antes solo iba al alt invisible del <img>) -->
        <span
          v-if="p.alt"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent px-3 py-2 text-left text-xs font-bold text-white truncate"
        >{{ p.alt }}</span>
      </button>
    </div>

    <!-- ─── boutique: editorial 2-col, fotos altas ─────────────────────── -->
    <div
      v-else
      class="grid grid-cols-2 gap-3 sm:gap-4 auto-rows-[280px]"
    >
      <button
        v-for="(p, i) in photos.slice(0, 8)"
        :key="p.id"
        type="button"
        class="group relative overflow-hidden rounded-xl bg-surface-dark cursor-pointer"
        @click="openLightbox(i)"
      >
        <img
          :src="p.url"
          :alt="p.alt || hotel.name"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span v-if="i === 7 && photos.length > 8" class="absolute inset-0 bg-navy/60 flex items-center justify-center text-white font-extrabold text-lg">
          +{{ photos.length - 8 }}
        </span>
        <!-- Nombre puesto en el admin (antes solo iba al alt invisible del <img>) -->
        <span
          v-if="p.alt"
          class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent px-3 py-2 text-left text-xs font-bold text-white truncate"
        >{{ p.alt }}</span>
      </button>
    </div>

    <!-- Lightbox — navegable (adelante/atrás + teclado), compartido entre las 3 variants.
         Navega sobre `photos` COMPLETO (no el `.slice(0,8)` de la grilla): si hay más de 8
         fotos, las que no entran en la grilla igual se pueden ver avanzando desde la última. -->
    <div v-if="lightboxIndex !== null" class="fixed inset-0 z-50 bg-navy/95 flex items-center justify-center p-4" @click="closeLightbox">
      <button type="button" class="absolute top-4 right-6 text-white/80 hover:text-white text-3xl font-light cursor-pointer" aria-label="Cerrar" @click.stop="closeLightbox">×</button>

      <span v-if="photos.length > 1" class="absolute top-5 left-6 text-white/70 text-sm font-bold tabular-nums">
        {{ lightboxIndex + 1 }} / {{ photos.length }}
      </span>

      <button
        v-if="photos.length > 1"
        type="button"
        class="absolute left-2 sm:left-6 text-white/80 hover:text-white text-4xl font-light cursor-pointer w-12 h-12 grid place-items-center rounded-full hover:bg-white/10"
        aria-label="Foto anterior"
        @click.stop="prevPhoto"
      >‹</button>

      <img
        :src="photos[lightboxIndex].url"
        :alt="photos[lightboxIndex].alt || hotel.name"
        class="max-h-[88vh] max-w-[92vw] object-contain rounded-lg"
        @click.stop
      />

      <button
        v-if="photos.length > 1"
        type="button"
        class="absolute right-2 sm:right-6 text-white/80 hover:text-white text-4xl font-light cursor-pointer w-12 h-12 grid place-items-center rounded-full hover:bg-white/10"
        aria-label="Foto siguiente"
        @click.stop="nextPhoto"
      >›</button>

      <span
        v-if="photos[lightboxIndex].alt"
        class="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[85vw] truncate text-center text-sm font-bold text-white/90"
        @click.stop
      >{{ photos[lightboxIndex].alt }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import type { LandingBlock, LandingTheme, LandingTemplateId, PublicHotelInfo, PublicHotelMedia, PublicMediaItem } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

const themeRef = inject<import('vue').Ref<LandingTheme | null>>('landingTheme')
const templateId = computed<LandingTemplateId>(() => themeRef?.value?.templateId ?? 'classic')

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Galería'
})

const photos = computed<PublicMediaItem[]>(() => props.media?.gallery ?? [])

const lightboxIndex = ref<number | null>(null)
function openLightbox(i: number) {
  lightboxIndex.value = i
}
function closeLightbox() {
  lightboxIndex.value = null
}
function nextPhoto() {
  if (lightboxIndex.value === null || photos.value.length === 0) return
  lightboxIndex.value = (lightboxIndex.value + 1) % photos.value.length
}
function prevPhoto() {
  if (lightboxIndex.value === null || photos.value.length === 0) return
  lightboxIndex.value = (lightboxIndex.value - 1 + photos.value.length) % photos.value.length
}

function onKeydown(e: KeyboardEvent) {
  if (lightboxIndex.value === null) return
  if (e.key === 'ArrowRight') nextPhoto()
  else if (e.key === 'ArrowLeft') prevPhoto()
  else if (e.key === 'Escape') closeLightbox()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
