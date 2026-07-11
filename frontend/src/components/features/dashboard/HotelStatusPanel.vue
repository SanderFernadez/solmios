<template>
  <div class="rounded-[20px] border border-border bg-white p-5 shadow-(--shadow-card)">
    <h2 class="text-xs font-black uppercase tracking-wider text-navy">Estado del Hotel</h2>
    <div class="mt-4 space-y-1">
      <div v-for="s in services" :key="s.label" class="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-surface">
        <span class="text-xs font-bold text-text-secondary">{{ s.label }}</span>
        <span class="flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-extrabold" :style="{ background: `${toneColor(s.tone)}1A`, color: toneColor(s.tone) }">
          <span class="relative flex h-1.5 w-1.5">
            <span v-if="s.tone === 'ok' || s.tone === 'sync'" class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" :style="{ background: toneColor(s.tone) }"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full" :style="{ background: toneColor(s.tone) }"></span>
          </span>
          {{ s.status }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ServiceStatus {
  label: string
  status: string
  tone: 'ok' | 'sync' | 'warn' | 'error' | 'off'
}

defineProps<{ services: ServiceStatus[] }>()

const TONE_COLORS: Record<ServiceStatus['tone'], string> = {
  ok: '#22C55E',
  sync: '#06B6D4',
  warn: '#F59E0B',
  error: '#EF4444',
  off: '#64748B',
}
function toneColor(tone: ServiceStatus['tone']) { return TONE_COLORS[tone] }
</script>
