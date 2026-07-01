<template>
  <div class="card p-5">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-xs font-black text-navy uppercase">{{ label }}</h4>
      <span v-if="data.length > 0" class="text-[10px] text-text-muted">{{ data.length }} días</span>
    </div>
    <div v-if="data.length === 0" class="text-xs text-text-muted py-8 text-center">Sin datos para el rango seleccionado</div>
    <div v-else>
      <div class="flex items-end gap-0.5 h-32">
        <div v-for="d in data" :key="d.date" class="flex-1 flex flex-col items-center gap-1 group cursor-pointer min-w-0">
          <div class="text-[7px] font-bold text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{{ format(d.value) }}</div>
          <div class="w-full rounded-t transition-all hover:opacity-80 min-h-[2px]"
            :class="barColor(d.value)"
            :style="{ height: barHeight(d.value) + '%' }"
            :title="d.date + ': ' + format(d.value)"></div>
        </div>
      </div>
      <div class="flex justify-between text-[9px] text-text-muted mt-1">
        <span>{{ shortDate(data[0]?.date) }}</span>
        <span v-if="data.length > 1">{{ shortDate(data[data.length - 1]?.date) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: Array<{ date: string; value: number }>
  format: (v: number) => string
  label: string
}>()

const maxValue = computed(() => Math.max(...props.data.map(d => d.value), 1))

function barHeight(v: number): number {
  return Math.max(2, Math.round((v / maxValue.value) * 100))
}

function barColor(v: number): string {
  const pct = v / maxValue.value
  if (pct > 0.8) return 'bg-cyan'
  if (pct > 0.5) return 'bg-teal'
  if (pct > 0.25) return 'bg-gold'
  return 'bg-gray-300'
}

function shortDate(d?: string): string {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
</script>

<style scoped></style>
