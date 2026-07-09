<template>
  <div class="rounded-[20px] border border-white/8 bg-[#0B1526] p-5">
    <h2 class="text-xs font-black uppercase tracking-wider text-white">Habitaciones por Estado</h2>
    <div class="mt-4 flex items-center gap-5">
      <!-- Donut -->
      <div class="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 42 42" class="h-28 w-28 -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5" />
          <circle v-for="seg in segments" :key="seg.label" cx="21" cy="21" r="15.9" fill="none"
            :stroke="seg.color" stroke-width="5" stroke-linecap="butt"
            :stroke-dasharray="`${seg.pct} ${100 - seg.pct}`" :stroke-dashoffset="-seg.offset"
            class="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out" />
        </svg>
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-center">
            <div class="text-2xl font-black tabular-nums text-white leading-none">{{ total }}</div>
            <div class="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Total</div>
          </div>
        </div>
      </div>

      <!-- Leyenda -->
      <div class="min-w-0 flex-1 space-y-2">
        <div v-for="seg in segments" :key="seg.label" class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-300">
            <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ background: seg.color }"></span>
            <span class="truncate">{{ seg.label }}</span>
          </span>
          <span class="shrink-0 text-xs font-black tabular-nums text-white">{{ seg.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ byStatus: Record<string, number> }>()

const META: Array<{ key: string; label: string; color: string }> = [
  { key: 'occupied', label: 'Ocupadas', color: '#2563EB' },
  { key: 'available', label: 'Disponibles', color: '#22C55E' },
  { key: 'cleaning', label: 'Limpieza', color: '#F59E0B' },
  { key: 'dirty', label: 'Sucias', color: '#FB923C' },
  { key: 'pending', label: 'Pendientes', color: '#06B6D4' },
  { key: 'out_of_service', label: 'Mantenimiento', color: '#EF4444' },
]

const total = computed(() => Object.values(props.byStatus).reduce((a, b) => a + (b || 0), 0))

const segments = computed(() => {
  if (!total.value) return []
  let offset = 0
  return META
    .map(m => ({ ...m, count: props.byStatus[m.key] ?? 0 }))
    .filter(m => m.count > 0)
    .map(m => {
      const pct = (m.count / total.value) * 100
      const seg = { label: m.label, color: m.color, count: m.count, pct, offset }
      offset += pct
      return seg
    })
})
</script>
