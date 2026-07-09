<template>
  <div class="flex flex-col overflow-hidden rounded-[20px] border border-white/8 bg-[#0B1526]">
    <div class="flex items-center justify-between border-b border-white/8 px-5 py-4">
      <h2 class="text-xs font-black uppercase tracking-wider text-white">Actividad en Tiempo Real</h2>
      <span class="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-[#22C55E]">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]"></span>
        </span>
        En vivo
      </span>
    </div>

    <div class="cc-feed flex flex-1 flex-col overflow-y-auto px-3 py-2">
      <TransitionGroup name="feed" tag="div">
        <div v-for="item in items" :key="item.id" class="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/3">
          <span class="w-10 shrink-0 pt-0.5 text-right font-mono text-[10px] font-bold tabular-nums text-slate-500">{{ item.time }}</span>
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm" :style="{ background: `${item.color}22`, color: item.color }" v-html="item.icon"></span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-bold text-white">{{ item.title }}</div>
            <div class="truncate text-[10px] text-slate-400">{{ item.subtitle }}</div>
          </div>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" :style="{ background: `${item.color}22`, color: item.color }">
            {{ item.badge }}
          </span>
        </div>
      </TransitionGroup>
      <div v-if="!items.length" class="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
        <span class="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-slate-500">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l2-7 4 14 2-7h6" />
          </svg>
        </span>
        <p class="text-xs text-slate-500">Sin actividad reciente</p>
      </div>
    </div>

    <router-link to="/panel/notifications"
      class="block border-t border-white/8 px-5 py-3 text-center text-[11px] font-extrabold text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
      Ver todas las actividades
    </router-link>
  </div>
</template>

<script setup lang="ts">
export interface FeedItem {
  id: string
  time: string
  title: string
  subtitle: string
  badge: string
  color: string
  icon: string
}

defineProps<{ items: FeedItem[] }>()
</script>

<style scoped>
.feed-enter-active { transition: all 0.3s ease; }
.feed-enter-from { opacity: 0; transform: translateX(16px); }
.feed-move { transition: transform 0.3s ease; }
</style>
