<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 class="text-xl font-black text-navy">Analytics Platform</h1>
        <p class="text-sm text-text-muted">Métricas y rendimiento de la plataforma</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <select v-model="dateRange" class="h-10 px-4 bg-white border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-navy cursor-pointer">
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="12m">Último año</option>
        </select>
        <button @click="exportReport" class="h-10 px-4 bg-white border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-surface transition-colors cursor-pointer flex items-center gap-2">📥 Exportar</button>
      </div>
    </div>

    <!-- KPIs Principales -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div v-for="kpi in kpis" :key="kpi.label" class="bg-white rounded-xl p-4 border border-border card-shadow">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-text-muted uppercase">{{ kpi.label }}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" :class="kpi.change > 0 ? 'bg-teal/10 text-teal' : 'bg-red/10 text-red'">
            {{ kpi.change > 0 ? '+' : '' }}{{ kpi.change }}%
          </span>
        </div>
        <div class="text-2xl font-black" :class="kpi.color">{{ kpi.value }}</div>
        <div class="text-[9px] text-text-muted mt-1">{{ kpi.vs }}</div>
      </div>
    </div>

    <!-- Fila 1: Revenue Chart + MRR Breakdown -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <!-- Revenue Chart -->
      <SectionCard class="lg:col-span-2" title="Ingresos Mensuales" subtitle="MRR vs Ingresos Totales">
        <template #actions>
          <div class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-navy"></div><span class="text-[10px] text-white/70">MRR</span></div>
          <div class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-cyan"></div><span class="text-[10px] text-white/70">Total</span></div>
        </template>
        <div class="flex items-end gap-2 h-48">
          <div v-for="(month, i) in revenueData" :key="i" class="flex-1 flex flex-col items-center group cursor-pointer">
            <div class="text-[9px] font-bold text-navy mb-1 opacity-0 group-hover:opacity-100 transition-opacity">${{ month.total }}k</div>
            <div class="w-full flex gap-0.5 items-end" style="height: 100%">
              <div class="flex-1 bg-navy rounded-t-sm transition-all group-hover:opacity-80" :style="{ height: `${(month.mrr / maxRevenue) * 100}%` }"></div>
              <div class="flex-1 bg-cyan/40 rounded-t-sm transition-all group-hover:opacity-80" :style="{ height: `${(month.extra / maxRevenue) * 100}%` }"></div>
            </div>
            <div class="text-[9px] text-text-muted mt-2">{{ month.label }}</div>
          </div>
        </div>
      </SectionCard>

      <!-- MRR Breakdown -->
      <SectionCard title="Desglose MRR" :subtitle="`$${totalMRR.toLocaleString()}/mes`">
        <div class="space-y-4">
          <div v-for="plan in mrrBreakdown" :key="plan.name">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" :class="plan.color"></div>
                <span class="text-sm font-bold">{{ plan.name }}</span>
              </div>
              <span class="text-sm font-black text-navy">${{ plan.mrr }}</span>
            </div>
            <div class="w-full h-2 bg-surface rounded-full">
              <div class="h-2 rounded-full" :class="plan.color" :style="{ width: `${(plan.mrr / totalMRR) * 100}%` }"></div>
            </div>
            <div class="text-[9px] text-text-muted mt-1">{{ plan.hotels }} hoteles · ${{ plan.avg }}/promedio</div>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- Fila 2: Growth + Occupancy + Channels -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <!-- Hotel Growth -->
      <SectionCard title="Crecimiento de Hoteles" :subtitle="`+${growthData[growthData.length-1].value - growthData[0].value} este período`">
        <div class="flex items-end gap-1.5 h-36">
          <div v-for="(m, i) in growthData" :key="i" class="flex-1 flex flex-col items-center group cursor-pointer">
            <div class="text-[8px] font-bold text-navy mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{{ m.value }}</div>
            <div class="w-full bg-gradient-to-t from-teal to-cyan rounded-t-sm transition-all group-hover:opacity-80" :style="{ height: `${(m.value / maxGrowth) * 100}%` }"></div>
            <div class="text-[8px] text-text-muted mt-1.5">{{ m.label }}</div>
          </div>
        </div>
      </SectionCard>

      <!-- Occupancy Ranking -->
      <SectionCard title="Top Ocupación" :subtitle="`Promedio: ${avgOccupancy}%`">
        <div class="space-y-3">
          <div v-for="(hotel, i) in occupancyData" :key="hotel.name" class="flex items-center gap-3">
            <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" :class="i === 0 ? 'bg-gold/20 text-gold' : i === 1 ? 'bg-text-muted/20 text-text-muted' : i === 2 ? 'bg-orange/20 text-orange' : 'bg-surface text-text-muted'">{{ i + 1 }}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[11px] font-bold truncate">{{ hotel.name }}</span>
                <span class="text-[11px] font-black" :class="hotel.occupancy > 80 ? 'text-teal' : hotel.occupancy > 50 ? 'text-orange' : 'text-red'">{{ hotel.occupancy }}%</span>
              </div>
              <div class="w-full h-1.5 bg-surface rounded-full">
                <div class="h-1.5 rounded-full" :class="hotel.occupancy > 80 ? 'bg-teal' : hotel.occupancy > 50 ? 'bg-orange' : 'bg-red'" :style="{ width: `${hotel.occupancy}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Channel Performance -->
      <SectionCard title="Canales de Origen" :subtitle="`${channels.length} canales activos`">
        <div class="space-y-3">
          <div v-for="ch in channels" :key="ch.name" class="p-3 bg-surface rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ ch.icon }}</span>
                <span class="text-sm font-bold">{{ ch.name }}</span>
              </div>
              <span class="text-sm font-black text-navy">{{ ch.revenue }}%</span>
            </div>
            <div class="w-full h-1.5 bg-white rounded-full">
              <div class="h-1.5 rounded-full" :class="ch.color" :style="{ width: `${ch.revenue}%` }"></div>
            </div>
            <div class="text-[9px] text-text-muted mt-1.5">{{ ch.hotels }} hoteles · ${{ ch.sales.toLocaleString() }} ventas</div>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- Fila 3: Countries + Support + Top Hotels -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Countries -->
      <SectionCard title="Hoteles por País">
        <div class="space-y-3">
          <div v-for="country in countries" :key="country.name" class="flex items-center gap-3 p-3 bg-surface rounded-xl">
            <span class="text-2xl">{{ country.flag }}</span>
            <div class="flex-1">
              <div class="text-sm font-bold">{{ country.name }}</div>
              <div class="text-[9px] text-text-muted">{{ country.hotels }} hoteles · ${{ country.mrr.toLocaleString() }} MRR</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-navy">{{ country.hotels }}</div>
              <div class="w-16 h-1.5 bg-white rounded-full mt-1">
                <div class="h-1.5 rounded-full bg-navy" :style="{ width: `${(country.hotels / maxCountryHotels) * 100}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Support Metrics -->
      <SectionCard title="Métricas de Soporte">
        <div class="text-center p-4 bg-gradient-to-br from-teal/10 to-cyan/10 rounded-xl mb-4">
          <div class="text-4xl font-black text-teal">4.8</div>
          <div class="text-[10px] text-text-muted uppercase">Satisfacción Promedio</div>
          <div class="flex justify-center gap-0.5 mt-2">
            <span v-for="i in 5" :key="i" class="text-lg" :class="i <= 4 ? 'text-gold' : 'text-surface-dark'">★</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-center p-3 bg-surface rounded-xl">
            <div class="text-xl font-black text-navy">25min</div>
            <div class="text-[9px] text-text-muted">1ra Respuesta</div>
          </div>
          <div class="text-center p-3 bg-surface rounded-xl">
            <div class="text-xl font-black text-navy">4.2h</div>
            <div class="text-[9px] text-text-muted">Resolución</div>
          </div>
          <div class="text-center p-3 bg-surface rounded-xl">
            <div class="text-xl font-black text-teal">85%</div>
            <div class="text-[9px] text-text-muted">1er Contacto</div>
          </div>
          <div class="text-center p-3 bg-surface rounded-xl">
            <div class="text-xl font-black text-navy">47</div>
            <div class="text-[9px] text-text-muted">Tickets Mes</div>
          </div>
        </div>
      </SectionCard>

      <!-- Top Hotels by Revenue -->
      <SectionCard title="Top Hoteles por Ingreso">
        <div class="space-y-3">
          <div v-for="(hotel, i) in topHotels" :key="hotel.name" class="flex items-center gap-3 p-3 bg-surface rounded-xl">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-[10px] font-bold">{{ hotel.name[0] }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ hotel.name }}</div>
              <div class="text-[9px] text-text-muted">{{ hotel.plan }} · {{ hotel.rooms }} hab.</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-black text-navy">${{ hotel.mrr }}</div>
              <div class="text-[9px] text-text-muted">MRR</div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SectionCard from '@/components/ui/SectionCard.vue'

const dateRange = ref('30d')

const kpis = [
  { label: 'MRR Total', value: '$18,450', change: 12.5, vs: 'vs mes anterior $16,400', color: 'text-navy' },
  { label: 'Hoteles Activos', value: '20', change: 5.2, vs: 'vs mes anterior 19', color: 'text-teal' },
  { label: 'Ocupación Promedio', value: '76%', change: 3.1, vs: 'vs mes anterior 73%', color: 'text-cyan' },
  { label: 'Ticket Promedio', value: '$922', change: 8.4, vs: 'vs mes anterior $851', color: 'text-navy' },
  { label: 'Churn Rate', value: '2.1%', change: -0.5, vs: 'mejoró vs 2.6%', color: 'text-teal' },
  { label: 'NPS Score', value: '72', change: 4.3, vs: 'vs mes anterior 69', color: 'text-purple' }
]

const revenueData = [
  { label: 'Ene', mrr: 12, extra: 3, total: 15 },
  { label: 'Feb', mrr: 13, extra: 4, total: 17 },
  { label: 'Mar', mrr: 14, extra: 3, total: 17 },
  { label: 'Abr', mrr: 15, extra: 5, total: 20 },
  { label: 'May', mrr: 17, extra: 4, total: 21 },
  { label: 'Jun', mrr: 18, extra: 6, total: 24 }
]

const maxRevenue = computed(() => Math.max(...revenueData.map(r => r.total)))

const totalMRR = 18450

const mrrBreakdown = [
  { name: 'Enterprise', mrr: 9950, hotels: 5, avg: 199, color: 'bg-navy' },
  { name: 'Professional', mrr: 5940, hotels: 6, avg: 99, color: 'bg-cyan' },
  { name: 'Starter', mrr: 2560, hotels: 9, avg: 49, color: 'bg-teal' }
]

const growthData = [
  { label: 'Ene', value: 12 },
  { label: 'Feb', value: 14 },
  { label: 'Mar', value: 16 },
  { label: 'Abr', value: 18 },
  { label: 'May', value: 21 },
  { label: 'Jun', value: 24 }
]

const maxGrowth = computed(() => Math.max(...growthData.map(g => g.value)))

const occupancyData = [
  { name: 'Boutique Hotel Colonial', occupancy: 91 },
  { name: 'Hotel Caribe Paradise', occupancy: 87 },
  { name: 'Hotel Business Center', occupancy: 78 },
  { name: 'Gran Hotel Santo Domingo', occupancy: 72 },
  { name: 'Resort Playa Bonita', occupancy: 65 },
  { name: 'Eco Lodge Montaña', occupancy: 45 }
]

const avgOccupancy = computed(() => Math.round(occupancyData.reduce((a, b) => a + b.occupancy, 0) / occupancyData.length))

const channels = [
  { name: 'Booking.com', icon: '🟦', hotels: 22, revenue: 35, sales: 42000, color: 'bg-blue' },
  { name: 'Directo', icon: '🌐', hotels: 18, revenue: 28, sales: 33600, color: 'bg-navy' },
  { name: 'Expedia', icon: '🟡', hotels: 15, revenue: 22, sales: 26400, color: 'bg-gold' },
  { name: 'Airbnb', icon: '🩷', hotels: 12, revenue: 15, sales: 18000, color: 'bg-coral' }
]

const countries = [
  { name: 'República Dominicana', flag: '🇩🇴', hotels: 18, mrr: 14200 },
  { name: 'Colombia', flag: '🇨🇴', hotels: 3, mrr: 2400 },
  { name: 'México', flag: '🇲🇽', hotels: 2, mrr: 1600 },
  { name: 'Costa Rica', flag: '🇨🇷', hotels: 1, mrr: 250 }
]

const maxCountryHotels = computed(() => Math.max(...countries.map(c => c.hotels)))

const topHotels = [
  { name: 'Hotel Caribe Paradise', plan: 'Enterprise', rooms: 120, mrr: 199 },
  { name: 'Resort Playa Bonita', plan: 'Enterprise', rooms: 200, mrr: 199 },
  { name: 'Gran Hotel Santo Domingo', plan: 'Professional', rooms: 85, mrr: 99 },
  { name: 'Hotel Business Center', plan: 'Professional', rooms: 45, mrr: 99 },
  { name: 'Boutique Hotel Colonial', plan: 'Starter', rooms: 32, mrr: 49 }
]

const exportReport = () => {
  const data = {
    date: new Date().toISOString(),
    period: dateRange.value,
    kpis: kpis.map(k => ({ label: k.label, value: k.value, change: k.change })),
    mrr: totalMRR,
    hotels: 24,
    occupancy: avgOccupancy.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analytics-report-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
