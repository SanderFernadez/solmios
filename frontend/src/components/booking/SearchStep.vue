<template>
  <!--
    SearchStep.vue — Step 0 del widget de reserva (F2 2.9 + 2.17, solmi-direct-booking).
    Captura fechas (checkIn/checkOut) via CalendarView estilo Airbnb (task 2.17 reemplazó los
    `<input type="date">` nativos por el calendar con selección inclusiva de noches) + huéspedes
    + habitaciones y dispara la búsqueda de disponibilidad. Es la puerta de entrada al funnel —
    el CTA NO dice "Reservar" sino "Ver disponibilidad" (spec: reduce fricción al no comprometer
    al usuario antes de ver precios).

    Mobile-first: calendar de 1 mes visible con nav entre meses en mobile, 2 meses en sm+.
    Stepper de huéspedes/habitaciones touch-friendly (target ≥44px).

    Emite la búsqueda al store vía `store.search()` (Pinia). El estado (loading, error,
    validación) se lee del store reactivo. Todos los textos via i18n (es/en/pt, task 2.14).
  -->
  <section class="space-y-5">
    <header class="space-y-1">
      <h2 class="text-xl font-black text-navy">{{ t('search.title') }}</h2>
      <p class="text-sm text-text-muted">{{ t('search.subtitle') }}</p>
    </header>

    <!-- Calendar estilo Airbnb (reemplaza inputs date nativos). Selecciona noches inclusivas
         y escribe directo al store.checkIn/checkOut. -->
    <CalendarView />

    <!--
      Ocupación (paridad con la landing, `components/landing/OccupancySelector.vue`): una fila por
      concepto con su aclaración, y NIÑOS aparte de adultos. Antes eran dos steppers apretados en
      `grid-cols-2` sin niños: el huésped que viajaba con chicos no tenía dónde declararlos y la
      tarifa salía por la capacidad equivocada.

      `store.guests` son ADULTOS (se mapea a `adults` al crear la reserva) y `store.children` los
      niños; la consulta de tarifas usa `store.physicalGuests` (adultos + niños), que ya existe en
      el store. NO sumar niños dentro de `guests` o se graban como adultos.

      ⚠️ SIN edades por niño a propósito: el schema público del backend acepta `adults`/`children`
      como CONTADORES; un array de edades se descartaría en silencio.
    -->
    <fieldset class="rounded-xl border border-slate-200 bg-white px-3">
      <legend class="px-1 text-xs font-bold uppercase tracking-wide text-text-muted">
        {{ t('search.guests') }}
      </legend>
      <div class="divide-y divide-slate-100">
        <div
          v-for="row in occupancyRows"
          :key="row.key"
          class="flex items-center justify-between gap-3 py-3"
        >
          <span class="min-w-0">
            <span class="block text-sm font-extrabold text-navy">{{ row.label }}</span>
            <span class="block text-[11px] text-text-muted">{{ row.hint }}</span>
          </span>
          <Stepper
            :model-value="row.value"
            :min="row.min"
            :max="row.max"
            :label="row.label"
            class="shrink-0"
            @update:model-value="row.set"
          />
        </div>
      </div>
    </fieldset>

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
        {{ t('search.searching') }}
      </span>
      <span v-else>{{ t('search.cta') }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore } from '@/composables/useBookingI18n'
import Stepper from './Stepper.vue'
import CalendarView from './CalendarView.vue'

const store = useBookingStore()
const { t } = useBookingI18nStore()

interface OccupancyRow {
  key: 'adults' | 'children' | 'rooms'
  label: string
  hint: string
  value: number
  min: number
  max: number
  set: (v: number) => void
}

/** Filas del selector de ocupación. Cada una escribe DIRECTO al store (`set`) en vez de un
 *  `v-model` sobre el objeto de la fila: el objeto lo produce este computed, así que asignarle
 *  encima no llegaría nunca al store.
 *
 *  Topes: no son reglas del hotel (el backend no impone ninguna), son cotas sanas para que el
 *  stepper no sea un contador infinito — mismos valores que la landing. */
const occupancyRows = computed<OccupancyRow[]>(() => [
  {
    key: 'adults',
    label: t('search.adults'),
    hint: t('search.adultsHint'),
    value: store.guests,
    min: 1,
    max: 12,
    set: (v) => { store.guests = v },
  },
  {
    key: 'children',
    label: t('search.children'),
    hint: t('search.childrenHint'),
    value: store.children,
    min: 0,
    max: 10,
    set: (v) => { store.children = v },
  },
  {
    key: 'rooms',
    label: t('search.rooms'),
    hint: t('search.roomsHint'),
    value: store.rooms,
    min: 1,
    max: 8,
    set: (v) => { store.rooms = v },
  },
])

// Error de fechas: más específico que el flag `searchValid` para guiar al usuario. Se deriva
// del estado del store (no de un ref local) — si el usuario cambia el calendar, esto recalcula.
const dateError = computed(() => {
  if (!store.checkIn || !store.checkOut) return ''
  if (store.checkOut <= store.checkIn) return t('search.dateError')
  return ''
})
</script>
