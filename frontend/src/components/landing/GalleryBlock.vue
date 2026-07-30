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
      </button>
    </div>

    <!-- Lightbox minimal (sin lib) — compartido entre las 3 variants -->
    <div v-if="lightboxIndex !== null" class="fixed inset-0 z-50 bg-navy/95 flex items-center justify-center p-4" @click="closeLightbox">
      <button type="button" class="absolute top-4 right-6 text-white/80 hover:text-white text-3xl font-light cursor-pointer" aria-label="Cerrar" @click.stop="closeLightbox">×</button>
      <img
        :src="photos[lightboxIndex].url"
        :alt="photos[lightboxIndex].alt || hotel.name"
        class="max-h-[88vh] max-w-[92vw] object-contain rounded-lg"
        @click.stop
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
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
</script>
