<template>
  <!--
    Stepper.vue — Contador +/− touch-friendly del widget de reserva.
    Lo usan SearchStep (adultos, niños, habitaciones) y UpsellsStep (cantidad).

    Los ± son círculos de 36px (h-9 w-9), el mismo tamaño que el selector de ocupación de la
    landing: por debajo de eso el objetivo táctil queda inusable en celular. El valor va al medio
    como texto (no un `<input type=number>`): dentro de un iframe embebido el teclado numérico
    tapaba media pantalla para un valor que se ajusta con dos toques, y el `<input>` dejaba pasar
    estados intermedios vacíos.

    `label` (opcional) nombra QUÉ se está contando para el lector de pantalla: sin eso todos los
    steppers de la pantalla dicen "Aumentar" y no se distinguen entre sí.
  -->
  <div class="flex items-center gap-2">
    <button
      type="button"
      :disabled="modelValue <= (min ?? -Infinity)"
      class="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-lg font-black leading-none text-navy transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
      :aria-label="decrementLabel"
      @click="decrement"
    >−</button>
    <span
      class="w-8 text-center text-base font-black tabular-nums text-navy"
      role="status"
      :aria-label="label ? `${label}: ${modelValue}` : undefined"
    >{{ modelValue }}</span>
    <button
      type="button"
      :disabled="max !== undefined && modelValue >= max"
      class="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-lg font-black leading-none text-navy transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
      :aria-label="incrementLabel"
      @click="increment"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
  /** Qué se está contando ("Adultos", "Niños"…). Solo para lectores de pantalla. */
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const decrementLabel = computed(() => (props.label ? `− ${props.label}` : 'Disminuir'))
const incrementLabel = computed(() => (props.label ? `+ ${props.label}` : 'Aumentar'))

function clamp(n: number): number {
  if (!Number.isFinite(n)) n = props.min ?? 0
  if (props.min !== undefined) n = Math.max(props.min, n)
  if (props.max !== undefined) n = Math.min(props.max, n)
  return Math.floor(n)
}

function increment() {
  emit('update:modelValue', clamp(props.modelValue + 1))
}
function decrement() {
  emit('update:modelValue', clamp(props.modelValue - 1))
}
</script>
