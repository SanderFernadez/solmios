<template>
  <div class="rounded-[20px] border border-white/8 bg-[#0B1526] p-5">
    <h2 class="text-xs font-black uppercase tracking-wider text-white">Distribución por Canal</h2>
    <div class="mt-4 space-y-3.5">
      <div v-for="c in channels" :key="c.label">
        <div class="mb-1 flex items-center justify-between text-[11px]">
          <span class="font-bold text-slate-300">{{ c.label }}</span>
          <span class="font-extrabold tabular-nums text-white">{{ c.pct }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-white/6">
          <div class="h-full rounded-full transition-[width] duration-700 ease-out"
            :style="{ width: `${c.pct}%`, background: c.color, boxShadow: `0 0 8px ${c.color}66` }"></div>
        </div>
      </div>
      <div v-if="!channels.length" class="py-4 text-center text-xs text-slate-500">Sin reservas en el período</div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ChannelSlice { label: string; pct: number; count: number; color: string }
defineProps<{ channels: ChannelSlice[] }>()
</script>
