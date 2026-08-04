<script setup lang="ts">
// SearchSelect.vue — Combobox con buscador dinámico (estilo select2), 100% nativo Vue 3.
// Sin dependencias externas. Reutilizable para string[] (País, Nacionalidad)
// o { value, label }[] (Habitaciones: value=id, label='101 — Suite ($120/n)').
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

// `disabled` (#648): opción visible pero no seleccionable, con motivo en el label — usado por
// el selector de habitación de ReservationWizardModal.vue para mostrar cuartos ocupados esas
// fechas sin ocultarlos (deshabilitar, no ocultar, con el motivo visible).
type Opt = { value: string; label: string; disabled?: boolean }

const props = withDefaults(defineProps<{
  /** Puede llegar undefined mientras el formulario no cargó: se trata como vacío. */
  modelValue: string | undefined
  options: string[] | Opt[]
  placeholder?: string
  disabled?: boolean
}>(), { modelValue: '', placeholder: 'Buscar...', disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const dropdownEl = ref<HTMLElement | null>(null)

// El dropdown se teletransporta a <body>: si queda dentro de un ancestro con overflow-hidden
// (p.ej. SectionCard, que lo necesita para recortar el header navy a las esquinas redondeadas),
// el `absolute` de acá adentro se corta contra ese borde en vez de flotar sobre toda la pantalla.
// Se posiciona con coordenadas de viewport (position:fixed), recalculadas al abrir.
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' })
function updatePosition() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  dropdownStyle.value = { top: `${r.bottom + 4}px`, left: `${r.left}px`, width: `${r.width}px` }
}
// Reposicionar en vivo sería lo ideal, pero cerrar al scrollear (patrón común de combobox) evita
// que el dropdown quede "flotando" desalineado sin necesidad de un listener de scroll costoso.
// Con capture:true este listener también ve el scroll INTERNO de la propia lista (overflow-auto)
// — sin el chequeo de abajo, intentar scrollear las opciones cerraba el dropdown al primer intento.
function closeOnScroll(e: Event) {
  if (!open.value) return
  if (dropdownEl.value && e.target instanceof Node && dropdownEl.value.contains(e.target)) return
  open.value = false
  query.value = ''
}

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

async function openDropdown() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  await nextTick()
  updatePosition()
}

function onInput(e: Event) {
  if (props.disabled) return
  query.value = (e.target as HTMLInputElement).value
  open.value = true
  updatePosition()
}

function choose(opt: Opt) {
  if (opt.disabled) return
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
  const t = e.target as Node
  // El dropdown vive fuera de `root` en el DOM (Teleport a body): sin este chequeo aparte,
  // cualquier clic adentro de la lista se leía como "afuera" y la cerraba de encuentro.
  if (root.value?.contains(t) || dropdownEl.value?.contains(t)) return
  open.value = false
  query.value = ''
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('scroll', closeOnScroll, true)
  window.addEventListener('resize', closeOnScroll)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', closeOnScroll, true)
  window.removeEventListener('resize', closeOnScroll)
})
</script>

<template>
  <div ref="root" class="relative">
    <input
      ref="inputEl"
      type="text"
      autocomplete="off"
      :value="displayValue"
      :placeholder="selectedLabel || placeholder"
      :disabled="disabled"
      @focus="openDropdown"
      @input="onInput"
      @keydown="onKeydown"
      class="w-full px-3 py-2.5 pr-9 rounded-lg border border-border text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface"
    />
    <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">▼</span>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="dropdownEl"
        :style="dropdownStyle"
        class="fixed z-[100] max-h-52 overflow-auto rounded-lg border border-border bg-white shadow-lg"
      >
        <li v-if="filtered.length === 0" class="px-3 py-2 text-sm text-text-muted">Sin resultados</li>
        <li
          v-for="opt in filtered"
          :key="opt.value"
          @mousedown.prevent="choose(opt)"
          :aria-disabled="opt.disabled"
          :class="[
            'px-3 py-2 text-sm',
            opt.disabled ? 'cursor-not-allowed text-text-muted opacity-60' : 'cursor-pointer hover:bg-navy/10',
            !opt.disabled && opt.value === modelValue ? 'bg-navy/5 font-semibold text-navy' : '',
            !opt.disabled && opt.value !== modelValue ? 'text-text' : '',
          ]"
        >{{ opt.label }}</li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped></style>
