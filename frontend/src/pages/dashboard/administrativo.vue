<template>
  <div class="page-dashboard-administrativo space-y-6">
    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
      <div v-for="kpi in kpis" :key="kpi.key" class="card p-6">
        <div class="flex items-start gap-3.5 mb-5">
          <div
            class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            :style="{ background: kpi.bg, color: kpi.accent }"
          >
            <svg v-if="kpi.icon === 'bed'" viewBox="0 0 24 24" class="w-7 h-7" fill="none">
              <rect x="2" y="11" width="20" height="7" rx="1.5" fill="currentColor" />
              <rect x="2" y="7" width="6" height="5" rx="1" fill="currentColor" opacity="0.55" />
              <rect x="2" y="17" width="20" height="2" rx="1" fill="currentColor" />
            </svg>
            <svg v-else-if="kpi.icon === 'calendar'" viewBox="0 0 24 24" class="w-7 h-7" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="3" fill="currentColor" opacity="0.55" />
              <rect x="3" y="5" width="18" height="5" rx="3" fill="currentColor" />
              <path d="M8 14.5 10.5 17 16 11.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
            <svg v-else-if="kpi.icon === 'user-check'" viewBox="0 0 24 24" class="w-7 h-7" fill="none">
              <circle cx="9.5" cy="8" r="3.7" fill="currentColor" />
              <path d="M4 19.5c0-3.3 2.5-6 5.5-6 1.4 0 2.7.55 3.6 1.4" fill="currentColor" opacity="0.55" />
              <circle cx="17.5" cy="16.5" r="4.3" fill="currentColor" />
              <path d="M15.6 16.5 17 17.9l2.3-2.7" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="w-7 h-7" fill="none">
              <rect x="2.5" y="7" width="19" height="12" rx="3" fill="currentColor" opacity="0.55" />
              <rect x="2.5" y="7" width="19" height="4" rx="2" fill="currentColor" />
              <circle cx="17" cy="14" r="2" fill="white" />
            </svg>
          </div>
          <div class="flex-1 pt-0.5 min-w-0">
            <div class="text-[13px] text-text-secondary font-medium mb-1.5 truncate">{{ kpi.label }}</div>
            <div class="text-[28px] leading-none font-extrabold text-navy">{{ kpi.value }}</div>
          </div>
        </div>

        <template v-if="kpi.footer === 'progress'">
          <div class="flex items-center justify-between text-[13px] mb-2">
            <span class="text-text-muted">de {{ kpi.total }}</span>
            <span class="font-bold" :style="{ color: kpi.accent }">{{ kpi.pct }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-surface-dark overflow-hidden">
            <div class="h-full rounded-full transition-all" :style="{ width: kpi.pct + '%', background: kpi.accent }"></div>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-between gap-3">
            <div class="text-[13px] whitespace-nowrap">
              <span class="font-bold" :class="kpi.trendDir === 'down' ? 'text-coral' : 'text-success'">
                {{ kpi.trendDir === 'down' ? '' : '+' }}{{ kpi.trendPct }}%
              </span>
              <span class="text-text-muted"> vs ayer</span>
            </div>
            <svg viewBox="0 0 100 32" class="w-20 h-8" preserveAspectRatio="none">
              <polyline
                :points="kpi.sparkline"
                fill="none"
                :stroke="kpi.accent"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </template>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
    <!-- Calendario de Reservas -->
    <div class="card p-6 min-w-0">
      <h2 class="font-extrabold text-navy text-base mb-4">Calendario de Reservas</h2>

      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div class="flex items-center gap-2">
          <button
            class="text-xs font-semibold text-text-secondary border border-border rounded-lg px-3 py-1.5 hover:bg-surface-dark transition-colors"
            @click="goToday"
          >
            Hoy
          </button>
          <button
            class="w-7 h-7 rounded-lg border border-border text-text-secondary flex items-center justify-center hover:bg-surface-dark transition-colors"
            @click="prevRange"
          >
            ‹
          </button>
          <button
            class="w-7 h-7 rounded-lg border border-border text-text-secondary flex items-center justify-center hover:bg-surface-dark transition-colors"
            @click="nextRange"
          >
            ›
          </button>
          <span class="text-sm text-text-secondary font-medium ml-1">{{ rangeLabel }}</span>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-surface-dark rounded-full p-1">
            <button
              v-for="m in VIEW_MODES"
              :key="m.value"
              class="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              :class="viewMode === m.value ? 'bg-blue text-white' : 'text-text-secondary hover:text-navy'"
              @click="viewMode = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <select
            v-model="typeFilter"
            class="text-xs font-semibold text-text-secondary bg-white border border-border rounded-lg pl-3 pr-2 py-1.5 outline-none focus:ring-2 focus:ring-blue/20 cursor-pointer"
          >
            <option value="all">Todos</option>
            <option v-for="t in availableTypes" :key="t" :value="t">{{ ROOM_TYPE_LABEL[t] || t }}</option>
          </select>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        <div v-for="entry in calendarLegend" :key="entry.label" class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ background: entry.color }"></span>
          <span class="text-[12px] text-text-secondary">{{ entry.label }}</span>
        </div>
      </div>

      <div class="overflow-x-auto">
        <div class="min-w-fit">
          <div class="grid mb-2" :style="{ gridTemplateColumns: gridTemplate }">
            <div style="grid-column: 1"></div>
            <div v-for="(d, i) in days" :key="i" class="text-center pb-2" :style="{ gridColumn: i + 2 }">
              <div class="text-[11px] text-text-muted font-medium">{{ DOW_ES[d.getDay()] }}</div>
              <div class="text-sm font-bold text-navy mt-0.5">{{ d.getDate() }}</div>
            </div>
          </div>

          <p v-if="!filteredRooms.length" class="text-center text-sm text-text-muted py-10">
            No hay habitaciones para mostrar con este filtro.
          </p>

          <div class="max-h-[440px] overflow-y-auto">
            <div
              v-for="room in filteredRooms"
              :key="room.id"
              class="grid border-t border-border/70"
              :style="{ gridTemplateColumns: gridTemplate }"
            >
              <div class="py-2 pr-3 flex items-center gap-1.5" style="grid-column: 1">
                <div>
                  <div class="text-sm font-bold text-navy">{{ room.number }}</div>
                  <div class="text-[11px] text-text-muted">{{ ROOM_TYPE_LABEL[room.type] || room.type }}</div>
                </div>
                <span
                  v-if="roomBlockInfo(room.status)"
                  class="w-2 h-2 rounded-full shrink-0"
                  :style="{ background: roomBlockInfo(room.status)?.color }"
                  :title="roomBlockInfo(room.status)?.label"
                ></span>
              </div>
              <div
                v-for="(d, i) in days"
                :key="i"
                class="h-14 border-l border-border/40"
                :style="{
                  gridColumn: i + 2,
                  ...(roomBlockInfo(room.status)
                    ? { background: 'repeating-linear-gradient(45deg, #F8FAFC 0px, #F8FAFC 6px, #EDF1F5 6px, #EDF1F5 12px)' }
                    : {}),
                }"
              ></div>
              <div
                v-for="bar in barsForRoom(room.id)"
                :key="bar.id"
                class="self-center rounded-lg px-3 py-1.5 my-1 overflow-hidden"
                :style="{ gridColumn: `${bar.colStart} / span ${bar.colSpan}`, background: bar.palette.bg }"
              >
                <div class="text-[12.5px] font-bold truncate" :style="{ color: bar.palette.text }">{{ bar.name }}</div>
                <div class="text-[11px] truncate" :style="{ color: bar.palette.sub }">
                  {{ bar.nights }} {{ bar.nights === 1 ? 'noche' : 'noches' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right column: Actividad Reciente + Canales de Reservas -->
    <div class="flex flex-col gap-5">
      <div class="card p-6 shrink-0">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-extrabold text-navy text-base">Actividad Reciente</h2>
          <router-link to="/panel/reservations" class="text-xs font-semibold text-blue hover:underline">Ver todas</router-link>
        </div>
        <div class="space-y-4">
          <div v-for="item in recentActivity" :key="item.id" class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#DCFCE7] flex items-center justify-center shrink-0">
              <svg v-if="item.type === 'new'" viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="#16A34A" stroke-width="1.8">
                <rect x="4" y="5" width="16" height="15" rx="2" stroke-linecap="round" stroke-linejoin="round" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 9.5h16M8 3v3M16 3v3" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 12.5v5M9.5 15h5" />
              </svg>
              <svg v-else viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="#16A34A" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 11.5 12 4l9 7.5" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.5 10v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8" />
                <circle cx="12" cy="15" r="1.5" fill="#16A34A" stroke="none" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[13px] font-bold text-navy truncate">{{ item.title }}</div>
              <div class="text-xs text-text-muted truncate">{{ item.subtitle }}</div>
            </div>
            <div class="text-[11px] text-text-muted whitespace-nowrap shrink-0">{{ item.timeLabel }}</div>
          </div>
          <p v-if="!recentActivity.length" class="text-sm text-text-muted text-center py-6">Sin actividad reciente.</p>
        </div>
      </div>

      <div class="card p-6 flex-1 flex flex-col">
        <h2 class="font-extrabold text-navy text-base mb-5 shrink-0">Canales de Reservas</h2>
        <div v-if="channelStats.length" class="flex-1 flex items-center gap-5">
          <div class="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 42 42" class="w-28 h-28 -rotate-90">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#F1F5F9" stroke-width="5" />
              <circle
                v-for="seg in donutSegments"
                :key="seg.source"
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                :stroke="seg.color"
                stroke-width="5"
                :stroke-dasharray="`${seg.pct} ${100 - seg.pct}`"
                :transform="`rotate(${seg.rotate} 21 21)`"
              />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] text-text-muted font-medium">Total Reservas</div>
            <div class="text-xl font-extrabold text-navy mb-2.5">{{ totalReservas }}</div>
            <div class="space-y-2.5">
              <div v-for="seg in channelStats" :key="seg.source" class="flex items-center gap-2 text-[13px]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: seg.color }"></span>
                <span class="text-text-secondary flex-1 truncate">{{ seg.label }}</span>
                <span class="font-bold text-navy">{{ seg.pct }}%</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-text-muted text-center py-6">Sin datos de canales aún.</p>
      </div>
    </div>
    </div>

    <!-- Resumen Mensual -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      <div v-for="card in monthlySummary" :key="card.key" class="card p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-[13px] text-text-secondary font-medium mb-2 truncate">{{ card.label }}</div>
            <div class="text-2xl font-extrabold text-navy leading-none">
              {{ card.value }}<span v-if="card.unit" class="text-sm font-semibold text-text-muted ml-1">{{ card.unit }}</span>
            </div>
          </div>
          <svg viewBox="0 0 100 32" class="w-20 h-9 shrink-0" preserveAspectRatio="none">
            <defs>
              <linearGradient :id="`grad-${card.key}`" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="card.color" stop-opacity="0.35" />
                <stop offset="100%" :stop-color="card.color" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polygon :points="`0,32 ${card.sparkline} 100,32`" :fill="`url(#grad-${card.key})`" />
            <polyline :points="card.sparkline" fill="none" :stroke="card.color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="text-[12.5px] mt-3">
          <span class="font-bold" :style="{ color: card.color }">{{ card.trendLabel }}</span>
          <span class="text-text-muted"> vs el mes pasado</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useAuthStore } from '@/stores/auth.store'
import { useReservationStore } from '@/stores/reservation.store'
import { useRoomStore } from '@/stores/room.store'

const dashboard = useDashboardStore()
const auth = useAuthStore()
const reservationStore = useReservationStore()
const roomStore = useRoomStore()

const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

onMounted(() => {
  dashboard.fetchStats(hotelId.value)
  reservationStore.fetchReservations({ hotelId: hotelId.value })
  roomStore.fetchRooms({ hotelId: hotelId.value })
})

function dateKey(d: string | Date) {
  return String(d).slice(0, 10)
}

function shiftedKey(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return dateKey(d)
}

const todayKey = shiftedKey(0)
const yesterdayKey = shiftedKey(-1)
const last7Keys = Array.from({ length: 7 }, (_, i) => shiftedKey(i - 6))

const activeReservations = computed(() => reservationStore.reservations.filter(r => r.status !== 'cancelled'))

function stayingOn(key: string) {
  return activeReservations.value.filter(r => dateKey(r.checkIn) <= key && dateKey(r.checkOut) > key).length
}

function arrivingOn(key: string) {
  return activeReservations.value.filter(r => dateKey(r.checkIn) === key).length
}

function revenueOn(key: string) {
  return activeReservations.value.filter(r => dateKey(r.checkIn) === key).reduce((sum, r) => sum + (r.totalAmount || 0), 0)
}

function pctChange(today: number, yesterday: number) {
  if (yesterday > 0) return Math.round(((today - yesterday) / yesterday) * 100)
  return today > 0 ? 100 : 0
}

function sparklinePoints(values: number[]) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const stepX = 100 / (values.length - 1 || 1)
  return values.map((v, i) => `${(i * stepX).toFixed(1)},${(28 - ((v - min) / range) * 24).toFixed(1)}`).join(' ')
}

const reservasHoy = computed(() => stayingOn(todayKey))
const reservasAyer = computed(() => stayingOn(yesterdayKey))
const checkinsAyer = computed(() => arrivingOn(yesterdayKey))
const ingresosAyer = computed(() => dashboard.stats.trends?.revenue.value || 0)

const kpis = computed(() => {
  const s = dashboard.stats
  const checkinsHoy = s.arrivalsToday
  const ingresosHoy = s.revenueToday

  return [
    {
      key: 'ocupacion',
      label: 'Habitaciones Ocupadas',
      value: String(s.occupied),
      bg: '#DBEAFE',
      accent: '#3B82F6',
      icon: 'bed',
      footer: 'progress' as const,
      total: s.totalRooms,
      pct: s.occupancy,
    },
    {
      key: 'reservas',
      label: 'Reservas Hoy',
      value: String(reservasHoy.value),
      bg: '#DCFCE7',
      accent: '#22C55E',
      icon: 'calendar',
      footer: 'trend' as const,
      trendPct: Math.abs(pctChange(reservasHoy.value, reservasAyer.value)),
      trendDir: reservasHoy.value >= reservasAyer.value ? 'up' : 'down',
      sparkline: sparklinePoints(last7Keys.map(stayingOn)),
    },
    {
      key: 'checkins',
      label: 'Check-ins Hoy',
      value: String(checkinsHoy),
      bg: '#FEF3C7',
      accent: '#F59E0B',
      icon: 'user-check',
      footer: 'trend' as const,
      trendPct: Math.abs(pctChange(checkinsHoy, checkinsAyer.value)),
      trendDir: checkinsHoy >= checkinsAyer.value ? 'up' : 'down',
      sparkline: sparklinePoints(last7Keys.map(arrivingOn)),
    },
    {
      key: 'ingresos',
      label: 'Ingresos Hoy',
      value: `$${ingresosHoy.toLocaleString()}`,
      bg: '#EDE9FE',
      accent: '#8B5CF6',
      icon: 'wallet',
      footer: 'trend' as const,
      trendPct: Math.abs(pctChange(ingresosHoy, ingresosAyer.value)),
      trendDir: ingresosHoy >= ingresosAyer.value ? 'up' : 'down',
      sparkline: sparklinePoints(last7Keys.map(revenueOn)),
    },
  ]
})

// === Calendario de Reservas ===
const DOW_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const ROOM_TYPE_LABEL: Record<string, string> = {
  single: 'Individual',
  double: 'Doble',
  suite: 'Suite',
  villa: 'Villa',
  dorm: 'Dormitorio',
  family: 'Familiar',
}
const VIEW_MODES = [
  { value: 'dia' as const, label: 'Día' },
  { value: 'semana' as const, label: 'Semana' },
  { value: 'mes' as const, label: 'Mes' },
]
const RESERVATION_STATUS_STYLE = {
  upcoming: { bg: '#DBEAFE', text: '#1D4ED8', sub: '#2563EB', label: 'Confirmada' },
  checked_in: { bg: '#DCFCE7', text: '#15803D', sub: '#16A34A', label: 'Check-in' },
  checked_out: { bg: '#E2E8F0', text: '#334155', sub: '#475569', label: 'Check-out' },
} as const

function statusBucket(status: string): keyof typeof RESERVATION_STATUS_STYLE {
  if (status === 'checked_in') return 'checked_in'
  if (status === 'checked_out') return 'checked_out'
  return 'upcoming'
}

const ROOM_BLOCK_STATUS: Record<string, { color: string; label: string }> = {
  out_of_service: { color: '#EF4444', label: 'Mantenimiento' },
  cleaning: { color: '#F59E0B', label: 'Bloqueada' },
}

function roomBlockInfo(status: string) {
  return ROOM_BLOCK_STATUS[status]
}

const calendarLegend = computed(() => [
  { label: RESERVATION_STATUS_STYLE.upcoming.label, color: RESERVATION_STATUS_STYLE.upcoming.sub },
  { label: RESERVATION_STATUS_STYLE.checked_in.label, color: RESERVATION_STATUS_STYLE.checked_in.sub },
  { label: RESERVATION_STATUS_STYLE.checked_out.label, color: RESERVATION_STATUS_STYLE.checked_out.sub },
  { label: 'Mantenimiento', color: ROOM_BLOCK_STATUS.out_of_service.color },
  { label: 'Bloqueada', color: ROOM_BLOCK_STATUS.cleaning.color },
])

const viewMode = ref<'dia' | 'semana' | 'mes'>('semana')
const anchorDate = ref(new Date())
const typeFilter = ref('all')

function addDays(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n)
}

function startOfWeekMonday(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay()
  return addDays(d, dow === 0 ? -6 : 1 - dow)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const rangeStart = computed(() => {
  if (viewMode.value === 'semana') return startOfWeekMonday(anchorDate.value)
  if (viewMode.value === 'mes') return startOfMonth(anchorDate.value)
  return new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth(), anchorDate.value.getDate())
})

const daysInView = computed(() => {
  if (viewMode.value === 'dia') return 1
  if (viewMode.value === 'mes') return daysInMonth(rangeStart.value)
  return 7
})

const days = computed(() => Array.from({ length: daysInView.value }, (_, i) => addDays(rangeStart.value, i)))

const gridTemplate = computed(() => `110px repeat(${daysInView.value}, minmax(90px, 1fr))`)

const rangeLabel = computed(() => {
  const start = days.value[0]
  const end = days.value[days.value.length - 1]
  if (viewMode.value === 'dia') return `${start.getDate()} de ${capitalize(MONTHS_ES[start.getMonth()])}, ${start.getFullYear()}`
  if (viewMode.value === 'mes') return `${capitalize(MONTHS_ES[start.getMonth()])} ${start.getFullYear()}`
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} de ${capitalize(MONTHS_ES[start.getMonth()])}, ${end.getFullYear()}`
  }
  return `${start.getDate()} ${capitalize(MONTHS_ES[start.getMonth()])} – ${end.getDate()} ${capitalize(MONTHS_ES[end.getMonth()])}, ${end.getFullYear()}`
})

function goToday() {
  anchorDate.value = new Date()
}

function prevRange() {
  if (viewMode.value === 'dia') anchorDate.value = addDays(anchorDate.value, -1)
  else if (viewMode.value === 'mes') anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() - 1, 1)
  else anchorDate.value = addDays(anchorDate.value, -7)
}

function nextRange() {
  if (viewMode.value === 'dia') anchorDate.value = addDays(anchorDate.value, 1)
  else if (viewMode.value === 'mes') anchorDate.value = new Date(anchorDate.value.getFullYear(), anchorDate.value.getMonth() + 1, 1)
  else anchorDate.value = addDays(anchorDate.value, 7)
}

const availableTypes = computed(() => Array.from(new Set(roomStore.rooms.map(r => r.type))))

const filteredRooms = computed(() => {
  const list = typeFilter.value === 'all' ? roomStore.rooms : roomStore.rooms.filter(r => r.type === typeFilter.value)
  return [...list].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
})

function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function barsForRoom(roomId: string) {
  const rangeStartDate = days.value[0]
  const rangeEndDate = addDays(days.value[days.value.length - 1], 1)

  return activeReservations.value
    .filter(r => r.roomId === roomId)
    .map(r => ({ r, ci: parseDateKey(dateKey(r.checkIn)), co: parseDateKey(dateKey(r.checkOut)) }))
    .filter(({ ci, co }) => ci < rangeEndDate && co > rangeStartDate)
    .map(({ r, ci, co }) => {
      const clampedStart = ci < rangeStartDate ? rangeStartDate : ci
      const clampedEnd = co > rangeEndDate ? rangeEndDate : co
      const colStart = diffDays(rangeStartDate, clampedStart) + 2
      const colSpan = Math.max(1, diffDays(clampedStart, clampedEnd))
      return {
        id: r.id,
        colStart,
        colSpan,
        name: r.guestName || r.guest?.name || 'Huésped',
        nights: Math.max(1, diffDays(ci, co)),
        palette: RESERVATION_STATUS_STYLE[statusBucket(r.status)],
      }
    })
}

// === Actividad Reciente ===
function relativeDayLabel(date: Date) {
  const today = new Date(today_)
  const diff = diffDays(today, date)
  if (diff === 0) return 'Hoy'
  if (diff === -1) return 'Ayer'
  if (diff === 1) return 'Mañana'
  if (diff < 0) return `Hace ${-diff} días`
  return `En ${diff} días`
}
const today_ = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

interface ActivityItem {
  id: string
  type: 'in' | 'out' | 'new'
  title: string
  subtitle: string
  date: Date
}

/** Lo que consume el template: la actividad más su fecha ya formateada. */
interface ActivityRow extends ActivityItem {
  timeLabel: string
}

const recentActivity = computed<ActivityRow[]>(() => {
  const items: ActivityItem[] = []
  for (const r of reservationStore.reservations) {
    if (r.status === 'cancelled') continue
    const guest = r.guestName || r.guest?.name || 'Huésped'
    const room = r.roomNumber || r.room?.number || '-'
    const subtitle = `${guest} - Hab. ${room}`
    if (r.status === 'checked_in') {
      items.push({ id: `${r.id}-in`, type: 'in', title: 'Check-in realizado', subtitle, date: parseDateKey(dateKey(r.checkIn)) })
    } else if (r.status === 'checked_out') {
      items.push({ id: `${r.id}-out`, type: 'out', title: 'Check-out realizado', subtitle, date: parseDateKey(dateKey(r.checkOut)) })
    } else {
      items.push({ id: `${r.id}-new`, type: 'new', title: 'Nueva reserva', subtitle, date: parseDateKey(dateKey(r.checkIn)) })
    }
  }
  return items
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)
    .map(item => ({ ...item, timeLabel: relativeDayLabel(item.date) }))
})

// === Canales de Reservas ===
const SOURCE_LABEL: Record<string, string> = {
  direct: 'Directo',
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  booking: 'Booking.com',
  expedia: 'Expedia',
  agoda: 'Agoda',
  airbnb: 'Airbnb',
  google: 'Google',
  other: 'Otro',
}
const SOURCE_COLOR: Record<string, string> = {
  booking: '#3B82F6',
  airbnb: '#14B8A6',
  direct: '#F59E0B',
  expedia: '#EF4444',
  agoda: '#8B5CF6',
  google: '#06B6D4',
  whatsapp: '#22C55E',
  phone: '#64748B',
  other: '#94A3B8',
}

const totalReservas = computed(() => activeReservations.value.length)

// Channel Managers conectados (ver página Integraciones) — se muestran siempre, aunque tengan 0 reservas
const CHANNEL_MANAGER_SOURCES = ['booking', 'expedia', 'airbnb']

const channelStats = computed(() => {
  const counts: Record<string, number> = {}
  for (const source of CHANNEL_MANAGER_SOURCES) counts[source] = 0
  for (const r of activeReservations.value) counts[r.source] = (counts[r.source] || 0) + 1
  const total = activeReservations.value.length || 1
  return Object.entries(counts)
    .map(([source, count]) => ({
      source,
      count,
      pct: Math.round((count / total) * 100),
      color: SOURCE_COLOR[source] || '#94A3B8',
      label: SOURCE_LABEL[source] || source,
    }))
    .sort((a, b) => b.count - a.count)
})

const donutSegments = computed(() => {
  let cumulative = 0
  return channelStats.value.map(seg => {
    const rotate = cumulative * 3.6
    cumulative += seg.pct
    return { ...seg, rotate }
  })
})

// === Resumen Mensual ===
const currentMonthStart = startOfMonth(new Date())
const prevMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1)

function monthDayKeys(monthStart: Date) {
  return Array.from({ length: daysInMonth(monthStart) }, (_, i) => dateKey(addDays(monthStart, i)))
}
const currentMonthKeys = monthDayKeys(currentMonthStart)
const prevMonthKeys = monthDayKeys(prevMonthStart)

function cancelledOn(key: string) {
  return reservationStore.reservations.filter(r => r.status === 'cancelled' && dateKey(r.checkIn) === key).length
}

function avgNightsOn(key: string) {
  const list = activeReservations.value.filter(r => dateKey(r.checkIn) === key)
  if (!list.length) return 0
  const total = list.reduce((sum, r) => sum + diffDays(parseDateKey(dateKey(r.checkIn)), parseDateKey(dateKey(r.checkOut))), 0)
  return total / list.length
}

function avgNightsForMonth(keys: string[]) {
  const list = activeReservations.value.filter(r => keys.includes(dateKey(r.checkIn)))
  if (!list.length) return 0
  const total = list.reduce((sum, r) => sum + diffDays(parseDateKey(dateKey(r.checkIn)), parseDateKey(dateKey(r.checkOut))), 0)
  return total / list.length
}

function pctTrendLabel(current: number, previous: number) {
  const pct = pctChange(current, previous)
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

const reservasMesActual = computed(() => currentMonthKeys.reduce((sum, k) => sum + arrivingOn(k), 0))
const reservasMesAnterior = computed(() => prevMonthKeys.reduce((sum, k) => sum + arrivingOn(k), 0))

const ingresosMesActual = computed(() => currentMonthKeys.reduce((sum, k) => sum + revenueOn(k), 0))
const ingresosMesAnterior = computed(() => prevMonthKeys.reduce((sum, k) => sum + revenueOn(k), 0))

const cancelacionesMesActual = computed(() => currentMonthKeys.reduce((sum, k) => sum + cancelledOn(k), 0))
const cancelacionesMesAnterior = computed(() => prevMonthKeys.reduce((sum, k) => sum + cancelledOn(k), 0))

const estadiaMesActual = computed(() => avgNightsForMonth(currentMonthKeys))
const estadiaMesAnterior = computed(() => avgNightsForMonth(prevMonthKeys))

const monthlySummary = computed(() => {
  const estadiaDiff = estadiaMesActual.value - estadiaMesAnterior.value
  return [
    {
      key: 'reservas-mes',
      label: 'Reservas del Mes',
      value: String(reservasMesActual.value),
      unit: '',
      color: '#3B82F6',
      trendLabel: pctTrendLabel(reservasMesActual.value, reservasMesAnterior.value),
      sparkline: sparklinePoints(currentMonthKeys.map(arrivingOn)),
    },
    {
      key: 'ingresos-mes',
      label: 'Ingresos del Mes',
      value: `$${ingresosMesActual.value.toLocaleString()}`,
      unit: '',
      color: '#22C55E',
      trendLabel: pctTrendLabel(ingresosMesActual.value, ingresosMesAnterior.value),
      sparkline: sparklinePoints(currentMonthKeys.map(revenueOn)),
    },
    {
      key: 'cancelaciones',
      label: 'Cancelaciones',
      value: String(cancelacionesMesActual.value),
      unit: '',
      color: '#EF4444',
      trendLabel: pctTrendLabel(cancelacionesMesActual.value, cancelacionesMesAnterior.value),
      sparkline: sparklinePoints(currentMonthKeys.map(cancelledOn)),
    },
    {
      key: 'estadia-promedio',
      label: 'Estadía Promedio',
      value: estadiaMesActual.value.toFixed(1),
      unit: 'noches',
      color: '#8B5CF6',
      trendLabel: `${estadiaDiff >= 0 ? '+' : ''}${estadiaDiff.toFixed(1)}`,
      sparkline: sparklinePoints(currentMonthKeys.map(avgNightsOn)),
    },
  ]
})
</script>
