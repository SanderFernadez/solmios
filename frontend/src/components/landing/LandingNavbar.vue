<template>
  <!--
    LandingNavbar — barra superior fija sobre el hero (ausente hasta ahora: la landing no tenía
    NINGÚN navbar, gap visual grande vs. referencias tipo Airbnb/boutique hotel sites). Overlay
    transparente con texto blanco (funciona sobre los 3 templates: classic/boutique tienen overlay
    oscuro sobre la imagen, modern tiene columna navy sólida) — no depende del theme activo.
  -->
  <header class="absolute top-0 inset-x-0 z-30">
    <nav class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
      <span class="text-white font-black text-lg tracking-tight">{{ hotelName }}</span>

      <div class="hidden md:flex items-center gap-8">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          class="text-xs font-bold uppercase tracking-wide text-white/85 hover:text-white transition-colors cursor-pointer"
        >
          {{ link.label }}
        </a>
      </div>

      <router-link
        :to="bookingLink"
        class="hidden sm:inline-flex items-center bg-white hover:bg-white/90 transition-colors text-navy font-extrabold text-xs uppercase tracking-wide px-5 py-2.5 rounded-full cursor-pointer"
      >
        Reservar ahora
      </router-link>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  hotelName: string
  hotelSlug: string
  anchors: { storytelling: boolean; gallery: boolean; rooms: boolean; location: boolean; reviews: boolean }
}>()

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotelSlug)}`)

const links = computed(() => {
  const l = [{ label: 'Inicio', href: '#hero' }]
  if (props.anchors.storytelling) l.push({ label: 'Experiencias', href: '#experiencias' })
  if (props.anchors.rooms) l.push({ label: 'Habitaciones', href: '#rooms' })
  if (props.anchors.gallery) l.push({ label: 'Galería', href: '#galeria' })
  if (props.anchors.location) l.push({ label: 'Ubicación', href: '#location' })
  if (props.anchors.reviews) l.push({ label: 'Opiniones', href: '#reviews' })
  return l
})
</script>
