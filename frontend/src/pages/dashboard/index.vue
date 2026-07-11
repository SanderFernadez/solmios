<template>
  <div class="cc-dashboard -m-6 min-h-screen space-y-4 p-5">
    <!-- 1. Centro de operaciones -->
    <CommandCenterHeader
      :hotel-name="hotelName"
      :star-rating="hotelStars"
      :api-online="apiOnline"
      :last-sync="channelLastSync"
      :weather="weather"
      :alerts="dashboard.stats.openIncidents"
    />

    <!-- 2. KPIs gigantes — ocupación e ingresos pesan más que check-in/out -->
    <div class="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1.25fr]">
      <KpiHeroCard
        label="Ocupación Actual" accent="blue" suffix="%" icon="bed"
        :value="dashboard.stats.occupancy"
        :progress="dashboard.stats.occupancy"
        :trend="occupancyTrend"
        :sub-stats="[
          { label: 'Habitaciones', value: dashboard.stats.totalRooms },
          { label: 'Disponibles', value: availableRooms, tone: 'text-[#16A34A]' },
          { label: 'Mantenimiento', value: maintenanceRooms, tone: 'text-[#D97706]' },
        ]"
      />
      <KpiHeroCard
        label="Check-in Hoy" accent="green" icon="checkin"
        :value="dashboard.stats.arrivalsToday"
        unit="Huéspedes"
        :progress="arrivalsProgress"
        :show-bar="false"
        :sub-stats="[
          { label: 'Realizados', value: arrivalsDone, tone: 'text-[#16A34A]' },
          { label: 'Pendientes', value: arrivalsPending, tone: 'text-[#D97706]' },
        ]"
      />
      <KpiHeroCard
        label="Check-out Hoy" accent="purple" icon="checkout"
        :value="dashboard.stats.departuresToday"
        unit="Huéspedes"
        :progress="departuresProgress"
        :show-bar="false"
        :sub-stats="[
          { label: 'Realizados', value: departuresDone, tone: 'text-[#7C3AED]' },
          { label: 'Pendientes', value: departuresPending, tone: 'text-[#D97706]' },
        ]"
      />
      <KpiHeroCard
        label="Ingresos Hoy" accent="amber" prefix="$" icon="money"
        :value="dashboard.stats.revenueToday"
        :trend="revenueTrend"
        :spark="revenueSpark"
      />
    </div>

    <!-- 3. Calendario + actividad/canales/estados -->
    <div class="grid min-w-0 gap-4 xl:grid-cols-[1.3fr_1fr_1fr_1.25fr]">
      <div class="min-w-0 xl:col-span-3">
        <ReservationsGantt
          :rooms="roomStore.rooms"
          :reservations="reservationStore.reservations"
          :loading="reservationStore.loading"
          @open="openReservation"
          @changed="refreshOperationalData"
        />
      </div>
      <div class="flex min-w-0 flex-col gap-4">
        <LiveActivityFeed :items="activityItems" class="min-h-0 flex-1" />
        <div class="grid min-w-0 gap-4 sm:grid-cols-2">
          <ChannelDistributionBars :channels="channelDistribution" />
          <RoomsStatusDonut :by-status="dashboard.stats.roomsByStatus" />
        </div>
      </div>
    </div>

    <!-- 4. Estado del hotel + IA + ingresos -->
    <div class="grid min-w-0 gap-4 lg:grid-cols-3">
      <HotelStatusPanel :services="hotelServices" />
      <AiInsightsPanel :user-name="userFirstName" :insights="aiInsights" />
      <RevenueChart
        :daily="revenueDaily"
        :revenue-today="dashboard.stats.revenueToday"
        :trend-pct="revenueTrend"
        :loading="revenueLoading"
      />
    </div>

    <!-- 5. Heat map de habitaciones -->
    <FloorHeatMap :rooms="roomStore.rooms" @select="selectedRoom = $event" />

    <!-- Detalle de reserva (clic en barra del gantt) -->
    <ReservationModal
      v-if="detailId"
      :reservation-id="detailId"
      @close="detailId = null"
      @edit="onEditReservation"
      @changed="refreshOperationalData"
    />

    <!-- Modal de habitación (heat map) -->
    <Teleport to="body">
      <div v-if="selectedRoom" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <div class="relative w-full max-w-md overflow-hidden rounded-[20px] border border-border bg-white shadow-2xl">
          <div class="border-b border-border p-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="grid h-12 w-12 place-items-center rounded-xl text-xl font-black" :style="{ background: `${roomAccent}22`, color: roomAccent }">
                  {{ selectedRoom.number }}
                </div>
                <div>
                  <h3 class="text-lg font-black text-navy">Habitación {{ selectedRoom.number }}</h3>
                  <p class="text-sm capitalize text-text-secondary">{{ selectedRoom.type }} · Piso {{ selectedRoom.floor }}</p>
                </div>
              </div>
              <button @click="selectedRoom = null" class="grid h-8 w-8 place-items-center rounded-lg bg-surface text-text-secondary transition-colors hover:text-navy cursor-pointer">✕</button>
            </div>
          </div>

          <div class="space-y-4 p-5">
            <div class="flex items-center justify-between rounded-xl bg-surface p-3">
              <span class="text-sm font-bold text-text-secondary">Estado</span>
              <span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase" :style="{ background: `${roomAccent}1A`, color: roomAccent }">
                {{ ROOM_STATUS_LABEL[selectedRoom.status] }}
              </span>
            </div>

            <div v-if="selectedRoom.status === 'occupied' && roomGuest" class="rounded-xl bg-surface p-4">
              <div class="mb-3 text-[10px] font-bold uppercase tracking-wide text-text-muted">Huésped Actual</div>
              <div class="flex items-center gap-3">
                <div class="grid h-11 w-11 place-items-center rounded-full bg-[#2563EB]/12 text-sm font-bold text-[#2563EB]">{{ roomGuest.initials }}</div>
                <div class="flex-1">
                  <div class="text-sm font-bold text-navy">{{ roomGuest.name }}</div>
                  <div class="text-[10px] text-text-secondary">{{ roomGuest.checkIn }} → {{ roomGuest.checkOut }}</div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-surface p-3 text-center">
                <div class="text-lg font-black tabular-nums text-navy">${{ selectedRoom.basePrice }}</div>
                <div class="text-[10px] text-text-muted">Tarifa/Noche</div>
              </div>
              <div class="rounded-xl bg-surface p-3 text-center">
                <div class="text-lg font-black tabular-nums text-navy">{{ selectedRoom.maxGuests }}</div>
                <div class="text-[10px] text-text-muted">Max. Ocupantes</div>
              </div>
            </div>
          </div>

          <div class="border-t border-border bg-surface p-5">
            <div class="flex gap-2">
              <button v-if="selectedRoom.status === 'available'" @click="setRoomStatus('occupied')" class="cc-modal-btn flex-1 bg-[#22C55E] text-[#052E16]">Check-in</button>
              <button v-if="selectedRoom.status === 'occupied'" @click="setRoomStatus('cleaning')" class="cc-modal-btn flex-1 bg-[#EF4444] text-white">Check-out</button>
              <button v-if="selectedRoom.status === 'cleaning' || selectedRoom.status === 'dirty'" @click="setRoomStatus('available')" class="cc-modal-btn flex-1 bg-[#06B6D4] text-[#083344]">Marcar Limpia</button>
              <button v-if="selectedRoom.status !== 'out_of_service'" @click="setRoomStatus('out_of_service')" class="cc-modal-btn border border-border bg-white text-text-secondary">F/S</button>
              <button v-else @click="setRoomStatus('available')" class="cc-modal-btn border border-border bg-white text-text-secondary">Reactivar</button>
              <button @click="selectedRoom = null" class="cc-modal-btn border border-border bg-white text-text-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { Room, RoomStatus, Reservation } from '@/types'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useRoomStore } from '@/stores/room.store'
import { useReservationStore } from '@/stores/reservation.store'
import { useAuthStore } from '@/stores/auth.store'
import { NotificationsService, type AppNotification } from '@/services/Notifications.service'
import { ChannelService } from '@/services/Channel.service'
import { HotelService, type HotelData } from '@/services/Hotel.service'
import { ReportsService, type FacturacionReport } from '@/services/Reports.service'
import CommandCenterHeader, { type WeatherInfo } from '@/components/features/dashboard/CommandCenterHeader.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import ReservationsGantt from '@/components/features/dashboard/ReservationsGantt.vue'
import LiveActivityFeed, { type FeedItem } from '@/components/features/dashboard/LiveActivityFeed.vue'
import ChannelDistributionBars, { type ChannelSlice } from '@/components/features/dashboard/ChannelDistributionBars.vue'
import RoomsStatusDonut from '@/components/features/dashboard/RoomsStatusDonut.vue'
import HotelStatusPanel, { type ServiceStatus } from '@/components/features/dashboard/HotelStatusPanel.vue'
import AiInsightsPanel, { type AiInsight } from '@/components/features/dashboard/AiInsightsPanel.vue'
import RevenueChart, { type DailyPoint } from '@/components/features/dashboard/RevenueChart.vue'
import FloorHeatMap from '@/components/features/dashboard/FloorHeatMap.vue'
import ReservationModal from '@/components/features/ReservationModal.vue'

const router = useRouter()
const dashboard = useDashboardStore()
const roomStore = useRoomStore()
const reservationStore = useReservationStore()
const auth = useAuthStore()

/** Refresco del feed/KPIs en vivo */
const REFRESH_INTERVAL_MS = 60_000
/** Ventana de la serie de ingresos que alimenta el gráfico */
const REVENUE_WINDOW_DAYS = 365
const MS_DAY = 86_400_000

const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

// ── Estado remoto ────────────────────────────────────────────────────────
const apiOnline = ref(true)
const hotelData = ref<HotelData | null>(null)
const channelLastSync = ref<string | null>(null)
const channelConnected = ref(0)
const channelSyncEnabled = ref(false)
const notifications = ref<AppNotification[]>([])
const weather = ref<WeatherInfo | null>(null)
const revenueDaily = ref<DailyPoint[]>([])
const revenueLoading = ref(true)

const hotelName = computed(() => hotelData.value?.name || auth.currentHotel || 'Mi Hotel')
const hotelStars = computed(() => hotelData.value?.starRating ?? null)
const userFirstName = computed(() => (auth.user?.name ?? 'Admin').split(' ')[0])

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dstr(v: unknown) { return String(v ?? '').slice(0, 10) }

// ── KPIs ─────────────────────────────────────────────────────────────────
const availableRooms = computed(() => dashboard.stats.roomsByStatus.available ?? 0)
const maintenanceRooms = computed(() =>
  (dashboard.stats.roomsByStatus.out_of_service ?? 0) + (dashboard.stats.roomsByStatus.dirty ?? 0) + (dashboard.stats.roomsByStatus.cleaning ?? 0))

function signedTrend(t?: { value: number; direction: string }) {
  if (!t || t.direction === 'stable' || !t.value) return null
  return t.direction === 'down' ? -Math.abs(t.value) : Math.abs(t.value)
}
const occupancyTrend = computed(() => signedTrend(dashboard.stats.trends?.ocupacion))
const revenueTrend = computed(() => signedTrend(dashboard.stats.trends?.revenue))

const todaysArrivals = computed(() =>
  reservationStore.reservations.filter(r => dstr(r.checkIn) === todayStr() && r.status !== 'cancelled'))
const arrivalsDone = computed(() => todaysArrivals.value.filter(r => r.status === 'checked_in' || r.status === 'checked_out').length)
const arrivalsPending = computed(() => todaysArrivals.value.length - arrivalsDone.value)
const arrivalsProgress = computed(() =>
  todaysArrivals.value.length ? Math.round((arrivalsDone.value / todaysArrivals.value.length) * 100) : 0)

const todaysDepartures = computed(() =>
  reservationStore.reservations.filter(r => dstr(r.checkOut) === todayStr() && (r.status === 'checked_in' || r.status === 'checked_out')))
const departuresDone = computed(() => todaysDepartures.value.filter(r => r.status === 'checked_out').length)
const departuresPending = computed(() => todaysDepartures.value.length - departuresDone.value)
const departuresProgress = computed(() =>
  todaysDepartures.value.length ? Math.round((departuresDone.value / todaysDepartures.value.length) * 100) : 0)

const revenueSpark = computed(() => revenueDaily.value.slice(-14).map(p => p.value))

// ── Actividad en tiempo real ─────────────────────────────────────────────
const ACTIVITY_META: Record<string, { icon: string; color: string; badge: string }> = {
  reservation: { icon: '📅', color: '#3B82F6', badge: 'Reserva' },
  payment: { icon: '💳', color: '#22C55E', badge: 'Pago' },
  housekeeping: { icon: '🧹', color: '#F59E0B', badge: 'Limpieza' },
  maintenance: { icon: '🔧', color: '#FB923C', badge: 'Mantenimiento' },
  review: { icon: '⭐', color: '#A78BFA', badge: 'Opinión' },
  message: { icon: '💬', color: '#06B6D4', badge: 'Mensaje' },
  system: { icon: '⚙️', color: '#94A3B8', badge: 'Sistema' },
}
const ACTIVITY_LIMIT = 9

function hhmm(iso?: string) {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const activityItems = computed<FeedItem[]>(() => {
  const fromNotifs: FeedItem[] = notifications.value.map(n => {
    const meta = ACTIVITY_META[n.type] ?? ACTIVITY_META.system
    return {
      id: `n-${n.id}`,
      time: hhmm(n.createdAt ?? n.date),
      title: n.title,
      subtitle: n.message ?? '',
      badge: meta.badge,
      color: meta.color,
      icon: meta.icon,
      _ts: new Date(n.createdAt ?? n.date ?? 0).getTime(),
    } as FeedItem & { _ts: number }
  })

  // Fallback/complemento: reservas recientes como eventos
  const fromReservations = [...reservationStore.reservations]
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, ACTIVITY_LIMIT)
    .map(r => ({
      id: `r-${r.id}`,
      time: hhmm(String(r.createdAt)),
      title: 'Nueva reserva',
      subtitle: `${r.guestName ?? 'Huésped'} · Hab. ${r.roomNumber ?? '—'} · ${r.source}`,
      badge: 'Reserva',
      color: '#3B82F6',
      icon: '📅',
      _ts: new Date(r.createdAt).getTime(),
    }))

  const merged = fromNotifs.length ? fromNotifs : fromReservations
  return (merged as (FeedItem & { _ts: number })[])
    .sort((a, b) => b._ts - a._ts)
    .slice(0, ACTIVITY_LIMIT)
})

// ── Distribución por canal ───────────────────────────────────────────────
const CHANNEL_META: Array<{ match: string[]; label: string; color: string }> = [
  { match: ['booking'], label: 'Booking.com', color: '#2563EB' },
  { match: ['direct', 'phone', 'whatsapp'], label: 'Directo', color: '#22C55E' },
  { match: ['airbnb'], label: 'Airbnb', color: '#EF4444' },
  { match: ['expedia'], label: 'Expedia', color: '#F59E0B' },
  { match: ['agoda'], label: 'Agoda', color: '#8B5CF6' },
  { match: ['google'], label: 'Google', color: '#06B6D4' },
]

const channelDistribution = computed<ChannelSlice[]>(() => {
  const active = reservationStore.reservations.filter(r => r.status !== 'cancelled')
  if (!active.length) return []
  const counts = new Map<string, { label: string; color: string; count: number }>()
  for (const r of active) {
    const meta = CHANNEL_META.find(m => m.match.includes(r.source)) ?? { label: 'Otros', color: '#64748B' }
    const prev = counts.get(meta.label)
    if (prev) prev.count++
    else counts.set(meta.label, { label: meta.label, color: meta.color, count: 1 })
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .map(c => ({ ...c, pct: Math.round((c.count / active.length) * 100) }))
})

// ── Estado de servicios ──────────────────────────────────────────────────
const hotelServices = computed<ServiceStatus[]>(() => {
  const offline: ServiceStatus['tone'] = 'error'
  const services: ServiceStatus[] = [
    { label: 'Recepción', status: apiOnline.value ? 'Online' : 'Offline', tone: apiOnline.value ? 'ok' : offline },
  ]

  const engineOn = Boolean(hotelData.value?.bookingEngineUrl) || hotelData.value?.onlineBookingStatus === 'active'
  services.push({
    label: 'Motor de Reservas',
    status: !apiOnline.value ? 'Offline' : engineOn ? 'Online' : 'Inactivo',
    tone: !apiOnline.value ? offline : engineOn ? 'ok' : 'warn',
  })

  services.push({
    label: 'Channel Manager',
    status: channelConnected.value > 0 ? (channelSyncEnabled.value ? 'Sincronizado' : 'Conectado') : 'Sin conectar',
    tone: channelConnected.value > 0 ? 'sync' : 'off',
  })

  const paymentsConfigured = Boolean(hotelData.value?.defaultPaymentMethod || hotelData.value?.depositType)
  services.push({
    label: 'Sistema de Pagos',
    status: !apiOnline.value ? 'Offline' : paymentsConfigured ? 'Online' : 'Sin configurar',
    tone: !apiOnline.value ? offline : paymentsConfigured ? 'ok' : 'warn',
  })

  services.push({ label: 'IA Hotel', status: apiOnline.value ? 'Disponible' : 'Offline', tone: apiOnline.value ? 'ok' : offline })
  return services
})

// ── Insights de IA (derivados de datos reales) ───────────────────────────
const AI_INSIGHTS_LIMIT = 5
/** Umbral de ocupación estimada a partir del cual sugerimos revisar tarifas */
const HIGH_OCCUPANCY_THRESHOLD = 85
/** Crecimiento semanal mínimo de un canal para destacarlo */
const CHANNEL_GROWTH_THRESHOLD = 20

const aiInsights = computed<AiInsight[]>(() => {
  const out: AiInsight[] = []
  const active = reservationStore.reservations.filter(r => r.status !== 'cancelled' && r.status !== 'checked_out')
  const total = dashboard.stats.totalRooms

  // Sobreventa mañana
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  const occupyingTomorrow = active.filter(r => dstr(r.checkIn) <= tomorrowStr && dstr(r.checkOut) > tomorrowStr)
  if (total > 0 && occupyingTomorrow.length > total) {
    out.push({ tone: 'danger', text: `Hay <b>sobreventa para mañana</b>: ${occupyingTomorrow.length} reservas para ${total} habitaciones.` })
  } else if (total > 0) {
    const pct = Math.round((occupyingTomorrow.length / total) * 100)
    out.push({ tone: 'info', text: `Se estima una ocupación del <b>${pct}%</b> para mañana.` })
    if (pct >= HIGH_OCCUPANCY_THRESHOLD) {
      out.push({ tone: 'ok', text: `Demanda alta para mañana — conviene <b>revisar tarifas al alza</b>.` })
    }
  }

  // Limpieza pendiente
  const dirtyCount = (dashboard.stats.roomsByStatus.dirty ?? 0) + (dashboard.stats.roomsByStatus.cleaning ?? 0)
  if (dirtyCount > 0) {
    out.push({ tone: 'warn', text: `<b>${dirtyCount} habitación${dirtyCount === 1 ? '' : 'es'}</b> pendiente${dirtyCount === 1 ? '' : 's'} de limpieza.` })
  }

  // Mantenimiento abierto
  if (dashboard.stats.openIncidents > 0) {
    out.push({ tone: 'warn', text: `${dashboard.stats.openIncidents} incidencia${dashboard.stats.openIncidents === 1 ? '' : 's'} de mantenimiento abierta${dashboard.stats.openIncidents === 1 ? '' : 's'}.` })
  }

  // Canal que crece semana contra semana
  const now = Date.now()
  const growth = new Map<string, { cur: number; prev: number }>()
  for (const r of reservationStore.reservations) {
    const created = new Date(r.createdAt).getTime()
    if (Number.isNaN(created)) continue
    const age = now - created
    const meta = CHANNEL_META.find(m => m.match.includes(r.source))
    const label = meta?.label ?? 'Otros'
    const g = growth.get(label) ?? { cur: 0, prev: 0 }
    if (age <= 7 * MS_DAY) g.cur++
    else if (age <= 14 * MS_DAY) g.prev++
    growth.set(label, g)
  }
  for (const [label, g] of growth) {
    if (g.prev >= 1 && g.cur >= 2) {
      const pct = Math.round(((g.cur - g.prev) / g.prev) * 100)
      if (pct >= CHANNEL_GROWTH_THRESHOLD) {
        out.push({ tone: 'ok', text: `<b>${label}</b> aumentó reservas un <b>${pct}%</b> vs semana pasada.` })
        break
      }
    }
  }

  // Llegadas de hoy
  if (dashboard.stats.arrivalsToday > 0) {
    out.push({ tone: 'info', text: `Hoy llegan <b>${dashboard.stats.arrivalsToday} huésped${dashboard.stats.arrivalsToday === 1 ? '' : 'es'}</b>.` })
  }

  return out.slice(0, AI_INSIGHTS_LIMIT)
})

// ── Clima (open-meteo, sin API key — solo si el hotel tiene coordenadas) ─
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast'
const WMO_MAP: Array<{ codes: number[]; label: string; icon: string }> = [
  { codes: [0], label: 'Despejado', icon: '☀️' },
  { codes: [1, 2], label: 'Parcialmente nublado', icon: '⛅' },
  { codes: [3], label: 'Nublado', icon: '☁️' },
  { codes: [45, 48], label: 'Niebla', icon: '🌫️' },
  { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67], label: 'Lluvia', icon: '🌧️' },
  { codes: [71, 73, 75, 77, 85, 86], label: 'Nieve', icon: '❄️' },
  { codes: [80, 81, 82], label: 'Chubascos', icon: '🌦️' },
  { codes: [95, 96, 99], label: 'Tormenta', icon: '⛈️' },
]

async function fetchWeather() {
  const lat = Number(hotelData.value?.latitude)
  const lon = Number(hotelData.value?.longitude)
  if (!lat || !lon) { weather.value = null; return }
  try {
    const res = await fetch(`${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true`)
    if (!res.ok) return
    const data = await res.json()
    const cw = data?.current_weather
    if (!cw) return
    const meta = WMO_MAP.find(m => m.codes.includes(Number(cw.weathercode))) ?? { label: 'Clima', icon: '🌤️' }
    weather.value = { temp: Number(cw.temperature), label: meta.label, icon: meta.icon }
  } catch { weather.value = null }
}

// ── Fetch / refresco ─────────────────────────────────────────────────────
async function fetchLiveData() {
  try {
    await dashboard.fetchStats(hotelId.value)
    apiOnline.value = !dashboard.error
  } catch { apiOnline.value = false }

  NotificationsService.list({ hotelId: hotelId.value })
    .then(r => { notifications.value = (r.data ?? []).slice(0, 20) })
    .catch(() => { /* módulo sin permiso o sin datos: el feed cae a reservas */ })

  ChannelService.status(hotelId.value)
    .then(s => {
      channelLastSync.value = s.lastSync
      channelConnected.value = s.connectedCount ?? 0
      channelSyncEnabled.value = Boolean(s.syncEnabled)
    })
    .catch(() => { /* sin channel manager configurado */ })
}

async function refreshOperationalData() {
  await Promise.all([
    roomStore.fetchRooms({ hotelId: hotelId.value }),
    reservationStore.fetchReservations({ hotelId: hotelId.value }),
    dashboard.fetchStats(hotelId.value),
  ])
}

async function fetchStaticData() {
  HotelService.settings(hotelId.value)
    .then(r => { hotelData.value = r.hotel ?? null; fetchWeather() })
    .catch(() => { /* settings puede requerir permisos extra */ })

  revenueLoading.value = true
  const to = todayStr()
  const from = new Date(Date.now() - REVENUE_WINDOW_DAYS * MS_DAY).toISOString().slice(0, 10)
  ReportsService.get<FacturacionReport>('facturacion', { from, to })
    .then(r => { revenueDaily.value = r.daily ?? [] })
    .catch(() => { /* rol sin reports:view → el gráfico muestra vacío */ })
    .finally(() => { revenueLoading.value = false })
}

let refreshTimer = 0

onMounted(async () => {
  await Promise.all([
    fetchLiveData(),
    roomStore.fetchRooms({ hotelId: hotelId.value }),
    reservationStore.fetchReservations({ hotelId: hotelId.value }),
  ])
  fetchStaticData()
  refreshTimer = window.setInterval(fetchLiveData, REFRESH_INTERVAL_MS)
})

onUnmounted(() => clearInterval(refreshTimer))

// PC-2.1.4 — recargar data al switchear hotel (el token refresca auth.user.hotelId).
watch(hotelId, async (id) => {
  if (!id) return
  await refreshOperationalData()
  fetchStaticData()
})

// ── Detalle de reserva / modal de habitación ─────────────────────────────
const detailId = ref<string | null>(null)
function openReservation(res: Reservation) { detailId.value = res.id }
function onEditReservation(d: { id: string }) {
  detailId.value = null
  router.push({ path: '/panel/reservations', query: { edit: d.id } })
}

const selectedRoom = ref<Room | null>(null)

const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: 'Disponible', occupied: 'Ocupada', pending: 'Pendiente',
  cleaning: 'En limpieza', dirty: 'Sucia', out_of_service: 'Fuera de servicio',
}
const ROOM_STATUS_COLOR: Record<RoomStatus, string> = {
  available: '#22C55E', occupied: '#EF4444', pending: '#06B6D4',
  cleaning: '#F59E0B', dirty: '#FB923C', out_of_service: '#94A3B8',
}
const roomAccent = computed(() => (selectedRoom.value ? ROOM_STATUS_COLOR[selectedRoom.value.status] : '#94A3B8'))

const roomGuest = computed(() => {
  if (!selectedRoom.value) return null
  const r = reservationStore.reservations.find(x => x.status === 'checked_in' && String(x.roomId) === String(selectedRoom.value!.id))
  if (!r) return null
  const name = r.guestName ?? 'Huésped'
  return {
    name,
    initials: name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join(''),
    checkIn: dstr(r.checkIn),
    checkOut: dstr(r.checkOut),
  }
})

async function setRoomStatus(status: RoomStatus) {
  if (!selectedRoom.value) return
  const id = selectedRoom.value.id
  selectedRoom.value = null
  try {
    await roomStore.updateRoomStatus(id, status)
    dashboard.fetchStats(hotelId.value)
  } catch {
    await roomStore.fetchRooms({ hotelId: hotelId.value })
  }
}
</script>

<style scoped>
.cc-dashboard {
  background:
    radial-gradient(1000px 500px at 80% -10%, rgba(37, 99, 235, 0.05), transparent),
    radial-gradient(800px 400px at 0% 110%, rgba(6, 182, 212, 0.04), transparent),
    #F8FAFC;
}
.cc-modal-btn {
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}
.cc-modal-btn:hover { filter: brightness(1.15); }
</style>
