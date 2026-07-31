<template>
  <!--
    HeroSearchBar — buscador inline standalone del hero (F1 hero-search-rooms-content). ES para
    el huésped público, no reusa el wizard del panel. Al submit navega a /book/:slug?checkIn=...
    — el widget existente (booking-widget.vue) YA lee esos query params y los pasa a
    useBooking.ts init(), no hay nada más que cablear acá.
    Usado por las 3 variantes de HeroBlock.vue (classic/modern/boutique) con distinto wrapper.
    REDISEÑO v2 (feedback usuario) — cada campo es su propia celda redondeada con hover/focus
    propio (en vez de divide-x, que se rompía en el grid 2x2 de mobile); adultos/habitaciones
    pasan de <input type=number> pelado a stepper −/+ (más premium, más usable que las flechas
    nativas del browser); botón con flecha, sombra más marcada.
  -->
  <form
    @submit.prevent="onSubmit"
    class="bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row sm:items-stretch gap-2"
  >
    <div class="flex-1 grid grid-cols-2 sm:flex sm:items-stretch gap-1">
      <label
        class="group flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer flex-1 min-w-0 transition-colors hover:bg-surface focus-within:bg-surface"
      >
        <span class="text-navy/35 group-hover:text-navy/60 shrink-0 transition-colors" v-html="ICON_CALENDAR" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Llegada</span>
          <input
            v-model="checkIn"
            type="date"
            :min="todayIso"
            required
            class="text-xs font-extrabold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full cursor-pointer"
          />
        </span>
      </label>
      <label
        class="group flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer flex-1 min-w-0 transition-colors hover:bg-surface focus-within:bg-surface"
      >
        <span class="text-navy/35 group-hover:text-navy/60 shrink-0 transition-colors" v-html="ICON_CALENDAR" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Salida</span>
          <input
            v-model="checkOut"
            type="date"
            :min="checkOut && checkIn && checkOut < checkIn ? checkIn : (checkIn || todayIso)"
            required
            class="text-xs font-extrabold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full cursor-pointer"
          />
        </span>
      </label>

      <div class="flex items-center gap-2.5 px-4 py-3 rounded-xl flex-1 min-w-0">
        <span class="text-navy/35 shrink-0" v-html="ICON_USER" />
        <span class="flex flex-col min-w-0 flex-1">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Adultos</span>
          <span class="flex items-center gap-2.5">
            <button
              type="button"
              :disabled="adults <= 1"
              @click="adults = Math.max(1, adults - 1)"
              class="h-4 w-4 flex items-center justify-center rounded-full border border-border text-navy text-[11px] font-black leading-none disabled:opacity-30 hover:bg-surface-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
              aria-label="Menos adultos"
            >−</button>
            <span class="text-xs font-extrabold text-navy w-4 text-center">{{ adults }}</span>
            <button
              type="button"
              @click="adults = adults + 1"
              class="h-4 w-4 flex items-center justify-center rounded-full border border-border text-navy text-[11px] font-black leading-none hover:bg-surface-dark transition-colors cursor-pointer"
              aria-label="Más adultos"
            >+</button>
          </span>
        </span>
      </div>

      <div class="flex items-center gap-2.5 px-4 py-3 rounded-xl flex-1 min-w-0">
        <span class="text-navy/35 shrink-0" v-html="ICON_BED" />
        <span class="flex flex-col min-w-0 flex-1">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Habitaciones</span>
          <span class="flex items-center gap-2.5">
            <button
              type="button"
              :disabled="roomsCount <= 1"
              @click="roomsCount = Math.max(1, roomsCount - 1)"
              class="h-4 w-4 flex items-center justify-center rounded-full border border-border text-navy text-[11px] font-black leading-none disabled:opacity-30 hover:bg-surface-dark transition-colors cursor-pointer disabled:cursor-not-allowed"
              aria-label="Menos habitaciones"
            >−</button>
            <span class="text-xs font-extrabold text-navy w-4 text-center">{{ roomsCount }}</span>
            <button
              type="button"
              @click="roomsCount = roomsCount + 1"
              class="h-4 w-4 flex items-center justify-center rounded-full border border-border text-navy text-[11px] font-black leading-none hover:bg-surface-dark transition-colors cursor-pointer"
              aria-label="Más habitaciones"
            >+</button>
          </span>
        </span>
      </div>
    </div>

    <button
      type="submit"
      class="shrink-0 inline-flex items-center justify-center gap-2 bg-navy hover:bg-navy-light transition-colors text-white font-extrabold text-xs uppercase tracking-wide px-7 py-3 rounded-xl cursor-pointer"
    >
      {{ ctaText }}
      <span aria-hidden="true">→</span>
    </button>

    <p v-if="error" class="basis-full text-xs font-bold text-danger px-2">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  hotelSlug: string
  ctaText: string
}>()

const router = useRouter()

// Bug UTC conocido del repo (CalendarView.vue:162 isoOf): nunca toISOString()/parseo de string
// para "hoy" — construir la fecha local a mano.
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}
function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const todayIso = localIso(new Date())

const checkIn = ref('')
const checkOut = ref('')
const adults = ref(2)
const roomsCount = ref(1)
const error = ref('')

const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 18h18M3 18v2M21 18v2M7 9V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/></svg>'

function onSubmit() {
  error.value = ''
  if (!checkIn.value || !checkOut.value) {
    error.value = 'Elegí fecha de llegada y salida.'
    return
  }
  if (checkOut.value <= checkIn.value) {
    error.value = 'La salida debe ser posterior a la llegada.'
    return
  }
  const qs = new URLSearchParams({
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guests: String(Math.max(1, adults.value || 1)),
    rooms: String(Math.max(1, roomsCount.value || 1)),
  })
  router.push(`/book/${encodeURIComponent(props.hotelSlug)}?${qs.toString()}`)
}
</script>
