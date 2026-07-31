<template>
  <!--
    HeroSearchBar — buscador inline standalone del hero (F1 hero-search-rooms-content). ES para
    el huésped público, no reusa el wizard del panel. Al submit navega a /book/:slug?checkIn=...
    — el widget existente (booking-widget.vue) YA lee esos query params y los pasa a
    useBooking.ts init(), no hay nada más que cablear acá.
    Usado por las 3 variantes de HeroBlock.vue (classic/modern/boutique) con distinto wrapper.
    REDISEÑO — barra pill unificada (un solo contenedor blanco, campos separados por divisores
    finos + ícono, botón negro pegado al final) en vez de 4 cajas sueltas — mockup de referencia.
  -->
  <form
    @submit.prevent="onSubmit"
    class="bg-white rounded-2xl shadow-xl p-1.5 flex flex-col sm:flex-row sm:items-stretch gap-1.5"
  >
    <div class="flex-1 grid grid-cols-2 sm:flex sm:items-stretch divide-x divide-border/70">
      <label class="flex items-center gap-2 px-4 py-2.5 cursor-pointer flex-1 min-w-0">
        <span class="text-navy/40 shrink-0" v-html="ICON_CALENDAR" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Check-in</span>
          <input
            v-model="checkIn"
            type="date"
            :min="todayIso"
            required
            class="text-xs font-bold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full"
          />
        </span>
      </label>
      <label class="flex items-center gap-2 px-4 py-2.5 cursor-pointer flex-1 min-w-0">
        <span class="text-navy/40 shrink-0" v-html="ICON_CALENDAR" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Check-out</span>
          <input
            v-model="checkOut"
            type="date"
            :min="checkOut && checkIn && checkOut < checkIn ? checkIn : (checkIn || todayIso)"
            required
            class="text-xs font-bold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full"
          />
        </span>
      </label>
      <label class="flex items-center gap-2 px-4 py-2.5 cursor-pointer flex-1 min-w-0">
        <span class="text-navy/40 shrink-0" v-html="ICON_USER" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Adultos</span>
          <input
            v-model.number="adults"
            type="number"
            min="1"
            step="1"
            class="text-xs font-bold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full"
          />
        </span>
      </label>
      <label class="flex items-center gap-2 px-4 py-2.5 cursor-pointer flex-1 min-w-0">
        <span class="text-navy/40 shrink-0" v-html="ICON_BED" />
        <span class="flex flex-col min-w-0">
          <span class="text-[9px] font-bold uppercase tracking-wide text-text-muted">Habitaciones</span>
          <input
            v-model.number="roomsCount"
            type="number"
            min="1"
            step="1"
            class="text-xs font-bold text-navy bg-transparent border-0 p-0 focus:outline-none focus:ring-0 w-full"
          />
        </span>
      </label>
    </div>

    <button
      type="submit"
      class="shrink-0 bg-navy hover:bg-navy-light transition-colors text-white font-extrabold text-xs uppercase tracking-wide px-6 py-3 rounded-xl cursor-pointer"
    >
      {{ ctaText }}
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
