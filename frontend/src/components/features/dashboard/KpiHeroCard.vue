<template>
  <div class="cc-kpi group relative overflow-hidden rounded-[20px] border p-6 transition-transform duration-300 hover:-translate-y-0.5" :class="theme.border" :style="{ background: theme.bg }">
    <!-- glow que respira -->
    <div class="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl cc-breathe" :style="{ background: theme.glow }"></div>

    <div class="relative flex items-start justify-between">
      <div class="text-[11px] font-extrabold uppercase tracking-[2px]" :class="theme.label">{{ label }}</div>

      <!-- Anillo de progreso u ícono -->
      <div v-if="progress !== undefined && progress !== null" class="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 36 36" class="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3.2" />
          <circle cx="18" cy="18" r="15.5" fill="none" :stroke="theme.stroke" stroke-width="3.2" stroke-linecap="round"
            :stroke-dasharray="`${ringDash} 100`" class="transition-[stroke-dasharray] duration-700 ease-out" />
        </svg>
        <div class="absolute inset-0 grid place-items-center">
          <span class="text-base" v-html="icon"></span>
        </div>
      </div>
      <div v-else class="grid h-12 w-12 place-items-center rounded-2xl text-xl" :style="{ background: theme.glow }">
        <span v-html="icon"></span>
      </div>
    </div>

    <!-- Número gigante -->
    <div class="relative mt-2 flex items-baseline gap-2">
      <span class="font-black tabular-nums leading-none tracking-tight text-white text-[clamp(52px,4.5vw,84px)]">
        {{ prefix }}{{ formatted }}<span v-if="suffix" class="text-[0.55em] font-extrabold" :class="theme.label">{{ suffix }}</span>
      </span>
    </div>
    <div v-if="unit" class="mt-1 text-xs font-semibold text-slate-400">{{ unit }}</div>

    <!-- Sparkline -->
    <svg v-if="spark && spark.length > 1" class="relative mt-3 h-9 w-full" :viewBox="`0 0 100 24`" preserveAspectRatio="none">
      <polyline :points="sparkPoints" fill="none" :stroke="theme.stroke" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <polygon :points="`0,24 ${sparkPoints} 100,24`" :fill="theme.stroke" opacity="0.12" />
    </svg>

    <!-- Barra de progreso lineal -->
    <div v-if="progress !== undefined && progress !== null && !spark" class="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div class="h-full rounded-full transition-[width] duration-700 ease-out" :style="{ width: `${clampedProgress}%`, background: theme.stroke }"></div>
    </div>

    <!-- Sub-stats + tendencia -->
    <div class="relative mt-4 flex items-end justify-between gap-2">
      <div class="flex gap-5">
        <div v-for="s in subStats ?? []" :key="s.label">
          <div class="text-lg font-black leading-none tabular-nums" :class="s.tone ?? 'text-white'">{{ s.value }}</div>
          <div class="mt-1 text-[10px] font-semibold text-slate-400">{{ s.label }}</div>
        </div>
      </div>
      <div v-if="trend !== undefined && trend !== null"
        class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold tabular-nums"
        :class="trend >= 0 ? 'bg-[#22C55E]/10 text-[#22C55E]' : 'bg-[#EF4444]/10 text-[#EF4444]'">
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
  blue:   { border: 'border-[#2563EB]/35', bg: 'linear-gradient(160deg, rgba(37,99,235,0.16) 0%, #0B1526 55%)',  glow: 'rgba(37,99,235,0.22)',  stroke: '#3B82F6', label: 'text-[#60A5FA]' },
  green:  { border: 'border-[#22C55E]/35', bg: 'linear-gradient(160deg, rgba(34,197,94,0.14) 0%, #0B1526 55%)',  glow: 'rgba(34,197,94,0.2)',   stroke: '#22C55E', label: 'text-[#4ADE80]' },
  purple: { border: 'border-[#8B5CF6]/35', bg: 'linear-gradient(160deg, rgba(139,92,246,0.15) 0%, #0B1526 55%)', glow: 'rgba(139,92,246,0.22)', stroke: '#A78BFA', label: 'text-[#A78BFA]' },
  amber:  { border: 'border-[#F59E0B]/35', bg: 'linear-gradient(160deg, rgba(245,158,11,0.13) 0%, #0B1526 55%)', glow: 'rgba(245,158,11,0.18)', stroke: '#F59E0B', label: 'text-[#FBBF24]' },
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
