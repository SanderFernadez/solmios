<template>
  <div class="cc-panel relative overflow-hidden rounded-[20px] border border-white/8 px-5 py-4">
    <!-- glow decorativo -->
    <div class="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#2563EB]/20 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#06B6D4]/10 blur-3xl"></div>

    <div class="relative flex flex-wrap items-center gap-x-5 gap-y-3">
      <!-- Identidad -->
      <div class="flex items-center gap-3 min-w-[230px]">
        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#06B6D4] text-white shadow-[0_0_20px_rgba(37,99,235,0.45)]">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl md:text-2xl font-black tracking-tight text-white uppercase leading-none">{{ hotelName }}</h1>
            <span v-if="stars > 0" class="text-[#F59E0B] text-xs tracking-widest">{{ '★'.repeat(stars) }}</span>
          </div>
          <p class="mt-1 text-[10px] font-bold uppercase tracking-[3px] text-slate-400">Centro de Operaciones</p>
        </div>
      </div>

      <div class="hidden xl:block h-10 w-px bg-white/10"></div>

      <!-- Pills de estado -->
      <div class="flex flex-wrap items-center gap-2.5 flex-1">
        <!-- Estado del hotel -->
        <div class="cc-pill">
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" :class="apiOnline ? 'bg-[#22C55E]' : 'bg-[#EF4444]'"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full" :class="apiOnline ? 'bg-[#22C55E]' : 'bg-[#EF4444]'"></span>
          </span>
          <div>
            <div class="cc-pill-label">Estado del Hotel</div>
            <div class="text-[13px] font-black leading-tight" :class="apiOnline ? 'text-[#22C55E]' : 'text-[#EF4444]'">
              {{ apiOnline ? 'OPERATIVO' : 'SIN CONEXIÓN' }}
            </div>
            <div class="cc-pill-sub">{{ apiOnline ? 'Todo funciona correctamente' : 'Reintentando conexión…' }}</div>
          </div>
        </div>

        <!-- Sincronización channel manager -->
        <div v-if="lastSync" class="cc-pill">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2563EB]/20 text-[#60A5FA]">
            <svg class="h-4 w-4 animate-[spin_6s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5M5.5 9A7.5 7.5 0 0 1 19 8m-.5 7A7.5 7.5 0 0 1 5 16" />
            </svg>
          </span>
          <div>
            <div class="cc-pill-label">Sincronización</div>
            <div class="text-[13px] font-black leading-tight text-white">{{ syncAgoShort }}</div>
            <div class="cc-pill-sub">{{ syncAgoLong }}</div>
          </div>
        </div>

        <!-- Clima (solo si el hotel tiene coordenadas y la API respondió) -->
        <div v-if="weather" class="cc-pill">
          <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F59E0B]/20 text-lg">{{ weather.icon }}</span>
          <div>
            <div class="cc-pill-label">Clima</div>
            <div class="text-[13px] font-black leading-tight text-white">{{ Math.round(weather.temp) }}°C</div>
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
            <div class="text-[13px] font-black leading-tight" :class="alerts > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'">
              {{ alerts > 0 ? `${alerts} PENDIENTE${alerts === 1 ? '' : 'S'}` : 'ONLINE' }}
            </div>
            <div class="cc-pill-sub">{{ alerts > 0 ? 'Requiere atención' : 'Todo Normal' }}</div>
          </div>
        </div>
      </div>

      <!-- Herramientas: buscador + campana + usuario -->
      <div class="cc-usertools ml-auto flex items-center gap-2">
        <div class="relative hidden lg:block">
          <input type="text" placeholder="Buscar..."
            class="h-9 w-44 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 transition-all focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
          <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <NotificationBell />
        <UserMenu />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@/composables/useNow'
import { relativeTime } from '@/composables/useRelativeTime'
import NotificationBell from '@/components/features/core-pms/NotificationBell.vue'
import UserMenu from '@/components/features/core-pms/UserMenu.vue'

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
</script>

<style scoped>
.cc-panel {
  background:
    radial-gradient(1200px 300px at 20% -50%, rgba(37, 99, 235, 0.14), transparent),
    linear-gradient(180deg, #0C1830 0%, #0A1426 100%);
}
.cc-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
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

/* NotificationBell y UserMenu vienen del header claro — overrides para la barra oscura */
.cc-usertools :deep(.bg-surface) { background: rgba(255, 255, 255, 0.05); }
.cc-usertools :deep(.border-border) { border-color: rgba(255, 255, 255, 0.1); }
.cc-usertools :deep(.text-navy) { color: white; }
.cc-usertools :deep(.text-text-secondary) { color: rgb(148 163 184); }
.cc-usertools :deep(.text-text-muted) { color: rgb(100 116 139); }
.cc-usertools :deep(button:hover.hover\:bg-surface) { background: rgba(255, 255, 255, 0.1); }
</style>
