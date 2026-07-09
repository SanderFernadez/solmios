<template>
  <div class="relative overflow-hidden rounded-[20px] border border-[#06B6D4]/25 bg-[#0B1526] p-5">
    <div class="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-[#06B6D4]/12 blur-3xl cc-breathe"></div>

    <div class="relative flex items-center justify-between">
      <h2 class="text-xs font-black uppercase tracking-wider text-white">IA Hotel</h2>
      <span class="flex items-center gap-1.5 rounded-full bg-[#06B6D4]/12 px-2.5 py-1 text-[9px] font-extrabold uppercase text-[#22D3EE]">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22D3EE]"></span>
        Analizando
      </span>
    </div>

    <div class="relative mt-4 flex gap-4">
      <!-- Avatar -->
      <div class="relative hidden sm:grid h-20 w-20 shrink-0 place-items-center">
        <div class="absolute inset-0 rounded-full bg-gradient-to-br from-[#2563EB]/40 to-[#06B6D4]/40 blur-md cc-breathe"></div>
        <div class="relative grid h-16 w-16 place-items-center rounded-2xl border border-[#06B6D4]/40 bg-gradient-to-br from-[#0E1B33] to-[#0B2438] text-4xl shadow-[0_0_28px_rgba(6,182,212,0.35)]">
          🤖
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-black text-white">{{ greeting }}, {{ userName }} 👋</p>
        <p class="mt-0.5 text-[11px] text-slate-400">Analicé los datos del hotel y esto es lo que encontré:</p>

        <ul class="mt-3 space-y-2">
          <li v-for="(ins, i) in insights" :key="i" class="flex items-start gap-2 text-xs" :style="{ animationDelay: `${i * 80}ms` }">
            <span class="mt-0.5 shrink-0" :class="TONE_TEXT[ins.tone]">{{ TONE_ICON[ins.tone] }}</span>
            <span class="text-slate-300" v-html="ins.text"></span>
          </li>
          <li v-if="!insights.length" class="text-xs text-slate-500">Sin hallazgos por ahora — todo dentro de lo esperado. ✨</li>
        </ul>
      </div>
    </div>

    <router-link to="/panel/ai-receptionist"
      class="relative mt-4 block rounded-xl border border-[#2563EB]/40 bg-[#2563EB]/12 px-4 py-2.5 text-center text-[11px] font-extrabold text-[#93C5FD] transition-all hover:bg-[#2563EB]/25 hover:text-white">
      Ver todas las recomendaciones
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface AiInsight { text: string; tone: 'ok' | 'warn' | 'danger' | 'info' }

defineProps<{ userName: string; insights: AiInsight[] }>()

const TONE_ICON: Record<AiInsight['tone'], string> = { ok: '✅', warn: '⚠️', danger: '🚨', info: '💡' }
const TONE_TEXT: Record<AiInsight['tone'], string> = {
  ok: 'text-[#22C55E]', warn: 'text-[#F59E0B]', danger: 'text-[#EF4444]', info: 'text-[#22D3EE]',
}

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
})
</script>

<style scoped>
.cc-breathe { animation: cc-breathe 5s ease-in-out infinite; }
@keyframes cc-breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
