<template>
  <div class="cc-kpi group relative overflow-hidden rounded-[18px] p-5 transition-transform duration-300 hover:-translate-y-0.5"
    :style="{ background: theme.bg, border: `1.5px solid ${theme.borderColor}`, boxShadow: `0 0 28px ${theme.outerGlow}, inset 0 1px 0 rgba(255,255,255,0.06)` }">
    <!-- glow que respira -->
    <div class="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full blur-3xl cc-breathe" :style="{ background: theme.glow }"></div>

    <div class="relative flex items-start justify-between">
      <div class="text-[11px] font-extrabold uppercase tracking-[2px]" :style="{ color: theme.labelColor }">{{ label }}</div>

      <!-- Anillo de progreso u ícono -->
      <div v-if="progress !== undefined && progress !== null" class="relative -mt-1 h-16 w-16 shrink-0">
        <svg viewBox="0 0 36 36" class="h-16 w-16 -rotate-90" :style="{ filter: `drop-shadow(0 0 6px ${theme.outerGlow})` }">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3.4" />
          <circle cx="18" cy="18" r="15.5" fill="none" :stroke="theme.stroke" stroke-width="3.4" stroke-linecap="round"
            :stroke-dasharray="`${ringDash} 100`" class="transition-[stroke-dasharray] duration-700 ease-out" />
        </svg>
        <div class="absolute inset-0 grid place-items-center">
          <span class="text-lg" v-html="icon"></span>
        </div>
      </div>
      <div v-else class="grid h-12 w-12 place-items-center rounded-full text-xl"
        :style="{ background: theme.glow, boxShadow: `0 0 16px ${theme.outerGlow}` }">
        <span v-html="icon"></span>
      </div>
    </div>

    <!-- Número gigante -->
    <div class="relative mt-1 flex items-baseline gap-2">
      <span class="font-black tabular-nums leading-none tracking-tight text-white text-[clamp(48px,3.8vw,72px)]"
        :style="{ textShadow: `0 0 30px ${theme.outerGlow}` }">
        {{ prefix }}{{ formatted }}<span v-if="suffix" class="text-[0.55em] font-extrabold" :style="{ color: theme.labelColor }">{{ suffix }}</span>
      </span>
    </div>
    <div v-if="unit" class="mt-1 text-xs font-semibold text-slate-400">{{ unit }}</div>

    <!-- Barra de progreso lineal -->
    <div v-if="progress !== undefined && progress !== null" class="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div class="h-full rounded-full transition-[width] duration-700 ease-out"
        :style="{ width: `${clampedProgress}%`, background: theme.stroke, boxShadow: `0 0 8px ${theme.stroke}` }"></div>
    </div>

    <!-- Sparkline -->
    <svg v-if="spark && spark.length > 1" class="relative mt-3 h-10 w-full" :viewBox="`0 0 100 24`" preserveAspectRatio="none">
      <polyline :points="sparkPoints" fill="none" :stroke="theme.stroke" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"
        :style="{ filter: `drop-shadow(0 0 3px ${theme.stroke})` }" />
      <polygon :points="`0,24 ${sparkPoints} 100,24`" :fill="theme.stroke" opacity="0.15" />
    </svg>

    <!-- Sub-stats + tendencia -->
    <div class="relative mt-3 flex items-end justify-between gap-2">
      <div class="flex gap-4">
        <div v-for="s in subStats ?? []" :key="s.label">
          <div class="text-lg font-black leading-none tabular-nums" :class="s.tone ?? 'text-white'">{{ s.value }}</div>
          <div class="mt-1 text-[10px] font-semibold text-slate-400">{{ s.label }}</div>
        </div>
      </div>
      <div v-if="trend !== undefined && trend !== null"
        class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums"
        :class="trend >= 0 ? 'bg-[#22C55E]/15 text-[#4ADE80]' : 'bg-[#EF4444]/15 text-[#F87171]'">
        <span>{{ trend >= 0 ? '▲' : '▼' }}</span>
        <span>{{ trend >= 0 ? '+' : '' }}{{ trend }}%</span>
        <span class="font-semibold text-slate-400">vs ayer</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useCountUp } from '@/composables/useCountUp'

const props = defineProps<{
  label: string
  value: number
  icon: string
  accent: 'blue' | 'green' | 'purple' | 'amber'
  prefix?: string
  suffix?: string
  unit?: string
  /** % para el anillo/barra (0-100) */
  progress?: number | null
  /** serie para sparkline */
  spark?: number[] | null
  /** variación vs ayer en % */
  trend?: number | null
  subStats?: { label: string; value: string | number; tone?: string }[]
}>()

const THEMES = {
  blue: {
    borderColor: 'rgba(59,130,246,0.55)', outerGlow: 'rgba(37,99,235,0.28)',
    bg: 'linear-gradient(155deg, rgba(37,99,235,0.3) 0%, rgba(10,19,34,0.95) 55%)',
    glow: 'rgba(37,99,235,0.3)', stroke: '#3B82F6', labelColor: '#93C5FD',
  },
  green: {
    borderColor: 'rgba(34,197,94,0.55)', outerGlow: 'rgba(34,197,94,0.25)',
    bg: 'linear-gradient(155deg, rgba(34,197,94,0.26) 0%, rgba(10,19,34,0.95) 55%)',
    glow: 'rgba(34,197,94,0.28)', stroke: '#22C55E', labelColor: '#86EFAC',
  },
  purple: {
    borderColor: 'rgba(139,92,246,0.55)', outerGlow: 'rgba(139,92,246,0.28)',
    bg: 'linear-gradient(155deg, rgba(139,92,246,0.28) 0%, rgba(10,19,34,0.95) 55%)',
    glow: 'rgba(139,92,246,0.3)', stroke: '#A78BFA', labelColor: '#C4B5FD',
  },
  amber: {
    borderColor: 'rgba(245,158,11,0.55)', outerGlow: 'rgba(245,158,11,0.25)',
    bg: 'linear-gradient(155deg, rgba(245,158,11,0.24) 0%, rgba(10,19,34,0.95) 55%)',
    glow: 'rgba(245,158,11,0.26)', stroke: '#F59E0B', labelColor: '#FCD34D',
  },
} as const

const theme = computed(() => THEMES[props.accent])

const animated = useCountUp(toRef(props, 'value'))
const formatted = computed(() => Math.round(animated.value).toLocaleString('en-US'))

const clampedProgress = computed(() => Math.min(100, Math.max(0, props.progress ?? 0)))
// circunferencia normalizada del anillo (r=15.5 sobre viewBox 36 → ~97.4 unidades por 100%)
const ringDash = computed(() => clampedProgress.value * 0.974)

const sparkPoints = computed(() => {
  const data = props.spark ?? []
  if (data.length < 2) return ''
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  return data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${22 - ((v - min) / range) * 20}`)
    .join(' ')
})
</script>

<style scoped>
.cc-breathe {
  animation: cc-breathe 4s ease-in-out infinite;
}
@keyframes cc-breathe {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}
</style>
