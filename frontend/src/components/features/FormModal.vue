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

            <select v-if="f.type === 'select'" v-model="values[f.key]"
              class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="" disabled>Seleccionar…</option>
              <option v-for="o in f.options || []" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>

            <textarea v-else-if="f.type === 'textarea'" v-model="values[f.key]" :placeholder="f.placeholder"
              rows="3" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy"></textarea>

            <input v-else-if="f.type === 'number'" v-model.number="values[f.key]" type="number" :min="f.min" :placeholder="f.placeholder"
              class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />

            <input v-else :type="f.type || 'text'" v-model="values[f.key]" :placeholder="f.placeholder"
              class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
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
  type?: 'text' | 'number' | 'date' | 'month' | 'select' | 'textarea'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  default?: string | number
  min?: number
  full?: boolean
}

const props = defineProps<{ title: string; fields: FormField[]; submitLabel?: string; loading?: boolean }>()
const emit = defineEmits<{ close: []; submit: [values: Record<string, string | number>] }>()

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'

const values = reactive<Record<string, string | number>>({})
const error = ref('')

// Los defaults se siembran al montar y cada vez que cambia el esquema (reutilizamos un solo modal).
watch(() => props.fields, (fields) => {
  for (const key of Object.keys(values)) delete values[key]
  for (const f of fields) values[f.key] = f.default ?? (f.type === 'number' ? 0 : '')
  error.value = ''
}, { immediate: true })

function submit() {
  for (const f of props.fields) {
    const v = values[f.key]
    if (f.required && (v === '' || v === null || v === undefined)) {
      error.value = `${f.label} es requerido`
      return
    }
  }
  error.value = ''
  emit('submit', { ...values })
}
</script>
