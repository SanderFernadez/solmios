<script setup lang="ts">
// SearchSelect.vue — Combobox con buscador dinámico (estilo select2), 100% nativo Vue 3.
// Sin dependencias externas. Reutilizable para string[] (País, Nacionalidad)
// o { value, label }[] (Habitaciones: value=id, label='101 — Suite ($120/n)').
import { ref, computed, onMounted, onUnmounted } from 'vue'

type Opt = { value: string; label: string }

const props = withDefaults(defineProps<{
  /** Puede llegar undefined mientras el formulario no cargó: se trata como vacío. */
  modelValue: string | undefined
  options: string[] | Opt[]
  placeholder?: string
}>(), { modelValue: '', placeholder: 'Buscar...' })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

/** Quita acentos y pasa a minúsculas para tolerar la búsqueda. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Normaliza las options a { value, label } (un string suelto → value = label). */
const normalized = computed<Opt[]>(() =>
  props.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
)

const filtered = computed<Opt[]>(() => {
  const q = norm(query.value).trim()
  if (!q) return normalized.value
  return normalized.value.filter((o) => norm(o.label).includes(q))
})

/** Etiqueta del valor seleccionado (lo que se muestra cuando está cerrado). */
const selectedLabel = computed(() =>
  normalized.value.find((o) => o.value === props.modelValue)?.label ?? props.modelValue
)

const displayValue = computed(() => (open.value ? query.value : selectedLabel.value))

function openDropdown() {
  open.value = true
  query.value = ''
}

function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
  open.value = true
}

function choose(opt: Opt) {
  emit('update:modelValue', opt.value)
  query.value = ''
  open.value = false
  inputEl.value?.blur()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
    query.value = ''
    inputEl.value?.blur()
  }
}

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) {
    open.value = false
    query.value = ''
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="relative">
    <input
      ref="inputEl"
      type="text"
      autocomplete="off"
      :value="displayValue"
      :placeholder="selectedLabel || placeholder"
      @focus="openDropdown"
      @input="onInput"
      @keydown="onKeydown"
      class="w-full px-3 py-2.5 pr-9 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
    />
    <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">▼</span>
    <ul
      v-if="open"
      class="absolute z-40 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-border bg-white shadow-lg"
    >
      <li v-if="filtered.length === 0" class="px-3 py-2 text-sm text-text-muted">Sin resultados</li>
      <li
        v-for="opt in filtered"
        :key="opt.value"
        @mousedown.prevent="choose(opt)"
        :class="[
          'px-3 py-2 text-sm cursor-pointer hover:bg-navy/10',
          opt.value === modelValue ? 'bg-navy/5 font-semibold text-navy' : 'text-text',
        ]"
      >{{ opt.label }}</li>
    </ul>
  </div>
</template>

<style scoped></style>
