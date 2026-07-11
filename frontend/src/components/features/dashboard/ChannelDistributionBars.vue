<template>
  <div class="rounded-[20px] border border-border bg-white p-5 shadow-(--shadow-card)">
    <h2 class="text-xs font-black uppercase tracking-wider text-navy">Distribución por Canal</h2>
    <div class="mt-4 space-y-3.5">
      <div v-for="c in channels" :key="c.label">
        <div class="mb-1 flex items-center justify-between text-[11px]">
          <span class="font-bold text-text-secondary">{{ c.label }}</span>
          <span class="font-extrabold tabular-nums text-navy">{{ c.pct }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full transition-[width] duration-700 ease-out"
            :style="{ width: `${c.pct}%`, background: c.color, boxShadow: `0 0 8px ${c.color}44` }"></div>
        </div>
      </div>
      <div v-if="!channels.length" class="py-4 text-center text-xs text-text-muted">Sin reservas en el período</div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ChannelSlice { label: string; pct: number; count: number; color: string }
defineProps<{ channels: ChannelSlice[] }>()
</script>
