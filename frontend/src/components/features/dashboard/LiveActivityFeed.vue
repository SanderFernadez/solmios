<template>
  <div class="flex flex-col overflow-hidden rounded-[20px] border border-border bg-white shadow-(--shadow-card)">
    <div class="flex items-center justify-between border-b border-border px-5 py-4">
      <h2 class="text-xs font-black uppercase tracking-wider text-navy">Actividad en Tiempo Real</h2>
      <span class="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-[#16A34A]">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]"></span>
        </span>
        En vivo
      </span>
    </div>

    <div class="cc-feed flex flex-1 flex-col overflow-y-auto px-3 py-2">
      <TransitionGroup name="feed" tag="div">
        <div v-for="item in items" :key="item.id" class="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface">
          <span class="w-10 shrink-0 pt-0.5 text-right font-mono text-[10px] font-bold tabular-nums text-text-muted">{{ item.time }}</span>
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm" :style="{ background: `${item.color}1A`, color: item.color }" v-html="item.icon"></span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-bold text-navy">{{ item.title }}</div>
            <div class="truncate text-[10px] text-text-secondary">{{ item.subtitle }}</div>
          </div>
          <ChannelIcon v-if="item.channel" :channel="item.channel" :size="16" class="shrink-0 ring-1 ring-black/5 rounded-[4px]" />
          <span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold" :style="{ background: `${item.color}1A`, color: item.color }">
            {{ item.badge }}
          </span>
        </div>
      </TransitionGroup>
      <div v-if="!items.length" class="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-8 text-center">
        <span class="grid h-12 w-12 place-items-center rounded-full bg-surface text-text-muted">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l2-7 4 14 2-7h6" />
          </svg>
        </span>
        <p class="text-xs text-text-muted">Sin actividad reciente</p>
      </div>
    </div>

    <router-link to="/panel/notifications"
      class="block border-t border-border px-5 py-3 text-center text-[11px] font-extrabold text-text-secondary transition-colors hover:bg-surface hover:text-navy">
      Ver todas las actividades
    </router-link>
  </div>
</template>

<script setup lang="ts">
import ChannelIcon from '@/components/ui/ChannelIcon.vue'

export interface FeedItem {
  id: string
  time: string
  title: string
  subtitle: string
  badge: string
  color: string
  icon: string
  /** Canal/vía de origen de la reserva (booking, airbnb, direct, ...) — muestra el logo si viene presente. */
  channel?: string
}

defineProps<{ items: FeedItem[] }>()
</script>

<style scoped>
.feed-enter-active { transition: all 0.3s ease; }
.feed-enter-from { opacity: 0; transform: translateX(16px); }
.feed-move { transition: transform 0.3s ease; }
</style>
