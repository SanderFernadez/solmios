<template>
  <!--
    GalleryBlock — grilla mosaico de fotos (media.gallery). Si NO hay media.gallery, el
    orquestador no debería renderizar este bloque (v-if allá), pero dejamos un guard acá
    por si lo activan sin cargar fotos: sección vacía → no renderiza nada.
  -->
  <section v-if="photos.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header v-if="title" class="mb-8 flex items-end justify-between gap-4">
      <div>
        <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Galería</p>
        <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
      </div>
      <p class="hidden sm:block text-sm text-text-muted">{{ photos.length }} fotos</p>
    </header>

    <!-- Mosaico responsive: 2 col mobile / 4 col desktop, primera foto grande -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 auto-rows-[160px] sm:auto-rows-[200px]">
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

    <!-- Lightbox minimal (sin lib) -->
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
import { computed, ref } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia, PublicMediaItem } from '@/types'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

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
