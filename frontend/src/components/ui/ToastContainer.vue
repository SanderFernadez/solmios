<script setup lang="ts">
// components/ui/ToastContainer.vue — Renderiza los toasts (F1). Se monta global en App.vue.
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()

const styles: Record<string, { bg: string; border: string; icon: string; iconBg: string; title: string }> = {
  success: { bg: 'bg-white', border: 'border-l-4 border-teal', icon: '✓', iconBg: 'bg-teal/10 text-teal', title: 'text-navy' },
  error: { bg: 'bg-white', border: 'border-l-4 border-coral', icon: '✕', iconBg: 'bg-coral/10 text-coral', title: 'text-navy' },
  warning: { bg: 'bg-white', border: 'border-l-4 border-gold', icon: '⚠', iconBg: 'bg-gold/10 text-gold', title: 'text-navy' },
  info: { bg: 'bg-white', border: 'border-l-4 border-blue', icon: 'ℹ', iconBg: 'bg-blue/10 text-blue', title: 'text-navy' },
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[360px]">
      <transition-group name="toast" tag="div" class="flex flex-col gap-2">
        <div
          v-for="t in toasts"
          :key="t.id"
          @mouseenter=""
          class="rounded-xl shadow-lg border border-border p-4 flex items-start gap-3 cursor-pointer"
          :class="[styles[t.variant].bg, styles[t.variant].border]"
          @click="dismiss(t.id)"
        >
          <span class="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0" :class="styles[t.variant].iconBg">{{ styles[t.variant].icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-bold" :class="styles[t.variant].title">{{ t.title }}</div>
            <div v-if="t.message" class="text-xs text-text-muted mt-0.5">{{ t.message }}</div>
          </div>
          <button class="text-text-muted hover:text-navy text-sm flex-shrink-0" @click.stop="dismiss(t.id)">✕</button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
