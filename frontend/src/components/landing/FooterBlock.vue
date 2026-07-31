<template>
  <!--
    FooterBlock — pie con copyright, links y datos de contacto (hotel.phone/email/website).
    Siempre renderizable. Sin copyright configurado → cae al nombre del hotel + año actual.
  -->
  <footer class="bg-navy text-white">
    <div class="max-w-6xl mx-auto px-6 py-14">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Marca -->
        <div class="lg:col-span-2">
          <div class="flex items-center gap-3">
            <div
              v-if="hotel.logo"
              class="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0"
            >
              <img :src="hotel.logo" :alt="hotel.name" class="w-full h-full object-contain" />
            </div>
            <div
              v-else
              class="w-10 h-10 rounded-lg bg-cyan text-navy flex items-center justify-center font-black text-lg flex-shrink-0"
            >{{ hotel.name?.charAt(0) || 'H' }}</div>
            <div class="font-black text-lg">{{ hotel.name }}</div>
          </div>
          <p v-if="hotel.description" class="mt-4 text-sm text-white/70 leading-relaxed max-w-md line-clamp-3">
            {{ hotel.description }}
          </p>
        </div>

        <!-- Contacto -->
        <div>
          <h3 class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/50 mb-4">Contacto</h3>
          <ul class="space-y-2.5 text-sm">
            <li v-if="hotel.address" class="flex items-start gap-2 text-white/80">
              <span class="w-4 h-4 shrink-0 mt-0.5 text-white/50 [&_svg]:w-4 [&_svg]:h-4" v-html="ICON_PIN" />
              {{ fullAddress }}
            </li>
            <li v-if="hotel.phone">
              <a :href="`tel:${hotel.phone}`" class="flex items-center gap-2 text-white/80 hover:text-cyan transition-colors">
                <span class="w-4 h-4 shrink-0 text-white/50 [&_svg]:w-4 [&_svg]:h-4" v-html="ICON_PHONE" />
                {{ hotel.phone }}
              </a>
            </li>
            <li v-if="hotel.email">
              <a :href="`mailto:${hotel.email}`" class="flex items-center gap-2 text-white/80 hover:text-cyan transition-colors">
                <span class="w-4 h-4 shrink-0 text-white/50 [&_svg]:w-4 [&_svg]:h-4" v-html="ICON_MAIL" />
                {{ hotel.email }}
              </a>
            </li>
            <li v-if="hotel.website">
              <a :href="hotel.website" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-cyan hover:text-cyan-light font-bold">
                <span class="w-4 h-4 shrink-0 [&_svg]:w-4 [&_svg]:h-4" v-html="ICON_GLOBE" />
                Sitio web
              </a>
            </li>
          </ul>
        </div>

        <!-- Links administrados -->
        <div v-if="links.length > 0">
          <h3 class="text-[11px] uppercase tracking-[0.18em] font-bold text-white/50 mb-4">Enlaces</h3>
          <ul class="space-y-2 text-sm">
            <li v-for="(l, i) in links" :key="i">
              <a
                :href="l.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-white/80 hover:text-cyan transition-colors"
              >{{ l.label }}</a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <p class="text-xs text-white/60">© {{ copyrightText }}</p>
        <router-link
          :to="bookingLink"
          class="text-xs font-bold text-cyan hover:text-cyan-light transition-colors"
        >
          Reservar →
        </router-link>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FooterLink, LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'
import { ICON_PIN, ICON_PHONE, ICON_MAIL, ICON_GLOBE } from './landing-icons'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const copyrightText = computed(() => {
  const c = typeof cfg.value.copyright === 'string' ? cfg.value.copyright.trim() : ''
  if (c) return c
  const year = new Date().getFullYear()
  return `${year} ${props.hotel.name}. Todos los derechos reservados.`
})

const links = computed<FooterLink[]>(() => {
  const raw = cfg.value.links
  if (!Array.isArray(raw)) return []
  return raw
    .filter((l): l is FooterLink =>
      typeof l === 'object' && l !== null &&
      typeof (l as FooterLink).label === 'string' && typeof (l as FooterLink).url === 'string',
    )
    .map((l) => ({ label: (l as FooterLink).label.trim(), url: (l as FooterLink).url.trim() }))
    .filter((l) => l.label && l.url)
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

const bookingLink = computed(() => `/book/${encodeURIComponent(props.hotel.slug)}`)
</script>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
