<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Reportes</h2>
        <p class="text-sm text-text-muted mt-0.5">Business Intelligence y analítica del hotel</p>
      </div>
      <div class="flex gap-2">
        <select v-model="dateRange" class="px-4 py-2 rounded-xl border border-border text-sm font-bold focus:outline-none focus:border-navy cursor-pointer">
          <option value="today">Hoy</option>
          <option value="week">Esta Semana</option>
          <option value="month">Este Mes</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Este Año</option>
        </select>
        <button @click="exportPDF" class="px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">📄 PDF</button>
        <button @click="exportCSV" class="px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">📊 Excel</button>
      </div>
    </div>

    <!-- Main KPIs -->
    <div class="grid grid-cols-5 gap-4 mb-6">
      <div v-for="kpi in mainKPIs" :key="kpi.label" class="card p-4">
        <div class="text-[10px] text-text-muted font-bold uppercase mb-1">{{ kpi.label }}</div>
        <div class="text-2xl font-black" :class="kpi.color">{{ kpi.value }}</div>
        <div class="text-[10px] font-bold mt-1" :class="kpi.trend > 0 ? 'text-teal' : 'text-coral'">
          {{ kpi.trend > 0 ? '↑' : '↓' }} {{ kpi.trend > 0 ? '+' : '' }}{{ kpi.trend }}% vs anterior
        </div>
      </div>
    </div>

    <!-- Revenue Chart -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-navy">Ingresos — {{ dateRangeLabel }}</h3>
        <div class="flex gap-2">
          <button
            v-for="period in revenuePeriods"
            :key="period.value"
            @click="revenuePeriod = period.value"
            class="px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            :class="revenuePeriod === period.value ? 'bg-navy text-white' : 'bg-surface text-text-secondary'"
          >
            {{ period.label }}
          </button>
        </div>
      </div>
      <div class="flex items-end gap-1 h-48">
        <div v-for="(bar, i) in chartBars" :key="i" class="flex-1 flex flex-col items-center gap-1">
          <span class="text-[8px] font-bold text-text-muted">${{ bar.value }}</span>
          <div
            class="w-full rounded-t-lg transition-all duration-300 cursor-pointer hover:opacity-80"
            :class="bar.isToday ? 'bg-cyan' : 'bg-navy/20'"
            :style="{ height: bar.height + '%' }"
          ></div>
          <span class="text-[8px] font-bold" :class="bar.isToday ? 'text-cyan' : 'text-text-muted'">{{ bar.day }}</span>
        </div>
      </div>
    </div>

    <!-- Two Column Layout -->
    <div class="grid lg:grid-cols-2 gap-6 mb-6">
      <!-- Occupancy Chart -->
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Ocupación por Tipo de Habitación</h3>
        <div class="space-y-4">
          <div v-for="roomType in roomTypes" :key="roomType.name" class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-navy">{{ roomType.name }}</span>
              <span class="text-sm font-extrabold" :class="roomType.percentage >= 80 ? 'text-teal' : roomType.percentage >= 50 ? 'text-gold' : 'text-coral'">
                {{ roomType.percentage }}%
              </span>
            </div>
            <div class="h-3 bg-surface-dark rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500" :class="roomType.color" :style="{ width: roomType.percentage + '%' }"></div>
            </div>
            <div class="flex justify-between text-[10px] text-text-muted">
              <span>{{ roomType.occupied }}/{{ roomType.total }} ocupadas</span>
              <span>${{ roomType.avgRate }}/noche prom.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Channels Performance -->
      <div class="card p-6">
        <h3 class="font-extrabold text-navy mb-4">Rendimiento por Canal</h3>
        <div class="space-y-3">
          <div v-for="channel in channels" :key="channel.name" class="bg-surface rounded-xl p-3">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ channel.icon }}</span>
                <span class="text-sm font-bold text-navy">{{ channel.name }}</span>
              </div>
              <span class="text-sm font-extrabold text-navy">${{ channel.revenue.toLocaleString() }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div>
                <div class="text-lg font-black text-navy">{{ channel.bookings }}</div>
                <div class="text-[9px] text-text-muted">Reservas</div>
              </div>
              <div>
                <div class="text-lg font-black text-cyan">{{ channel.adr }}</div>
                <div class="text-[9px] text-text-muted">ADR</div>
              </div>
              <div>
                <div class="text-lg font-black" :class="channel.commission > 0 ? 'text-coral' : 'text-teal'">
                  {{ channel.commission > 0 ? '-' + channel.commission + '%' : '0%' }}
                </div>
                <div class="text-[9px] text-text-muted">Comisión</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Occupancy Report -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-navy">Reporte Detallado de Ocupación por Día</h3>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-text-muted">{{ occupancyMonth }}</span>
          <button class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Exportar</button>
        </div>
      </div>
      <!-- Occupancy Bar Chart -->
      <div class="flex items-end gap-0.5 h-32 mb-6">
        <div v-for="(day, idx) in dailyOccupancy" :key="idx" class="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
          <div class="text-[7px] font-bold text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{{ day.occupied }}/{{ day.total }} hab</div>
          <div class="w-full rounded-t transition-all hover:opacity-80"
            :class="day.percentage > 90 ? 'bg-coral' : day.percentage > 70 ? 'bg-gold' : day.percentage > 40 ? 'bg-cyan' : 'bg-teal'"
            :style="{ height: day.percentage + '%' }"
            :title="day.date + ': ' + day.percentage + '% (' + day.occupied + '/' + day.total + ')'"
          ></div>
          <span class="text-[7px] font-bold text-text-muted">{{ day.day }}</span>
        </div>
      </div>
      <!-- Legend -->
      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-coral"></div><span class="text-[9px] font-bold text-text-muted">90-100%</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-gold"></div><span class="text-[9px] font-bold text-text-muted">70-89%</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-cyan"></div><span class="text-[9px] font-bold text-text-muted">40-69%</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-teal"></div><span class="text-[9px] font-bold text-text-muted">0-39%</span></div>
      </div>
      <!-- Occupancy Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase rounded-tl-xl">Tipo Habitación</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Total</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Ocupadas</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Libres</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">Ocupación</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase">ADR</th>
              <th class="text-center py-3 px-3 text-[10px] font-bold text-text-muted uppercase rounded-tr-xl">RevPAR</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="type in occupancyByType" :key="type.name" class="border-b border-border/50 hover:bg-surface/30 transition-colors">
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded" :class="type.color"></div>
                  <span class="text-sm font-bold text-navy">{{ type.name }}</span>
                </div>
              </td>
              <td class="py-3 px-3 text-center text-sm font-bold text-navy">{{ type.total }}</td>
              <td class="py-3 px-3 text-center text-sm text-teal">{{ type.occupied }}</td>
              <td class="py-3 px-3 text-center text-sm text-text-muted">{{ type.free }}</td>
              <td class="py-3 px-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-16 h-1.5 bg-surface-dark rounded-full overflow-hidden">
                    <div class="h-full rounded-full" :class="type.color" :style="{ width: type.percentage + '%' }"></div>
                  </div>
                  <span class="text-xs font-extrabold" :class="type.percentage >= 80 ? 'text-teal' : type.percentage >= 50 ? 'text-gold' : 'text-coral'">
                    {{ type.percentage }}%
                  </span>
                </div>
              </td>
              <td class="py-3 px-3 text-center text-sm font-bold text-navy">${{ type.adr }}</td>
              <td class="py-3 px-3 text-center text-sm font-bold text-cyan">${{ type.revpar }}</td>
            </tr>
            <!-- Totals -->
            <tr class="bg-navy/5 font-bold">
              <td class="py-3 px-4 text-sm font-black text-navy">Total</td>
              <td class="py-3 px-3 text-center text-sm font-black text-navy">{{ totalRooms }}</td>
              <td class="py-3 px-3 text-center text-sm text-teal font-black">{{ totalOccupied }}</td>
              <td class="py-3 px-3 text-center text-sm text-text-muted font-black">{{ totalFree }}</td>
              <td class="py-3 px-3 text-center">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-16 h-1.5 bg-surface-dark rounded-full overflow-hidden">
                    <div class="h-full rounded-full bg-navy" :style="{ width: avgOccupancy + '%' }"></div>
                  </div>
                  <span class="text-xs font-extrabold text-navy">{{ avgOccupancy }}%</span>
                </div>
              </td>
              <td class="py-3 px-3 text-center text-sm font-black text-navy">${{ avgADR }}</td>
              <td class="py-3 px-3 text-center text-sm font-black text-cyan">${{ avgRevPAR }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Second Row -->
    <div class="grid lg:grid-cols-3 gap-6 mb-6">
      <!-- Top Guests -->
      <div class="card">
        <div class="p-4 border-b border-border">
          <h3 class="font-extrabold text-navy text-sm">Huéspedes Top (por gasto)</h3>
        </div>
        <div class="p-3 space-y-2">
          <div v-for="(guest, i) in topGuests" :key="guest.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" :class="i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-gray-200 text-gray-500' : 'bg-orange-100 text-orange-500'">
              {{ i + 1 }}
            </span>
            <div class="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
              {{ guest.initials }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ guest.name }}</div>
              <div class="text-[10px] text-text-muted">{{ guest.stays }} estadías</div>
            </div>
            <span class="text-sm font-extrabold text-navy">${{ guest.totalSpent.toLocaleString() }}</span>
          </div>
        </div>
      </div>

      <!-- Top Countries -->
      <div class="card">
        <div class="p-4 border-b border-border">
          <h3 class="font-extrabold text-navy text-sm">Huéspedes por País</h3>
        </div>
        <div class="p-3 space-y-2">
          <div v-for="country in topCountries" :key="country.name" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors">
            <span class="text-xl">{{ country.flag }}</span>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="text-sm font-bold text-navy">{{ country.name }}</span>
                <span class="text-sm font-extrabold text-navy">{{ country.percentage }}%</span>
              </div>
              <div class="h-2 bg-surface-dark rounded-full overflow-hidden mt-1">
                <div class="h-full rounded-full bg-navy/30" :style="{ width: country.percentage + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upcoming Arrivals -->
      <div class="card">
        <div class="p-4 border-b border-border">
          <h3 class="font-extrabold text-navy text-sm">Próximas Llegadas (3 días)</h3>
        </div>
        <div class="p-3 space-y-2">
          <div v-for="arrival in upcomingArrivals" :key="arrival.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors cursor-pointer">
            <div class="w-10 h-10 rounded-lg bg-cyan/10 flex items-center justify-center text-sm font-bold text-cyan">
              {{ arrival.date.split(' ')[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ arrival.guest }}</div>
              <div class="text-[10px] text-text-muted">Hab {{ arrival.room }} · {{ arrival.nights }} noches</div>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="arrival.source === 'direct' ? 'bg-teal/10 text-teal' : 'bg-blue-100 text-blue-700'">
              {{ arrival.source === 'direct' ? 'Directa' : 'Booking' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Revenue Breakdown -->
    <div class="card p-6">
      <h3 class="font-extrabold text-navy mb-4">Desglose de Ingresos</h3>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="rev in revenueBreakdown" :key="rev.category" class="bg-surface rounded-xl p-4 text-center">
          <div class="text-lg mb-2">{{ rev.icon }}</div>
          <div class="text-xl font-black" :class="rev.color">${{ rev.amount.toLocaleString() }}</div>
          <div class="text-[10px] text-text-muted font-bold uppercase mt-1">{{ rev.category }}</div>
          <div class="text-[10px] font-bold mt-1" :class="rev.trend > 0 ? 'text-teal' : 'text-coral'">
            {{ rev.trend > 0 ? '↑' : '↓' }} {{ Math.abs(rev.trend) }}%
          </div>
        </div>
      </div>
    </div>
    <!-- Daily Occupancy (MisterPlan style) -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-navy">Ocupación Diaria — {{ dateRangeLabel }}</h3>
        <div class="flex gap-2 text-[10px] font-bold">
          <span class="text-teal">■ Ocupada</span>
          <span class="text-gray-300">■ Libre</span>
          <span class="text-coral">■ Bloqueada</span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b-2 border-navy">
              <th class="text-left py-2 px-3 uppercase text-[10px] text-text-muted">Día</th>
              <th class="text-center py-2 px-3 uppercase text-[10px] text-text-muted">Ocupadas</th>
              <th class="text-center py-2 px-3 uppercase text-[10px] text-text-muted">Libres</th>
              <th class="text-center py-2 px-3 uppercase text-[10px] text-text-muted">Bloqueos</th>
              <th class="text-center py-2 px-3 uppercase text-[10px] text-text-muted">% Ocupación</th>
              <th class="text-center py-2 px-3 uppercase text-[10px] text-text-muted">Ingresos</th>
              <th class="text-right py-2 px-3 uppercase text-[10px] text-text-muted">Barra</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in dailyOccupancy" :key="d.date" class="border-b border-border hover:bg-surface/30">
              <td class="py-2 px-3 font-bold text-navy">{{ d.dayName }} {{ d.dayNum }}</td>
              <td class="py-2 px-3 text-center font-bold text-teal">{{ d.occupied }}</td>
              <td class="py-2 px-3 text-center text-text-secondary">{{ d.free }}</td>
              <td class="py-2 px-3 text-center text-text-secondary">{{ d.blocked }}</td>
              <td class="py-2 px-3 text-center">
                <span class="font-bold" :class="d.pct >= 80 ? 'text-coral' : d.pct >= 50 ? 'text-gold' : 'text-teal'">{{ d.pct }}%</span>
              </td>
              <td class="py-2 px-3 text-center font-bold">${{ d.revenue }}</td>
              <td class="py-2 px-3">
                <div class="h-3 bg-surface rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" :class="d.pct >= 80 ? 'bg-coral' : d.pct >= 50 ? 'bg-gold' : 'bg-teal'" :style="{ width: d.pct + '%' }"></div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ReportService } from '@/services/Report.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const report = ref<Awaited<ReturnType<typeof ReportService.get>> | null>(null)

const dateRange = ref('month')
const revenuePeriod = ref('daily')

const dateRangeLabel = computed(() => {
  const labels: Record<string, string> = { today: 'Hoy', week: 'Esta Semana', month: 'Junio 2026', quarter: 'Q2 2026', year: '2026' }
  return labels[dateRange.value] ?? ''
})

const revenuePeriods = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
]

const mainKPIs = computed(() => {
  const r = report.value
  const total = r?.totalReservations ?? 0
  const canceled = r?.canceledReservations ?? 0
  return [
    { label: 'Ingresos Totales', value: `$${(r?.totalRevenue ?? 0).toLocaleString()}`, color: 'text-navy', trend: 0 },
    { label: 'Reservas', value: String(total), color: 'text-cyan', trend: 0 },
    { label: 'Canceladas', value: String(canceled), color: 'text-teal', trend: 0 },
    { label: 'Tasa Cancelación', value: total > 0 ? `${Math.round((canceled / total) * 100)}%` : '0%', color: 'text-gold', trend: 0 },
    { label: 'Tipos de Hab.', value: String(r?.occupancyByType?.length ?? 0), color: 'text-coral', trend: 0 },
  ]
})

const chartBars = computed(() => {
  const series = report.value?.dailyRevenue ?? []
  const max = Math.max(...series.map((d: any) => d.value), 1)
  const today = new Date().toISOString().slice(0, 10)
  return series.map((d: any) => ({
    day: String(d.date).slice(8, 10),
    value: d.value.toLocaleString(),
    height: Math.round((d.value / max) * 100),
    isToday: d.date === today,
  }))
})

const CHANNEL_META: Record<string, { icon: string; commission: number }> = {
  direct: { icon: '🏨', commission: 0 }, directa: { icon: '🏨', commission: 0 },
  booking: { icon: '🌐', commission: 15 }, 'booking.com': { icon: '🌐', commission: 15 },
  expedia: { icon: '✈️', commission: 18 }, airbnb: { icon: '🏠', commission: 3 },
  whatsapp: { icon: '💬', commission: 0 }, phone: { icon: '📞', commission: 0 },
}

const roomTypes = computed(() =>
  (report.value?.occupancyByType ?? []).map(t => ({
    name: t.type, occupied: t.occupied, total: t.total, percentage: t.percentage,
    color: 'bg-cyan', avgRate: 0,
  }))
)

const channels = computed(() =>
  Object.entries(report.value?.byChannel ?? {}).map(([name, revenue]) => ({
    name, icon: CHANNEL_META[name.toLowerCase()]?.icon ?? '🔗',
    revenue: revenue as number, bookings: 0, adr: 0,
    commission: CHANNEL_META[name.toLowerCase()]?.commission ?? 0,
  }))
)

onMounted(async () => {
  try { report.value = await ReportService.get(hotelId.value) } catch { toast.error("Error al cargar datos") }
})

const topGuests = computed(() =>
  (report.value?.topGuests ?? []).map((g: any) => ({
    id: g.name, name: g.name,
    initials: (g.name || '').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
    stays: g.stays, totalSpent: g.totalSpent,
  })),
)

const topCountries = computed(() =>
  (report.value?.topCountries ?? []).map((c: any) => ({ name: c.name, flag: '🏳️', percentage: c.percentage })),
)

const upcomingArrivals = computed(() =>
  (report.value?.upcomingArrivals ?? []).map((a: any) => ({ id: a.id, guest: '—', room: '', date: String(a.date).slice(5, 10), nights: 0, source: a.source })),
)

const revenueBreakdown = computed(() =>
  (report.value?.revenueBreakdown ?? []).map((r: any, i: number) => ({
    category: r.category, icon: ['🏨','🍽️','💆','📦'][i % 4],
    amount: r.amount, color: ['text-navy','text-cyan','text-teal','text-gold'][i % 4], trend: 0,
  })),
)

const occupancyMonth = ref('Junio 2026')

const TYPE_COLOR: Record<string, string> = { simple: 'bg-teal', doble: 'bg-cyan', double: 'bg-cyan', suite: 'bg-gold', familiar: 'bg-purple' }

const occupancyByType = computed(() =>
  (report.value?.occupancyByType ?? []).map((t: any) => ({
    name: t.type, color: TYPE_COLOR[String(t.type).toLowerCase()] ?? 'bg-cyan',
    total: t.total, occupied: t.occupied, free: t.total - t.occupied,
    percentage: t.percentage, adr: 0, revpar: 0,
  })),
)

const dailyOccupancy = computed(() => {
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const total = totalRooms.value
  return (report.value?.dailyRevenue ?? []).map((d: any, i: number) => {
    const date = d.date
    const dt = new Date(date + 'T12:00:00')
    const dayNum = dt.getDate()
    const dayName = days[dt.getDay()]
    const occ = occupancyByType.value.reduce((s: number, t: any) => s + (t.occupied || 0), 0)
    return { date, dayName, dayNum, occupied: occ, free: total - occ, blocked: 0, pct: total ? Math.round(occ / total * 100) : 0, revenue: d.value || 0 }
  })
})

const totalRooms = computed(() => occupancyByType.value.reduce((sum: number, t: any) => sum + t.total, 0))
const totalOccupied = computed(() => occupancyByType.value.reduce((sum, t) => sum + t.occupied, 0))
const totalFree = computed(() => occupancyByType.value.reduce((sum, t) => sum + t.free, 0))
const avgOccupancy = computed(() => Math.round(totalOccupied.value / totalRooms.value * 100))
const avgADR = computed(() => Math.round(occupancyByType.value.reduce((sum, t) => sum + t.adr * t.total, 0) / totalRooms.value))
const avgRevPAR = computed(() => Math.round(occupancyByType.value.reduce((sum, t) => sum + t.revpar * t.total, 0) / totalRooms.value))

function exportPDF() {
  window.print()
}

function exportCSV() {
  const r = report.value
  if (!r) return
  const rows: string[][] = [
    ['REPORTE — ' + dateRangeLabel.value],
    [],
    ['MÉTRICA', 'VALOR'],
    ['Ingresos Totales', `$${r.totalRevenue ?? 0}`],
    ['Reservas', String(r.totalReservations ?? 0)],
    ['Canceladas', String(r.canceledReservations ?? 0)],
    [],
    ['OCUPACIÓN POR TIPO'],
    ['Tipo', 'Total', 'Ocupadas', 'Ocupación %'],
    ...(r.occupancyByType ?? []).map((t: any) => [t.type, String(t.total), String(t.occupied), `${t.percentage}%`]),
    [],
    ['CANALES'],
    ['Canal', 'Ingresos'],
    ...Object.entries(r.byChannel ?? {}).map(([k, v]) => [k, `$${v}`]),
    [],
    ['DESGLOSE INGRESOS'],
    ['Categoría', 'Monto'],
    ...(r.revenueBreakdown ?? []).map((b: any) => [b.category, `$${b.amount}`]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `reporte-${dateRange.value}.csv`; a.click()
  URL.revokeObjectURL(url)
}
</script>
