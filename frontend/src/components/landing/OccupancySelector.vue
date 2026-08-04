<template>
  <!--
    OccupancySelector — campo "Huéspedes" del buscador de la landing pública.

    Resumen explícito + steppers (Baymard/NN-g): el trigger dice "2 adultos, 1 niño" en vez de
    un número pelado, y adentro hay steppers en vez de dropdowns encadenados — para valores
    chicos (1-6) el stepper gana: un toque por unidad, sin abrir una lista de 20 opciones.

    Tamaño: los ± son de 36px (h-9 w-9). Los del buscador viejo eran de 16px (h-4 w-4), muy por
    debajo del mínimo táctil recomendado y directamente inusables en celular.

    ⚠️ SIN edades por niño a propósito: el schema público del backend
    (`bookingengine/validators/schema.ts`) acepta `adults` y `children` como CONTADORES y nada
    más. Un array de edades se descartaría en silencio (anti-patrón ORM documentado en
    CLAUDE.md) y le prometería al huésped una tarifa por edad que el motor no calcula.

    El trigger es la raíz (no hay wrapper): tiene que ser hijo DIRECTO del `flex flex-wrap` del
    HeroSearchBar para que el wrap por ancho REAL siga funcionando (ver comentario del form).
  -->
  <button
    ref="anchor"
    type="button"
    :aria-expanded="open"
    aria-haspopup="dialog"
    class="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl flex-1 basis-[190px] min-w-[180px] text-left transition-colors hover:bg-surface cursor-pointer"
    :class="open ? 'bg-surface' : ''"
    @click="toggle"
  >
    <span class="h-5 w-5 shrink-0 text-navy/40 transition-colors group-hover:text-navy/70 [&_svg]:h-full [&_svg]:w-full" v-html="ICON_USERS" />
    <span class="flex min-w-0 flex-col">
      <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted">Huéspedes</span>
      <span class="truncate text-sm font-extrabold text-navy">{{ summary }}</span>
    </span>
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      ref="panel"
      role="dialog"
      aria-label="Seleccionar huéspedes y habitaciones"
      :style="panelStyle"
      class="fixed z-[120] overflow-auto rounded-2xl border border-border bg-white p-4 shadow-2xl"
    >
      <div class="divide-y divide-border">
        <div
          v-for="row in rows"
          :key="row.key"
          class="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <span class="min-w-0">
            <span class="block text-sm font-extrabold text-navy">{{ row.label }}</span>
            <span class="block text-[11px] text-text-muted">{{ row.hint }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              :disabled="row.value <= row.min"
              :aria-label="`Quitar ${row.singular}`"
              class="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border text-lg font-black leading-none text-navy transition-colors hover:bg-surface-dark disabled:cursor-not-allowed disabled:opacity-30"
              @click="step(row.key, -1)"
            >−</button>
            <span class="w-7 text-center text-base font-black tabular-nums text-navy">{{ row.value }}</span>
            <button
              type="button"
              :disabled="row.value >= row.max"
              :aria-label="`Agregar ${row.singular}`"
              class="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-border text-lg font-black leading-none text-navy transition-colors hover:bg-surface-dark disabled:cursor-not-allowed disabled:opacity-30"
              @click="step(row.key, 1)"
            >+</button>
          </span>
        </div>
      </div>

      <p class="mt-3 text-[11px] text-text-muted" aria-live="polite">{{ summary }}</p>

      <button
        type="button"
        class="mt-3 w-full cursor-pointer rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-light"
        @click="close"
      >Listo</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAnchoredPanel } from '@/composables/useAnchoredPanel'
import { formatOccupancy } from '@/utils/rate-calendar'
import type { Occupancy } from '@/types/booking'

// Raíz múltiple (trigger + Teleport): sin esto Vue avisa por attrs sin destino si el padre
// pasara una class. El padre no le pasa ninguna — el layout lo define el propio trigger.
defineOptions({ inheritAttrs: false })

const props = defineProps<{ modelValue: Occupancy }>()
const emit = defineEmits<{ 'update:modelValue': [value: Occupancy] }>()

const { open, anchor, panel, panelStyle, toggle, close } = useAnchoredPanel(320)

const summary = computed(() => formatOccupancy(props.modelValue))

type RowKey = keyof Occupancy

interface Row {
  key: RowKey
  label: string
  singular: string
  hint: string
  value: number
  min: number
  max: number
}

/** Topes: no son reglas de negocio del hotel (el backend no impone ninguna), son cotas sanas
 *  para que el stepper no sea un contador infinito. Un grupo mayor se resuelve por contacto
 *  directo, como en cualquier motor de reservas. */
const rows = computed<Row[]>(() => [
  { key: 'adults', label: 'Adultos', singular: 'un adulto', hint: '13 años o más', value: props.modelValue.adults, min: 1, max: 12 },
  { key: 'children', label: 'Niños', singular: 'un niño', hint: '0 a 12 años', value: props.modelValue.children, min: 0, max: 10 },
  { key: 'rooms', label: 'Habitaciones', singular: 'una habitación', hint: 'Unidades a reservar', value: props.modelValue.rooms, min: 1, max: 8 },
])

function step(key: RowKey, delta: number): void {
  const row = rows.value.find((r) => r.key === key)
  if (!row) return
  const next = Math.min(row.max, Math.max(row.min, row.value + delta))
  if (next === row.value) return
  emit('update:modelValue', { ...props.modelValue, [key]: next })
}

const ICON_USERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6M18 13.9c2.1.8 3.5 2.8 3.5 5.1"/></svg>'
</script>

<style scoped>
/* Sin CSS propio: el panel es Tailwind + posicionamiento inline calculado por
   useAnchoredPanel (fixed, para no recortarse contra el overflow-hidden del hero). */
</style>
