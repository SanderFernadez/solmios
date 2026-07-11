<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between p-6 pb-4 shrink-0">
          <h3 class="text-lg font-black text-navy">{{ title }}</h3>
          <button @click="$emit('close')" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
            <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
          </button>
        </div>

        <div class="overflow-y-auto px-6 space-y-3">
          <div v-for="f in fields" :key="f.key" :class="f.full === false ? '' : 'w-full'">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">
              {{ f.label }}<span v-if="f.required" class="text-coral"> *</span>
            </label>

            <select v-if="f.type === 'select'" v-model="values[f.key]" @change="clearError(f.key)"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none cursor-pointer"
              :class="borderClass(f.key)">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="o in f.options || []" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>

            <textarea v-else-if="f.type === 'textarea'" v-model="values[f.key]" :placeholder="f.placeholder"
              :maxlength="f.maxLength" @input="clearError(f.key)"
              rows="3" class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" :class="borderClass(f.key)"></textarea>

            <input v-else-if="f.type === 'number'" v-model.number="values[f.key]" type="number" :min="f.min" :max="f.max" :placeholder="f.placeholder"
              @input="clearError(f.key)"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" :class="borderClass(f.key)" />

            <div v-else-if="f.type === 'file'">
              <input type="file" :accept="f.accept" @change="onFile($event, f.key)"
                class="w-full text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-navy file:text-white file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
                :class="fieldErrors[f.key] ? 'text-coral' : ''" />
              <p v-if="values[f.key]" class="text-[10px] font-bold text-teal mt-1">✓ {{ values[f.key + 'Name'] || 'archivo cargado' }}</p>
            </div>

            <input v-else :type="f.type || 'text'" v-model="values[f.key]" :placeholder="f.placeholder"
              :maxlength="f.maxLength"
              @input="clearError(f.key)" @blur="onBlur(f)"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none" :class="borderClass(f.key)" />

            <p v-if="fieldErrors[f.key]" class="text-[10px] font-bold text-coral mt-1">{{ fieldErrors[f.key] }}</p>
            <p v-else-if="f.hint" class="text-[10px] text-text-muted mt-1">{{ f.hint }}</p>
          </div>

          <p v-if="error" class="text-xs font-bold text-coral">{{ error }}</p>
        </div>

        <div class="flex gap-3 p-6 pt-4 shrink-0">
          <button @click="$emit('close')" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
          <button @click="submit" :disabled="loading" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
            {{ loading ? 'Guardando…' : (submitLabel || 'Guardar') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'

export interface FormField {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'month' | 'select' | 'textarea' | 'email' | 'tel' | 'password' | 'file'
  /** Solo para type 'file': filtro de tipos (ej: '.pdf,image/*'). El archivo se envía como data URL base64. */
  accept?: string
  /** Texto de ayuda gris bajo el campo (explica qué poner). */
  hint?: string
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  default?: string | number
  min?: number
  max?: number
  /** Tope de caracteres del input (evita reventar la columna en la DB). */
  maxLength?: number
  /** Mínimo de caracteres exigido al enviar (ej: contraseña). */
  minLength?: number
  full?: boolean
}

const props = defineProps<{ title: string; fields: FormField[]; submitLabel?: string; loading?: boolean }>()
const emit = defineEmits<{ close: []; submit: [values: Record<string, string | number>] }>()

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'

const values = reactive<Record<string, string | number>>({})
const fieldErrors = reactive<Record<string, string>>({})
const error = ref('')

// Los defaults se siembran al montar y cada vez que cambia el esquema (reutilizamos un solo modal).
watch(() => props.fields, (fields) => {
  for (const key of Object.keys(values)) delete values[key]
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  for (const f of fields) values[f.key] = f.default ?? (f.type === 'number' ? 0 : '')
  error.value = ''
}, { immediate: true })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digitCount = (s: string): number => (s.match(/\d/g) || []).length

function borderClass(key: string): string {
  return fieldErrors[key] ? 'border-coral focus:border-coral' : 'border-border focus:border-navy'
}

/** Al escribir en un campo, se limpia su error para que el rojo no quede pegado. */
function clearError(key: string): void {
  if (fieldErrors[key]) { fieldErrors[key] = ''; error.value = '' }
}

/** Lee el archivo como data URL base64 (el backend no acepta multipart — va en JSON). Guarda el
 *  contenido en `values[key]` y el nombre en `values[key+'Name']`. */
function onFile(e: Event, key: string): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) { values[key] = ''; return }
  const reader = new FileReader()
  reader.onload = () => { values[key] = String(reader.result); values[`${key}Name`] = file.name; clearError(key) }
  reader.readAsDataURL(file)
}

/** Formatea un teléfono dominicano de 10 dígitos como 809-555-0000 al salir del campo. */
function onBlur(f: FormField): void {
  if (f.type !== 'tel') return
  const digitsOnly = String(values[f.key] || '').replace(/\D/g, '')
  if (digitsOnly.length === 10) values[f.key] = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
}

/** Devuelve el mensaje de error del campo, o '' si es válido. */
function validateField(f: FormField, raw: string | number): string {
  const str = typeof raw === 'string' ? raw.trim() : String(raw ?? '')
  const isEmpty = str === '' || raw === null || raw === undefined
  if (f.required && isEmpty) return `${f.label} es requerido`
  if (isEmpty) return ''   // campo opcional y vacío → válido
  if (f.type === 'email' && !EMAIL_RE.test(str)) return 'Email inválido (ej: nombre@hotel.com)'
  if (f.type === 'tel') {
    const d = digitCount(str)
    if (d < 10 || d > 15) return 'Teléfono inválido (10 dígitos, ej: 809-555-0000)'
  }
  if (f.minLength && str.length < f.minLength) return `Mínimo ${f.minLength} caracteres`
  if (f.maxLength && str.length > f.maxLength) return `Máximo ${f.maxLength} caracteres`
  return ''
}

function submit() {
  let hasError = false
  for (const f of props.fields) {
    const msg = validateField(f, values[f.key])
    fieldErrors[f.key] = msg
    if (msg) hasError = true
  }
  if (hasError) {
    error.value = 'Revisá los campos marcados en rojo.'
    return
  }
  error.value = ''
  emit('submit', { ...values })
}
</script>
