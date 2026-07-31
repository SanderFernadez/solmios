<template>
  <!--
    StorytellingBlock — sección "Vive una experiencia única": texto + fotos, entre trust-badges
    y gallery (landing-storytelling-block, mockup de referencia del usuario). Config:
    {title, description, linkText, mediaIds}. `mediaIds` resuelve contra `media.gallery`
    (MediaPicker type='gallery' — antes hardcodeado a type='hero', ver FIX en MediaPicker.vue).

    Sin inventar copy: si el admin no escribió `description` Y no eligió fotos, el bloque NO
    renderiza (mismo criterio que gallery/amenities/reviews — "sin data real, sin renderizar").
    `title` sí tiene default razonable (es un encabezado de sección, no el H1 de la página —
    mismo criterio que "Habitaciones"/"Servicios", no el caso hero.title que SÍ cae al nombre
    real del hotel).
  -->
  <section v-if="hasContent" class="max-w-6xl mx-auto px-6 py-16">
    <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
      <div>
        <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
        <p v-if="description" class="mt-4 text-base text-text-secondary leading-relaxed">
          {{ description }}
        </p>
        <a
          v-if="linkText"
          href="#rooms"
          class="mt-6 inline-flex items-center gap-1.5 text-sm font-extrabold text-navy hover:text-cyan transition-colors cursor-pointer"
        >
          {{ linkText }}
          <span aria-hidden="true">→</span>
        </a>
      </div>

      <div v-if="photos.length > 0" class="grid grid-cols-2 gap-3" :class="photos.length === 1 ? 'grid-cols-1' : ''">
        <div
          v-for="(photo, i) in photos"
          :key="photo.id"
          class="rounded-2xl overflow-hidden bg-surface-dark aspect-square"
          :class="i === 0 && photos.length > 1 ? 'row-span-2 aspect-auto' : ''"
        >
          <img :src="photo.url" :alt="photo.alt || title" class="w-full h-full object-cover" loading="lazy" />
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
  return t || 'Vive una experiencia única'
})

const description = computed(() => {
  const d = typeof cfg.value.description === 'string' ? cfg.value.description.trim() : ''
  return d
})

const linkText = computed(() => {
  const l = typeof cfg.value.linkText === 'string' ? cfg.value.linkText.trim() : ''
  return l
})

const photos = computed(() => {
  const ids = Array.isArray(cfg.value.mediaIds) ? (cfg.value.mediaIds as unknown[]).filter((id): id is string => typeof id === 'string') : []
  if (ids.length === 0) return []
  const byId = new Map((props.media?.gallery ?? []).map((m) => [m.id, m]))
  return ids.map((id) => byId.get(id)).filter((m): m is NonNullable<typeof m> => Boolean(m)).slice(0, 3)
})

// Sin description Y sin fotos resueltas → no hay nada real que mostrar, mismo criterio que
// el resto de bloques opcionales (gallery/amenities/reviews).
const hasContent = computed(() => description.value.length > 0 || photos.value.length > 0)
</script>
