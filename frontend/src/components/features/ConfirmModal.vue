<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div class="flex items-start gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="danger ? 'bg-coral/10 text-coral' : 'bg-navy/10 text-navy'">
            <span class="w-5 h-5" v-html="danger ? ICON_ALERT : ICON_QUESTION"></span>
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-black text-navy leading-snug">{{ title }}</h3>
            <p class="text-sm text-text-secondary mt-1">{{ message }}</p>
          </div>
        </div>
        <div class="flex gap-3">
          <button @click="$emit('close')" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer hover:bg-surface">
            {{ cancelLabel || 'Cancelar' }}
          </button>
          <button @click="$emit('confirm')" :disabled="loading"
            class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-50"
            :class="danger ? 'bg-coral hover:bg-coral/80' : 'bg-navy hover:bg-navy-light'">
            {{ loading ? 'Procesando…' : (confirmLabel || 'Confirmar') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}>()
defineEmits<{ confirm: []; close: [] }>()

const ICON_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'
const ICON_QUESTION = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/></svg>'
</script>
