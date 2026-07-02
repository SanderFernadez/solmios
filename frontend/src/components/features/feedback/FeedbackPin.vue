<script setup lang="ts">
import type { FeedbackPin } from '@/types'

const props = defineProps<{
  pin: FeedbackPin
  index: number
  selected: boolean
}>()

const emit = defineEmits<{
  select: [pin: FeedbackPin]
}>()

const priorityColors: Record<string, string> = {
  high: 'bg-coral text-white border-coral',
  medium: 'bg-gold text-white border-gold',
  low: 'bg-blue text-white border-blue',
}

const categoryLabels: Record<string, string> = {
  UI: 'UI',
  Bug: 'Bug',
  Improvement: 'Mejora',
}

const statusDots: Record<string, string> = {
  open: 'bg-coral',
  in_progress: 'bg-gold',
  done: 'bg-success',
}
</script>

<template>
  <div
    class="fb-pin group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10"
    :style="{ left: `${pin.x}px`, top: `${pin.y}px` }"
    @click.stop="emit('select', pin)"
  >
    <div
      class="relative flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-black shadow-lg transition-transform duration-150"
      :class="[
        selected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110',
        priorityColors[pin.priority] ?? priorityColors.medium,
      ]"
    >
      {{ index + 1 }}

      <div
        class="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
        :class="statusDots[pin.status] ?? statusDots.open"
      />
    </div>

    <transition name="fb-tooltip">
      <div
        v-if="pin.comment"
        class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-navy dark:bg-gray-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
      >
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="px-1 py-0.5 rounded text-[9px] font-bold uppercase" :class="pin.priority === 'high' ? 'bg-coral/30 text-coral' : pin.priority === 'medium' ? 'bg-gold/30 text-gold' : 'bg-blue/30 text-blue'">
            {{ categoryLabels[pin.category] ?? pin.category }}
          </span>
        </div>
        <div class="max-w-[200px] truncate text-gray-200">
          {{ pin.comment }}
        </div>
        <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-navy dark:border-t-gray-800" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fb-pin {
  will-change: transform;
}

.fb-tooltip-enter-active,
.fb-tooltip-leave-active {
  transition: opacity 0.15s ease;
}
.fb-tooltip-enter-from,
.fb-tooltip-leave-to {
  opacity: 0;
}
</style>
