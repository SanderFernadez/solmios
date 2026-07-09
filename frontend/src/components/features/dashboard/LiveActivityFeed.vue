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

    <div class="cc-feed flex-1 overflow-y-auto px-3 py-2">
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
      <div v-if="!items.length" class="px-3 py-8 text-center text-xs text-slate-500">Sin actividad reciente</div>
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
.cc-feed { max-height: 340px; }
.feed-enter-active { transition: all 0.3s ease; }
.feed-enter-from { opacity: 0; transform: translateX(16px); }
.feed-move { transition: transform 0.3s ease; }
</style>
