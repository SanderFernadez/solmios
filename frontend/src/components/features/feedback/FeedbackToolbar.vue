<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useFeedbackStore } from '@/stores/feedback.store'

const route = useRoute()
const store = useFeedbackStore()
</script>

<template>
  <div class="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
    <transition name="fb-panel">
      <div
        v-if="store.isFeedbackMode"
        class="bg-white dark:bg-navy-light rounded-2xl shadow-lg border border-border dark:border-white/10 p-4 w-64"
      >
        <div class="flex items-center gap-2 mb-3">
          <span class="w-2 h-2 rounded-full bg-coral animate-pulse" />
          <span class="text-xs font-bold text-navy dark:text-white uppercase tracking-wide">Feedback Mode</span>
        </div>
        <div class="text-xs text-text-secondary dark:text-gray-400 mb-3">
          {{ store.routePins.length }} pin{{ store.routePins.length !== 1 ? 's' : '' }} en esta ruta
        </div>
        <div class="flex items-center gap-2 text-[11px] text-text-muted dark:text-gray-500">
          <kbd class="px-1.5 py-0.5 bg-surface-dark dark:bg-navy rounded text-[10px] font-mono">ESC</kbd>
          <span>para desactivar</span>
        </div>
      </div>
    </transition>

    <button
      class="w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center text-xl transition-all duration-200 cursor-pointer border-2"
      :class="store.isFeedbackMode
        ? 'bg-coral text-white border-coral shadow-coral/30 hover:bg-coral-light scale-110'
        : 'bg-white dark:bg-navy-light text-navy dark:text-white border-border dark:border-white/10 hover:border-coral hover:text-coral'"
      :title="store.isFeedbackMode ? 'Desactivar Feedback Mode' : 'Activar Feedback Mode'"
      @click="store.isFeedbackMode ? store.disableFeedbackMode() : store.enableFeedbackMode(route.fullPath)"
    >
      <svg v-if="store.isFeedbackMode" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.fb-panel-enter-active,
.fb-panel-leave-active {
  transition: all 0.2s ease;
}
.fb-panel-enter-from,
.fb-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
