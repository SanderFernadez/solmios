<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/50 backdrop-blur-sm" @click="closeOnBackdrop && emit('close')"></div>
        <div class="app-modal-panel relative flex flex-col w-full max-h-[92vh] overflow-hidden rounded-[20px] border-2 border-navy bg-white shadow-2xl" :class="sizeClass">
          <!-- Header oscuro (mismo look en todo el sistema) -->
          <div v-if="title || $slots.header" class="shrink-0 flex items-center justify-between gap-3 bg-navy px-5 py-4">
            <slot name="header">
              <div class="min-w-0">
                <h3 class="text-base sm:text-lg font-black text-white truncate">{{ title }}</h3>
                <p v-if="subtitle" class="text-[11px] text-white/60 mt-0.5 truncate">{{ subtitle }}</p>
              </div>
            </slot>
            <button v-if="closable" @click="emit('close')" aria-label="Cerrar"
              class="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">✕</button>
          </div>

          <!-- Cuerpo -->
          <div class="flex-1 overflow-y-auto p-5">
            <slot />
          </div>

          <!-- Footer (acciones) -->
          <div v-if="$slots.footer" class="shrink-0 flex items-center justify-end gap-3 border-t-2 border-navy bg-surface px-5 py-4">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closable?: boolean
  closeOnBackdrop?: boolean
}>(), { open: true, size: 'md', closable: true, closeOnBackdrop: true })

const emit = defineEmits<{ close: [] }>()

const SIZES: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-5xl' }
const sizeClass = computed(() => SIZES[props.size] || SIZES.md)
</script>

<style scoped>
.app-modal-enter-active, .app-modal-leave-active { transition: opacity 0.2s ease; }
.app-modal-enter-from, .app-modal-leave-to { opacity: 0; }
.app-modal-enter-active .app-modal-panel, .app-modal-leave-active .app-modal-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.app-modal-enter-from .app-modal-panel, .app-modal-leave-to .app-modal-panel {
  opacity: 0; transform: scale(0.96) translateY(12px);
}
</style>
