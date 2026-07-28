<template>
  <!--
    Stepper.vue — Contador +/− touch-friendly para el widget de reserva.
    Componente atómico usado por SearchStep (huéspedes, habitaciones) y UpsellsStep (qty).
    v-model = valor numérico. Botones grandes (44px min) para mobile.
  -->
  <div class="flex items-stretch rounded-xl border border-slate-200 bg-white overflow-hidden">
    <button
      type="button"
      :disabled="modelValue <= (min ?? -Infinity)"
      class="w-12 flex items-center justify-center text-2xl font-black text-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label="Disminuir"
      @click="decrement"
    >−</button>
    <input
      type="number"
      :value="modelValue"
      :min="min"
      :max="max"
      class="w-full min-w-0 flex-1 text-center text-base font-bold text-navy outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      @input="onInput"
    />
    <button
      type="button"
      :disabled="max !== undefined && modelValue >= max"
      class="w-12 flex items-center justify-center text-2xl font-black text-navy hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
      aria-label="Aumentar"
      @click="increment"
    >+</button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number
  min?: number
  max?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

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
function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', clamp(v))
}
</script>
