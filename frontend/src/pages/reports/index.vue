<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Reportes</h2>
        <p class="text-xs text-text-muted mt-0.5">Análisis de rendimiento del hotel</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select v-model="range" @change="onRangeChange" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
          <option value="thisMonth">Este mes</option>
          <option value="lastMonth">Mes pasado</option>
          <option value="thisQuarter">Este trimestre</option>
          <option value="thisYear">Este año</option>
          <option value="custom">Personalizado</option>
        </select>
        <template v-if="range === 'custom'">
          <input v-model="from" type="date" class="px-3 py-2 rounded-xl border border-border text-xs" @change="load" />
          <span class="text-text-muted text-xs">→</span>
          <input v-model="to" type="date" class="px-3 py-2 rounded-xl border border-border text-xs" @change="load" />
        </template>
        <button @click="exportCsv" :disabled="!data" class="flex items-center gap-1.5 px-3 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50">
          <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_DOWNLOAD"></span>
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 overflow-x-auto">
      <button v-for="(meta, key) in REPORT_META" :key="key" @click="changeTab(key as ReportType)"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2"
        :class="activeTab === key ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span class="w-4 h-4 shrink-0" v-html="TAB_ICON_MAP[meta.icon]"></span>
        <span>{{ meta.label }}</span>
      </button>
    </div>

    <p class="text-xs text-text-muted mb-4">{{ REPORT_META[activeTab].description }}</p>

    <!-- Loading -->
    <div v-if="loading" class="card p-12 text-center text-sm text-text-muted">Cargando reporte...</div>

    <!-- Facturación -->
    <div v-else-if="activeTab === 'facturacion' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Habitaciones" :value="formatMoney((data as FacturacionReport).roomRevenue)" :icon="ICON_BED" />
        <KpiCard label="Extras" :value="formatMoney((data as FacturacionReport).extrasRevenue)" :icon="ICON_TAG" />
        <KpiCard label="Impuestos" :value="formatMoney((data as FacturacionReport).taxes)" :icon="ICON_RECEIPT" />
        <KpiCard label="Comisiones OTA" :value="formatMoney((data as FacturacionReport).commissionOTA)" :icon="ICON_GLOBE" />
        <KpiCard label="Total bruto" :value="formatMoney((data as FacturacionReport).total)" class="text-navy" :icon="ICON_WALLET" />
        <KpiCard label="Neto" :value="formatMoney((data as FacturacionReport).net)" class="text-teal" :icon="ICON_TRENDING" icon-bg="bg-teal/10" icon-color="text-teal" />
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
        <KpiCard label="Hab. totales" :value="String((data as OcupacionReport).totalRooms)" :icon="ICON_BED" />
        <KpiCard label="Ocup. media real" :value="`${(data as OcupacionReport).avgRealOccupancy}%`" class="text-cyan" :icon="ICON_CHART" icon-bg="bg-cyan/10" icon-color="text-cyan" />
        <KpiCard label="Ocupadas/día" :value="String(ocupAvgOccupied)" :icon="ICON_CHECK" />
        <KpiCard label="Libres/día" :value="String(ocupAvgFree)" class="text-teal" :icon="ICON_DOOR" icon-bg="bg-teal/10" icon-color="text-teal" />
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
        <KpiCard label="Total paxes" :value="String((data as PernotacionesReport).totalPaxes)" :icon="ICON_USERS" />
        <KpiCard label="Adultos" :value="String((data as PernotacionesReport).totalAdults)" :icon="ICON_USERS" icon-bg="bg-cyan/10" icon-color="text-cyan" />
        <KpiCard label="Niños" :value="String((data as PernotacionesReport).totalChildren)" :icon="ICON_USERS" icon-bg="bg-gold/10" icon-color="text-gold" />
        <KpiCard label="Media/noche" :value="String((data as PernotacionesReport).avgPerNight)" :icon="ICON_CLOCK" />
      </div>
      <BarChart :data="series((data as PernotacionesReport).daily.map(d => ({ date: d.date, value: d.total })))" :format="String" :label="longRange ? 'Paxes por mes' : 'Paxes por noche'" />
    </div>

    <!-- Rendimiento -->
    <div v-else-if="activeTab === 'rendimiento' && data" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="ADR" :value="formatMoney((data as RendimientoReport).adr)" class="text-navy" :icon="ICON_WALLET" />
        <KpiCard label="RevPAR" :value="formatMoney((data as RendimientoReport).revpar)" class="text-cyan" :icon="ICON_TRENDING" icon-bg="bg-cyan/10" icon-color="text-cyan" />
        <KpiCard label="Ocupación" :value="`${(data as RendimientoReport).occupancyPct}%`" :icon="ICON_CHART" />
        <KpiCard label="Estancia media" :value="`${(data as RendimientoReport).avgStay} noches`" :icon="ICON_CLOCK" />
        <KpiCard label="Noches vendidas" :value="String((data as RendimientoReport).nightsSold)" :icon="ICON_BED" />
        <KpiCard label="Hab-disponibles" :value="String((data as RendimientoReport).availableRoomNights)" :icon="ICON_DOOR" />
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
        <KpiCard label="Países" :value="String((data as ProcedenciaReport).byCountry.length)" :icon="ICON_GLOBE" />
        <KpiCard label="Top país" :value="(data as ProcedenciaReport).byCountry[0]?.country || '—'" class="text-navy" :icon="ICON_PIN" />
        <KpiCard label="Canales" :value="String((data as ProcedenciaReport).byChannel.length)" :icon="ICON_SHARE" />
        <KpiCard label="Revenue total" :value="formatMoney(procTotalRevenue)" class="text-teal" :icon="ICON_WALLET" icon-bg="bg-teal/10" icon-color="text-teal" />
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
        <KpiCard label="Total" :value="String((data as ReservasReport).total)" :icon="ICON_CALENDAR" />
        <KpiCard label="OTA" :value="`${(data as ReservasReport).otaVsDirect.ota} (${(data as ReservasReport).otaVsDirect.otaPct}%)`" class="text-cyan" :icon="ICON_GLOBE" icon-bg="bg-cyan/10" icon-color="text-cyan" />
        <KpiCard label="Directas" :value="`${(data as ReservasReport).otaVsDirect.direct} (${(data as ReservasReport).otaVsDirect.directPct}%)`" class="text-teal" :icon="ICON_CHECK" icon-bg="bg-teal/10" icon-color="text-teal" />
        <KpiCard label="Canceladas" :value="`${(data as ReservasReport).cancelled} (${(data as ReservasReport).cancellationRate}%)`" class="text-coral" :icon="ICON_XCIRCLE" icon-bg="bg-coral/10" icon-color="text-coral" />
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

const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m5-2h4a1 1 0 0 1 1 1v2"/></svg>'
const ICON_TRENDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17.25 9 11.25l4 4 8-8M16.5 7.25H21v4.5"/></svg>'
const ICON_GLOBE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.25 0 4-4 4-9s-1.75-9-4-9-4 4-4 9 1.75 9 4 9ZM3.5 9h17M3.5 15h17"/></svg>'
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z"/></svg>'
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'
const ICON_TAG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.5 9.5a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182l-9.5-9.5A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75Z"/></svg>'
const ICON_RECEIPT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_DOOR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M5 21V5a1 1 0 0 1 .8-.98l9-1.8A1 1 0 0 1 16 3.2V21M5 21h11M5 21H3m13 0h5m-5 0V3.2M13 12h.01"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_PIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/></svg>'
const ICON_SHARE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"/></svg>'
const ICON_XCIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const TAB_ICON_MAP: Record<string, string> = {
  wallet: ICON_WALLET,
  chart: ICON_CHART,
  bed: ICON_BED,
  trending: ICON_TRENDING,
  globe: ICON_GLOBE,
  calendar: ICON_CALENDAR,
}

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
