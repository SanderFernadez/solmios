<template>
  <div class="cc-panel relative overflow-hidden rounded-[22px] border border-white/8 px-6 py-5">
    <!-- glow decorativo -->
    <div class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#2563EB]/20 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#06B6D4]/10 blur-3xl"></div>

    <div class="relative flex flex-wrap items-center gap-x-8 gap-y-4">
      <!-- Identidad -->
      <div class="min-w-[220px]">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">{{ hotelName }}</h1>
          <span v-if="stars > 0" class="text-[#F59E0B] text-sm tracking-widest">{{ '★'.repeat(stars) }}</span>
        </div>
        <p class="mt-0.5 text-[11px] font-bold uppercase tracking-[3px] text-slate-400">Centro de Operaciones</p>
      </div>

      <div class="hidden lg:block h-12 w-px bg-white/10"></div>

      <!-- Pills de estado -->
      <div class="flex flex-wrap items-center gap-3 flex-1">
        <!-- Estado del hotel -->
        <div class="cc-pill">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" :class="apiOnline ? 'bg-[#22C55E]' : 'bg-[#EF4444]'"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="apiOnline ? 'bg-[#22C55E]' : 'bg-[#EF4444]'"></span>
          </span>
          <div>
            <div class="cc-pill-label">Estado del Hotel</div>
            <div class="text-sm font-black" :class="apiOnline ? 'text-[#22C55E]' : 'text-[#EF4444]'">
              {{ apiOnline ? 'OPERATIVO' : 'SIN CONEXIÓN' }}
            </div>
            <div class="cc-pill-sub">{{ apiOnline ? 'Todo funciona correctamente' : 'Reintentando conexión…' }}</div>
          </div>
        </div>

        <!-- Sincronización channel manager -->
        <div v-if="lastSync" class="cc-pill">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-[#2563EB]/15 text-[#60A5FA]">
            <svg class="h-4 w-4 animate-[spin_6s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5.5 9A7.5 7.5 0 0 1 19 8m-.5 7A7.5 7.5 0 0 1 5 16" />
            </svg>
          </span>
          <div>
            <div class="cc-pill-label">Sincronización</div>
            <div class="text-sm font-black text-white">{{ syncAgoShort }}</div>
            <div class="cc-pill-sub">{{ syncAgoLong }}</div>
          </div>
        </div>

        <!-- Clima (solo si el hotel tiene coordenadas y la API respondió) -->
        <div v-if="weather" class="cc-pill">
          <span class="grid h-8 w-8 place-items-center rounded-full bg-[#F59E0B]/15 text-lg">{{ weather.icon }}</span>
          <div>
            <div class="cc-pill-label">Clima</div>
            <div class="text-sm font-black text-white">{{ Math.round(weather.temp) }}°C</div>
            <div class="cc-pill-sub">{{ weather.label }}</div>
          </div>
        </div>

        <!-- Recepción -->
        <div class="cc-pill">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" :class="alerts > 0 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="alerts > 0 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'"></span>
          </span>
          <div>
            <div class="cc-pill-label">Recepción</div>
            <div class="text-sm font-black" :class="alerts > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'">
              {{ alerts > 0 ? `${alerts} pendiente${alerts === 1 ? '' : 's'}` : 'ONLINE' }}
            </div>
            <div class="cc-pill-sub">{{ alerts > 0 ? 'Requiere atención' : 'Todo Normal' }}</div>
          </div>
        </div>
      </div>

      <!-- Reloj en vivo -->
      <div class="ml-auto text-right">
        <div class="font-mono text-3xl font-black tabular-nums text-white tracking-tight">{{ clock }}</div>
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ dateLabel }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@/composables/useNow'
import { relativeTime } from '@/composables/useRelativeTime'

export interface WeatherInfo { temp: number; label: string; icon: string }

const props = defineProps<{
  hotelName: string
  starRating?: number | string | null
  apiOnline: boolean
  lastSync?: string | null
  weather?: WeatherInfo | null
  /** Incidencias/tareas abiertas que recepción debería mirar */
  alerts?: number
}>()

const { now } = useNow(1000)

const stars = computed(() => Math.min(5, Math.max(0, Number(props.starRating) || 0)))
const alerts = computed(() => props.alerts ?? 0)

const syncAgoLong = computed(() => relativeTime(props.lastSync, now.value))
const syncAgoShort = computed(() => {
  if (!props.lastSync) return '—'
  const diff = Math.max(0, Math.floor((now.value - new Date(props.lastSync).getTime()) / 1000))
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
})

const clock = computed(() =>
  new Date(now.value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
)
const dateLabel = computed(() =>
  new Date(now.value).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
)
</script>

<style scoped>
.cc-panel {
  background:
    radial-gradient(1200px 300px at 20% -50%, rgba(37, 99, 235, 0.12), transparent),
    linear-gradient(180deg, #0C1830 0%, #0A1426 100%);
}
.cc-pill {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(8px);
}
.cc-pill-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgb(148 163 184);
}
.cc-pill-sub {
  font-size: 10px;
  color: rgb(100 116 139);
}
</style>
