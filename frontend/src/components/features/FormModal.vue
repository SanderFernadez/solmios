<template>
  <AppModal size="lg" :title="title" body-class="p-6 space-y-3" @close="$emit('close')">
          <div v-for="f in fields" :key="f.key" :class="f.full === false ? '' : 'w-full'">
            <label :for="fieldId(f.key)" class="text-[10px] font-bold text-text-muted uppercase mb-1 block">
              {{ f.label }}<span v-if="f.required" class="text-coral"> *</span>
            </label>

            <select v-if="f.type === 'select'" :id="fieldId(f.key)" :name="f.key" v-model="values[f.key]" @change="clearError(f.key)" :disabled="readOnly"
              :required="f.required" :aria-required="f.required ? 'true' : undefined" :aria-invalid="!!fieldErrors[f.key]"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none cursor-pointer disabled:bg-surface disabled:cursor-default"
              :class="borderClass(f.key)">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="o in f.options || []" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>

            <textarea v-else-if="f.type === 'textarea'" :id="fieldId(f.key)" :name="f.key" v-model="values[f.key]" :placeholder="f.placeholder" :disabled="readOnly"
              :maxlength="f.maxLength" @input="clearError(f.key)"
              :required="f.required" :aria-required="f.required ? 'true' : undefined" :aria-invalid="!!fieldErrors[f.key]"
              rows="3" class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none disabled:bg-surface" :class="borderClass(f.key)"></textarea>

            <input v-else-if="f.type === 'number'" :id="fieldId(f.key)" :name="f.key" v-model.number="values[f.key]" type="number" :min="f.min" :max="f.max" :placeholder="f.placeholder" :disabled="readOnly"
              @input="clearError(f.key)"
              :required="f.required" :aria-required="f.required ? 'true' : undefined" :aria-invalid="!!fieldErrors[f.key]"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none disabled:bg-surface" :class="borderClass(f.key)" />

            <div v-else-if="f.type === 'file'">
              <input :id="fieldId(f.key)" :name="f.key" type="file" :accept="f.accept" @change="onFile($event, f.key)"
                :required="f.required" :aria-required="f.required ? 'true' : undefined"
                class="w-full text-sm text-text-secondary file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-navy file:text-white file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
                :class="fieldErrors[f.key] ? 'text-coral' : ''" />
              <p v-if="values[f.key]" class="text-[10px] font-bold text-teal mt-1">✓ {{ values[f.key + 'Name'] || 'archivo cargado' }}</p>
            </div>

            <!-- F5: multi-select de checkboxes (ej. catálogo fijo de alérgenos). values[f.key] es string[]. -->
            <div v-else-if="f.type === 'checkbox-group'" class="flex flex-wrap gap-1.5">
              <label v-for="o in f.options || []" :key="o.value"
                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-bold cursor-pointer select-none"
                :class="isChecked(f.key, o.value) ? 'bg-navy text-white border-navy' : 'border-border text-navy hover:bg-surface'">
                <input type="checkbox" :name="`${f.key}[]`" :value="o.value" class="hidden" :checked="isChecked(f.key, o.value)" :disabled="readOnly" @change="toggleCheckbox(f.key, o.value)" />
                {{ o.label }}
              </label>
            </div>

            <input v-else :id="fieldId(f.key)" :name="f.key" :type="f.type || 'text'" v-model="values[f.key]" :placeholder="f.placeholder" :disabled="readOnly"
              :maxlength="f.maxLength"
              :max="f.type === 'date' ? '9999-12-31' : (f.type === 'month' ? '9999-12' : undefined)"
              :min="f.type === 'date' ? '1900-01-01' : (f.type === 'month' ? '1900-01' : undefined)"
              :required="f.required" :aria-required="f.required ? 'true' : undefined" :aria-invalid="!!fieldErrors[f.key]"
              @input="clearError(f.key)" @blur="onBlur(f)"
              class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none disabled:bg-surface" :class="borderClass(f.key)" />

            <p v-if="fieldErrors[f.key]" role="alert" class="text-[10px] font-bold text-coral mt-1">{{ fieldErrors[f.key] }}</p>
            <p v-else-if="f.hint" class="text-[10px] text-text-muted mt-1">{{ f.hint }}</p>
          </div>

          <p v-if="error" class="text-xs font-bold text-coral">{{ error }}</p>

    <template #footer>
      <button @click="$emit('close')" class="flex-1 py-2.5 border-2 border-navy/30 rounded-xl text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface transition-colors">{{ readOnly ? 'Cerrar' : 'Cancelar' }}</button>
      <button v-if="!readOnly" @click="submit" :disabled="loading" class="flex-1 py-2.5 bg-navy border-2 border-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50 hover:bg-navy-light transition-colors">
        {{ loading ? 'Guardando…' : (submitLabel || 'Guardar') }}
      </button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'

export interface FormField {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'month' | 'time' | 'select' | 'textarea' | 'email' | 'tel' | 'password' | 'file' | 'checkbox-group'
  /** Solo para type 'file': filtro de tipos (ej: '.pdf,image/*'). El archivo se envía como data URL base64. */
  accept?: string
  /** Texto de ayuda gris bajo el campo (explica qué poner). */
  hint?: string
  required?: boolean
  /** Para 'select' y 'checkbox-group'. */
  options?: { value: string; label: string }[]
  placeholder?: string
  /** 'checkbox-group' usa un array de values marcados (ver defaultArray). */
  default?: string | number
  defaultArray?: string[]
  min?: number
  max?: number
  /** Tope de caracteres del input (evita reventar la columna en la DB). */
  maxLength?: number
  /** Mínimo de caracteres exigido al enviar (ej: contraseña). */
  minLength?: number
  full?: boolean
}

const props = defineProps<{ title: string; fields: FormField[]; submitLabel?: string; loading?: boolean; readOnly?: boolean }>()
// El evento sigue tipado como Record<string, string | number> (contrato histórico de todos los
// onSubmit existentes en el repo) — 'checkbox-group' agrega string[] SOLO puertas adentro de este
// componente; el payload final se castea al emitir (ver submit()) para no romper los ~12 callers.
const emit = defineEmits<{ close: []; submit: [values: Record<string, string | number>] }>()

const values = reactive<Record<string, string | number | string[]>>({})
const fieldErrors = reactive<Record<string, string>>({})
const error = ref('')

// Los defaults se siembran al montar y cada vez que cambia el esquema (reutilizamos un solo modal).
watch(() => props.fields, (fields) => {
  for (const key of Object.keys(values)) delete values[key]
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
  // Los numéricos arrancan VACÍOS (no 0): un 0 fallaba validaciones con min ≥ 1 (ej: puntaje 1-10)
  // aunque el campo fuera opcional. Vacío + opcional = válido; vacío + requerido = "es requerido".
  for (const f of fields) {
    if (f.type === 'checkbox-group') values[f.key] = f.defaultArray ? [...f.defaultArray] : []
    else values[f.key] = f.default ?? ''
  }
  error.value = ''
}, { immediate: true })

/** F5: helpers del multi-select de checkboxes (allergens y similares). */
function isChecked(key: string, value: string): boolean {
  const arr = values[key]
  return Array.isArray(arr) && arr.includes(value)
}
function toggleCheckbox(key: string, value: string): void {
  const arr = Array.isArray(values[key]) ? [...(values[key] as string[])] : []
  const idx = arr.indexOf(value)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(value)
  values[key] = arr
  clearError(key)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const digitCount = (s: string): number => (s.match(/\d/g) || []).length

// #646 — id/name/label asociados de verdad (antes el <label> no tenía `for`, así que
// visualmente había texto pero un lector de pantalla no lo vinculaba al input).
function fieldId(key: string): string {
  return `formmodal-${key}`
}

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
function validateField(f: FormField, raw: string | number | string[]): string {
  // F5: checkbox-group no tiene validaciones de texto/número (required tampoco aplica — 0 tags es válido).
  if (f.type === 'checkbox-group') return ''
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
  if (f.type === 'number') {
    const n = Number(raw)
    if (Number.isNaN(n)) return 'Debe ser un número'
    if (f.min != null && n < f.min) return `Mínimo ${f.min}`
    if (f.max != null && n > f.max) return `Máximo ${f.max}`
  }
  if (f.type === 'date') {
    // El año debe ser de 4 dígitos y en un rango sensato (evita fechas rotas en la DB) — #171/#178.
    const year = Number(str.slice(0, 4))
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || year < 1900 || year > 9999) return 'Fecha inválida (año de 4 dígitos)'
  }
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
  // Un numérico vacío se omite (no se manda '' — el backend espera número o nada).
  const payload: Record<string, string | number | string[]> = {}
  const numberKeys = new Set(props.fields.filter((f) => f.type === 'number').map((f) => f.key))
  for (const [k, v] of Object.entries(values)) {
    if (numberKeys.has(k) && (v === '' || v === null || v === undefined)) continue
    payload[k] = v
  }
  // string[] (checkbox-group) viaja dentro del Record pese al tipo declarado del evento — ver comentario en emit.
  emit('submit', payload as Record<string, string | number>)
}
</script>
