<template>
  <!--
    SearchStep.vue — Step 0 del widget de reserva (F2 2.9, solmi-direct-booking).
    Captura fechas (checkIn/checkOut) + huéspedes + habitaciones y dispara la búsqueda de
    disponibilidad. Es la puerta de entrada al funnel — el CTA NO dice "Reservar" sino
    "Ver disponibilidad" (spec: reduce fricción al no comprometer al usuario antes de ver precios).

    Mobile-first: inputs grandes (touch target ≥44px), stack vertical en móvil, 2 columnas
    para fechas en desktop. Sin librería de calendar pesada (prevenir >bundle inicial): dos
    `<input type="date">` nativos. La vista estilo Airbnb con drag (task 2.17) es otra pieza.

    Emite la búsqueda al store vía `store.search()` (Pinia). El estado (loading, error,
    validación) se lee del store reactivo.
  -->
  <section class="space-y-5">
    <header class="space-y-1">
      <h2 class="text-xl font-black text-navy">Elegí tus fechas</h2>
      <p class="text-sm text-text-muted">Encontrá las mejores tarifas directo del hotel.</p>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="block">
        <span class="block text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Llegada</span>
        <input
          type="date"
          v-model="store.checkIn"
          :min="today"
          class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-navy font-semibold focus:border-cyan focus:ring-2 focus:ring-cyan/30 focus:outline-none"
        />
      </label>
      <label class="block">
        <span class="block text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Salida</span>
        <input
          type="date"
          v-model="store.checkOut"
          :min="checkOutMin"
          class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-navy font-semibold focus:border-cyan focus:ring-2 focus:ring-cyan/30 focus:outline-none"
        />
      </label>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="block">
        <span class="block text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Huéspedes</span>
        <Stepper v-model="store.guests" :min="1" :max="20" />
      </label>
      <label class="block">
        <span class="block text-xs font-bold text-text-muted uppercase tracking-wide mb-1">Habitaciones</span>
        <Stepper v-model="store.rooms" :min="1" :max="9" />
      </label>
    </div>

    <p v-if="dateError" class="text-sm font-semibold text-red-600">{{ dateError }}</p>
    <p v-if="store.ratesError" class="text-sm font-semibold text-red-600">{{ store.ratesError }}</p>

    <button
      type="button"
      :disabled="!store.searchValid || store.ratesLoading"
      class="w-full rounded-xl bg-cyan px-6 py-4 text-base font-black text-white shadow-card transition hover:bg-cyan-light disabled:cursor-not-allowed disabled:opacity-50"
      @click="store.search()"
    >
      <span v-if="store.ratesLoading" class="inline-flex items-center justify-center gap-2">
        <span class="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        Buscando…
      </span>
      <span v-else>Ver disponibilidad</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBookingStore } from '@/composables/useBooking'
import Stepper from './Stepper.vue'

const store = useBookingStore()

// `today` en formato yyyy-mm-dd para el atributo `min` del input date. No incluye hora →
// permite reservar para el mismo día (check-in del día en curso).
const today = new Date().toISOString().slice(0, 10)
// Salida mínima = día siguiente a la llegada. Si no hay llegada, hoy.
const checkOutMin = computed(() => {
  if (!store.checkIn) return today
  const d = new Date(store.checkIn)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})

// Error de fechas: más específico que el flag `searchValid` para guiar al usuario.
const dateError = computed(() => {
  if (!store.checkIn || !store.checkOut) return ''
  if (store.checkOut <= store.checkIn) return 'La salida debe ser posterior a la llegada.'
  return ''
})
</script>
