<template>
  <!--
    HeroSearchBar — buscador inline standalone del hero (F1 hero-search-rooms-content). ES para
    el huésped público, no reusa el wizard del panel. Al submit navega a /book/:slug?checkIn=...
    — el widget existente (booking-widget.vue) YA lee esos query params y los pasa a
    useBooking.ts init(), no hay nada más que cablear acá.
    Usado por las 3 variantes de HeroBlock.vue (classic/modern/boutique) con distinto wrapper.
  -->
  <form
    @submit.prevent="onSubmit"
    class="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-4 sm:p-5 flex flex-col gap-3"
  >
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Llegada</span>
        <input
          v-model="checkIn"
          type="date"
          :min="todayIso"
          required
          class="rounded-lg border border-border px-2.5 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Salida</span>
        <input
          v-model="checkOut"
          type="date"
          :min="checkOut && checkIn && checkOut < checkIn ? checkIn : (checkIn || todayIso)"
          required
          class="rounded-lg border border-border px-2.5 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Adultos</span>
        <input
          v-model.number="adults"
          type="number"
          min="1"
          step="1"
          class="rounded-lg border border-border px-2.5 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Habitaciones</span>
        <input
          v-model.number="roomsCount"
          type="number"
          min="1"
          step="1"
          class="rounded-lg border border-border px-2.5 py-2 text-sm text-navy focus:border-navy focus:outline-none"
        />
      </label>
    </div>

    <p v-if="error" class="text-xs font-bold text-danger">{{ error }}</p>

    <button
      type="submit"
      class="w-full sm:w-auto sm:self-end bg-cyan hover:bg-cyan-light transition-colors text-navy font-extrabold text-sm px-6 py-2.5 rounded-xl shadow cursor-pointer"
    >
      {{ ctaText }}
    </button>
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
