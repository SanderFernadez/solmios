<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Reportes</h2>
        <p class="text-xs text-text-muted mt-0.5">Análisis de rendimiento del hotel</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select v-model="range" @change="onRangeChange" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
          <option value="thisMonth">📅 Este mes</option>
          <option value="lastMonth">📅 Mes pasado</option>
          <option value="thisQuarter">📅 Este trimestre</option>
          <option value="thisYear">📅 Este año</option>
          <option value="custom">⚙️ Personalizado</option>
        </select>
        <template v-if="range === 'custom'">
          <input v-model="from" type="date" class="px-3 py-2 rounded-xl border border-border text-xs" @change="load" />
          <span class="text-text-muted text-xs">→</span>
          <input v-model="to" type="date" class="px-3 py-2 rounded-xl border border-border text-xs" @change="load" />
        </template>
        <button @click="exportCsv" :disabled="!data" class="px-3 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
          ⬇ Exportar CSV
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 overflow-x-auto">
      <button v-for="(meta, key) in REPORT_META" :key="key" @click="changeTab(key as ReportType)"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
        :class="activeTab === key ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span>{{ meta.icon }}</span>
        <span>{{ meta.label }}</span>
      </button>
    </div>

    <p class="text-xs text-text-muted mb-4">{{ REPORT_META[activeTab].description }}</p>

    <!-- Loading -->
    <div v-if="loading" class="card p-12 text-center text-sm text-text-muted">Cargando reporte...</div>

    <!-- Facturación -->
    <div v-else-if="activeTab === 'facturacion' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Habitaciones" :value="formatMoney((data as FacturacionReport).roomRevenue)" />
        <KpiCard label="Extras" :value="formatMoney((data as FacturacionReport).extrasRevenue)" />
        <KpiCard label="Impuestos" :value="formatMoney((data as FacturacionReport).taxes)" />
        <KpiCard label="Comisiones OTA" :value="formatMoney((data as FacturacionReport).commissionOTA)" />
        <KpiCard label="Total bruto" :value="formatMoney((data as FacturacionReport).total)" class="text-navy" />
        <KpiCard label="Neto" :value="formatMoney((data as FacturacionReport).net)" class="text-teal" />
      </div>
      <div class="card p-5">
        <h4 class="text-xs font-black text-navy uppercase mb-3">Extras por categoría</h4>
        <div v-if="Object.keys((data as FacturacionReport).extrasByCategory).length === 0" class="text-xs text-text-muted">Sin extras facturados en el período.</div>
        <div v-else class="space-y-2">
          <div v-for="(val, cat) in (data as FacturacionReport).extrasByCategory" :key="cat" class="flex items-center justify-between text-xs">
            <span class="text-navy font-bold capitalize">{{ cat }}</span>
            <span class="text-text-secondary">{{ formatMoney(val as number) }}</span>
          </div>
        </div>
      </div>
      <BarChart :data="series((data as FacturacionReport).daily)" :format="formatMoney" :label="longRange ? 'Ingresos mensuales' : 'Ingresos diarios'" />
    </div>

    <!-- Ocupación -->
    <div v-else-if="activeTab === 'ocupacion' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Hab. totales" :value="String((data as OcupacionReport).totalRooms)" />
        <KpiCard label="Ocup. media real" :value="`${(data as OcupacionReport).avgRealOccupancy}%`" class="text-cyan" />
        <KpiCard label="Ocupadas/día" :value="String(ocupAvgOccupied)" />
        <KpiCard label="Libres/día" :value="String(ocupAvgFree)" class="text-teal" />
      </div>
      <div class="card p-5">
        <h4 class="text-xs font-black text-navy uppercase mb-3">Hab. por tipo</h4>
        <div class="flex flex-wrap gap-2">
          <span v-for="(cnt, type) in (data as OcupacionReport).byRoomType" :key="type"
            class="px-3 py-1.5 bg-navy/5 text-navy rounded-full text-xs font-bold">
            {{ type }}: {{ cnt }}
          </span>
        </div>
      </div>
      <BarChart :data="series((data as OcupacionReport).daily.map(d => ({ date: d.date, value: d.realOccupiedPct })), 'avg')" :format="(v: number) => `${v}%`" :label="longRange ? 'Ocupación mensual (%)' : 'Ocupación diaria (%)'" />
      <div class="card p-5 overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="border-b border-border">
            <th class="text-left p-2 text-text-muted uppercase">Fecha</th>
            <th class="text-right p-2 text-text-muted uppercase">Ocupadas</th>
            <th class="text-right p-2 text-text-muted uppercase">Bloqueadas</th>
            <th class="text-right p-2 text-text-muted uppercase">Libres</th>
            <th class="text-right p-2 text-text-muted uppercase">Ocup. %</th>
          </tr></thead>
          <tbody>
            <tr v-for="d in (data as OcupacionReport).daily" :key="d.date" class="border-b border-border/30">
              <td class="p-2 text-navy">{{ formatDate(d.date) }}</td>
              <td class="p-2 text-right">{{ d.occupied }}</td>
              <td class="p-2 text-right text-text-muted">{{ d.blocked }}</td>
              <td class="p-2 text-right text-teal">{{ d.free }}</td>
              <td class="p-2 text-right font-bold" :class="d.realOccupiedPct > 80 ? 'text-coral' : d.realOccupiedPct > 50 ? 'text-gold' : 'text-teal'">{{ d.realOccupiedPct }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pernoctaciones -->
    <div v-else-if="activeTab === 'pernoctaciones' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total paxes" :value="String((data as PernotacionesReport).totalPaxes)" />
        <KpiCard label="Adultos" :value="String((data as PernotacionesReport).totalAdults)" />
        <KpiCard label="Niños" :value="String((data as PernotacionesReport).totalChildren)" />
        <KpiCard label="Media/noche" :value="String((data as PernotacionesReport).avgPerNight)" />
      </div>
      <BarChart :data="series((data as PernotacionesReport).daily.map(d => ({ date: d.date, value: d.total })))" :format="String" :label="longRange ? 'Paxes por mes' : 'Paxes por noche'" />
    </div>

    <!-- Rendimiento -->
    <div v-else-if="activeTab === 'rendimiento' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="ADR" :value="formatMoney((data as RendimientoReport).adr)" class="text-navy" />
        <KpiCard label="RevPAR" :value="formatMoney((data as RendimientoReport).revpar)" class="text-cyan" />
        <KpiCard label="Ocupación" :value="`${(data as RendimientoReport).occupancyPct}%`" />
        <KpiCard label="Estancia media" :value="`${(data as RendimientoReport).avgStay} noches`" />
        <KpiCard label="Noches vendidas" :value="String((data as RendimientoReport).nightsSold)" />
        <KpiCard label="Hab-disponibles" :value="String((data as RendimientoReport).availableRoomNights)" />
      </div>
      <div class="card p-5 overflow-x-auto">
        <h4 class="text-xs font-black text-navy uppercase mb-3">ADR por tipo de habitación</h4>
        <table class="w-full text-xs">
          <thead><tr class="border-b border-border">
            <th class="text-left p-2 text-text-muted uppercase">Tipo</th>
            <th class="text-right p-2 text-text-muted uppercase">Noches vendidas</th>
            <th class="text-right p-2 text-text-muted uppercase">Revenue</th>
            <th class="text-right p-2 text-text-muted uppercase">ADR</th>
          </tr></thead>
          <tbody>
            <tr v-for="(v, type) in (data as RendimientoReport).adrByType" :key="type" class="border-b border-border/30">
              <td class="p-2 text-navy font-bold">{{ type }}</td>
              <td class="p-2 text-right">{{ v.nights }}</td>
              <td class="p-2 text-right">{{ formatMoney(v.revenue) }}</td>
              <td class="p-2 text-right font-bold text-cyan">{{ formatMoney(v.adr) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Procedencia -->
    <div v-else-if="activeTab === 'procedencia' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Países" :value="String((data as ProcedenciaReport).byCountry.length)" />
        <KpiCard label="Top país" :value="(data as ProcedenciaReport).byCountry[0]?.country || '—'" class="text-navy" />
        <KpiCard label="Canales" :value="String((data as ProcedenciaReport).byChannel.length)" />
        <KpiCard label="Revenue total" :value="formatMoney(procTotalRevenue)" class="text-teal" />
      </div>
      <div class="card p-5">
        <h4 class="text-xs font-black text-navy uppercase mb-3">Revenue por canal</h4>
        <div v-if="(data as ProcedenciaReport).byChannel.length === 0" class="text-xs text-text-muted">Sin datos.</div>
        <div v-else class="space-y-2">
          <div v-for="c in (data as ProcedenciaReport).byChannel" :key="c.channel" class="flex items-center gap-3 text-xs">
            <span class="w-24 text-navy font-bold capitalize truncate">{{ c.channel }}</span>
            <div class="flex-1 h-2 bg-surface rounded-full overflow-hidden">
              <div class="h-full bg-cyan rounded-full" :style="{ width: Math.round((c.revenue / procMaxChannelRevenue) * 100) + '%' }"></div>
            </div>
            <span class="w-20 text-right text-text-secondary">{{ formatMoney(c.revenue) }}</span>
          </div>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card p-5">
          <h4 class="text-xs font-black text-navy uppercase mb-3">Por país</h4>
          <div v-if="(data as ProcedenciaReport).byCountry.length === 0" class="text-xs text-text-muted">Sin datos.</div>
          <table v-else class="w-full text-xs">
            <thead><tr class="border-b border-border">
              <th class="text-left p-2 text-text-muted uppercase">País</th>
              <th class="text-right p-2 text-text-muted uppercase">Huéspedes</th>
              <th class="text-right p-2 text-text-muted uppercase">Revenue</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in (data as ProcedenciaReport).byCountry" :key="c.country" class="border-b border-border/30">
                <td class="p-2 text-navy font-bold">{{ c.country }}</td>
                <td class="p-2 text-right">{{ c.guests }}</td>
                <td class="p-2 text-right">{{ formatMoney(c.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card p-5">
          <h4 class="text-xs font-black text-navy uppercase mb-3">Por canal</h4>
          <div v-if="(data as ProcedenciaReport).byChannel.length === 0" class="text-xs text-text-muted">Sin datos.</div>
          <table v-else class="w-full text-xs">
            <thead><tr class="border-b border-border">
              <th class="text-left p-2 text-text-muted uppercase">Canal</th>
              <th class="text-right p-2 text-text-muted uppercase">Reservas</th>
              <th class="text-right p-2 text-text-muted uppercase">Revenue</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in (data as ProcedenciaReport).byChannel" :key="c.channel" class="border-b border-border/30">
                <td class="p-2 text-navy font-bold capitalize">{{ c.channel }}</td>
                <td class="p-2 text-right">{{ c.count }}</td>
                <td class="p-2 text-right">{{ formatMoney(c.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Reservas -->
    <div v-else-if="activeTab === 'reservas' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total" :value="String((data as ReservasReport).total)" />
        <KpiCard label="OTA" :value="`${(data as ReservasReport).otaVsDirect.ota} (${(data as ReservasReport).otaVsDirect.otaPct}%)`" class="text-cyan" />
        <KpiCard label="Directas" :value="`${(data as ReservasReport).otaVsDirect.direct} (${(data as ReservasReport).otaVsDirect.directPct}%)`" class="text-teal" />
        <KpiCard label="Canceladas" :value="`${(data as ReservasReport).cancelled} (${(data as ReservasReport).cancellationRate}%)`" class="text-coral" />
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card p-5">
          <h4 class="text-xs font-black text-navy uppercase mb-3">Por estado</h4>
          <div class="space-y-2">
            <div v-for="(cnt, status) in (data as ReservasReport).byStatus" :key="status" class="flex items-center justify-between text-xs">
              <span class="text-navy font-bold capitalize">{{ status }}</span>
              <span class="text-text-secondary">{{ cnt }}</span>
            </div>
          </div>
        </div>
        <div class="card p-5">
          <h4 class="text-xs font-black text-navy uppercase mb-3">Por canal</h4>
          <div class="space-y-2">
            <div v-for="(cnt, ch) in (data as ReservasReport).byChannel" :key="ch" class="flex items-center justify-between text-xs">
              <span class="text-navy font-bold capitalize">{{ ch }}</span>
              <span class="text-text-secondary">{{ cnt }}</span>
            </div>
          </div>
        </div>
      </div>
      <BarChart :data="series((data as ReservasReport).dailyCreated)" :format="String" :label="longRange ? 'Reservas creadas por mes' : 'Reservas creadas por día'" />
    </div>

    <div v-else-if="!loading && !data" class="card p-12 text-center text-sm text-text-muted">
      Sin datos para el período seleccionado
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ReportsService, REPORT_META } from '@/services/Reports.service'
import type { ReportType, FacturacionReport, OcupacionReport, PernotacionesReport, RendimientoReport, ProcedenciaReport, ReservasReport, AnyReport } from '@/services/Reports.service'
import { useToast } from '@/composables/useToast'
import KpiCard from '@/components/features/core-pms/KpiCard.vue'
import BarChart from '@/components/features/core-pms/BarChart.vue'

const toast = useToast()

const activeTab = ref<ReportType>('facturacion')
const data = ref<AnyReport | null>(null)
const loading = ref(false)
const range = ref<'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom'>('thisMonth')
const from = ref('')
const to = ref('')

function computeRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (range.value === 'thisMonth') {
    from.value = new Date(y, m, 1).toISOString().slice(0, 10)
    to.value = new Date(y, m + 1, 0).toISOString().slice(0, 10)
  } else if (range.value === 'lastMonth') {
    from.value = new Date(y, m - 1, 1).toISOString().slice(0, 10)
    to.value = new Date(y, m, 0).toISOString().slice(0, 10)
  } else if (range.value === 'thisQuarter') {
    const q = Math.floor(m / 3)
    from.value = new Date(y, q * 3, 1).toISOString().slice(0, 10)
    to.value = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10)
  } else if (range.value === 'thisYear') {
    from.value = new Date(y, 0, 1).toISOString().slice(0, 10)
    to.value = new Date(y, 11, 31).toISOString().slice(0, 10)
  }
}

function onRangeChange() {
  if (range.value !== 'custom') {
    computeRange()
    load()
  }
}

async function load() {
  if (!from.value || !to.value) computeRange()
  loading.value = true
  data.value = null
  try {
    data.value = await ReportsService.get<AnyReport>(activeTab.value, { from: from.value, to: to.value })
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar reporte')
  } finally {
    loading.value = false
  }
}

async function changeTab(t: ReportType) {
  activeTab.value = t
  await load()
}

async function exportCsv() {
  try {
    await ReportsService.exportCsv(activeTab.value, { from: from.value, to: to.value })
    toast.success('CSV exportado')
  } catch (e: any) {
    toast.error(e.message || 'Error al exportar')
  }
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0)
}

// PC-1.2.5 — evolución mensual cuando el rango es largo (>90 días), diario en el resto.
const longRange = computed(() => {
  if (!from.value || !to.value) return false
  return Math.round((new Date(to.value).getTime() - new Date(from.value).getTime()) / 86_400_000) > 90
})

function series(points: { date: string; value: number }[], mode: 'sum' | 'avg' = 'sum'): { date: string; value: number }[] {
  if (!longRange.value || points.length === 0) return points
  const buckets: Record<string, number[]> = {}
  for (const p of points) {
    const mk = p.date.slice(0, 7)
    ;(buckets[mk] ||= []).push(p.value)
  }
  return Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, vals]) => ({
      date,
      value: mode === 'avg'
        ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
        : vals.reduce((s, v) => s + v, 0),
    }))
}

const chartGranularity = computed(() => longRange.value ? 'meses' : 'días')

// Ocupación — medias diarias para KPIs extra (PC-1.2.4)
const ocupAvgOccupied = computed(() => {
  const d = (data.value as OcupacionReport | null)?.daily
  if (!d || d.length === 0) return 0
  return Math.round(d.reduce((s, x) => s + x.occupied, 0) / d.length)
})
const ocupAvgFree = computed(() => {
  const d = (data.value as OcupacionReport | null)?.daily
  if (!d || d.length === 0) return 0
  return Math.round(d.reduce((s, x) => s + x.free, 0) / d.length)
})

// Procedencia — agregados para KPIs + chart de canales (PC-1.2.4/1.2.5)
const procTotalRevenue = computed(() =>
  (data.value as ProcedenciaReport | null)?.byChannel.reduce((s, c) => s + (c.revenue || 0), 0) ?? 0)
const procMaxChannelRevenue = computed(() =>
  Math.max(1, ...((data.value as ProcedenciaReport | null)?.byChannel.map(c => c.revenue || 0) ?? [1])))

function formatDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

onMounted(() => {
  computeRange()
  load()
})
</script>
