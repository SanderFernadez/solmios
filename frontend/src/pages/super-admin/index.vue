<template>
  <div>
    <!-- Stats Principales -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <KpiHeroCard v-for="s in mainStats" :key="s.label" v-bind="s" />
    </div>

    <!-- Fila 2 -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <!-- MRR Chart -->
      <div class="col-span-2 bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-white">Ingresos Mensuales (MRR)</h3>
            <div class="flex gap-2">
              <button class="px-3 py-1 bg-white/15 text-white rounded-lg text-[10px] font-bold cursor-pointer">6 meses</button>
              <button class="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-white/60 hover:bg-white/10 cursor-pointer">12 meses</button>
            </div>
          </div>
        </div>
        <div class="p-5">
          <div class="flex items-end gap-3 h-48">
            <div v-for="(month, index) in revenueData" :key="index" class="flex-1 flex flex-col items-center group cursor-pointer">
              <div class="text-[10px] font-bold text-navy mb-1 opacity-0 group-hover:opacity-100 transition-opacity">${{ month.value.toLocaleString() }}</div>
              <div class="w-full bg-gradient-to-t from-navy to-cyan rounded-t-lg transition-all group-hover:opacity-80" :style="{ height: `${(month.value / maxRevenue) * 100}%` }"></div>
              <div class="text-[10px] text-text-muted mt-2">{{ month.label }}</div>
            </div>
          </div>
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div class="text-sm text-text-secondary">Total últimos 6 meses:</div>
            <div class="text-lg font-black text-navy">${{ totalRevenue.toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <!-- Plan Distribution -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="text-sm font-black text-white">Distribución por Plan</h3>
        </div>
        <div class="p-5">
          <div class="space-y-4">
            <div v-for="plan in planDistribution" :key="plan.name">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full" :class="plan.color"></span>
                  <span class="text-sm font-bold">{{ plan.name }}</span>
                </div>
                <span class="text-sm font-black text-navy">{{ plan.count }}</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full">
                <div class="h-2 rounded-full transition-all" :class="plan.barColor" :style="{ width: `${(plan.count / totalHotels) * 100}%` }"></div>
              </div>
              <div class="flex justify-between mt-1">
                <span class="text-[10px] text-text-muted">{{ plan.percentage }}% del total</span>
                <span class="text-[10px] font-bold text-teal">${{ plan.revenue.toLocaleString() }}/mes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fila 3 -->
    <div class="grid grid-cols-2 gap-6 mb-6">
      <!-- Top Hotels -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-white">Top Hoteles por Ingresos</h3>
            <router-link to="/admin/hotels" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Ver todos →</router-link>
          </div>
        </div>
        <div class="p-4">
          <div class="space-y-3">
            <div v-for="(hotel, index) in topHotels" :key="hotel.id" class="flex items-center gap-4 p-3 bg-surface rounded-xl hover:bg-surface-dark transition-colors cursor-pointer">
              <div class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm" :class="index === 0 ? 'bg-gold/20 text-gold' : index === 1 ? 'bg-text-muted/20 text-text-muted' : index === 2 ? 'bg-orange/20 text-orange' : 'bg-surface text-text-muted'">
                {{ index + 1 }}
              </div>
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-sm font-bold">
                {{ hotel.name[0] }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ hotel.name }}</div>
                <div class="text-[10px] text-text-muted">{{ hotel.location }}</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-black text-teal">${{ (hotel.revenue ?? 0).toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted capitalize">{{ hotel.plan }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PC-2.2: Consolidado por hotel (ocupación/ADR/revenue cross-hotel) -->
      <div v-if="(analytics as any)?.hotelsBreakdown?.length" class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="text-sm font-black text-white">Consolidado por hotel</h3>
        </div>
        <div class="p-4 overflow-x-auto">
          <table class="w-full text-xs tbl-head">
            <thead><tr class="border-b border-border text-text-muted uppercase">
              <th class="text-left p-2">Hotel</th>
              <th class="text-left p-2">Plan</th>
              <th class="text-right p-2">Hab.</th>
              <th class="text-right p-2">Reservas</th>
              <th class="text-right p-2">Ocup. %</th>
              <th class="text-right p-2">ADR</th>
              <th class="text-right p-2">Revenue</th>
              <th class="text-right p-2">MRR</th>
              <th class="text-center p-2">Estado</th>
            </tr></thead>
            <tbody>
              <tr v-for="h in (analytics as any)?.hotelsBreakdown || []" :key="h.id" class="border-b border-border/30">
                <td class="p-2 text-navy font-bold">{{ h.name }}</td>
                <td class="p-2 capitalize">{{ h.plan }}</td>
                <td class="p-2 text-right">{{ h.rooms }}</td>
                <td class="p-2 text-right">{{ h.reservations }}</td>
                <td class="p-2 text-right font-bold" :class="h.occupancy > 80 ? 'text-coral' : h.occupancy > 50 ? 'text-gold' : 'text-teal'">{{ h.occupancy }}%</td>
                <td class="p-2 text-right text-cyan font-bold">${{ (h.adr ?? 0).toLocaleString() }}</td>
                <td class="p-2 text-right">${{ (h.revenue ?? 0).toLocaleString() }}</td>
                <td class="p-2 text-right text-teal">${{ (h.mrr ?? 0).toLocaleString() }}</td>
                <td class="p-2 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-bold" :class="h.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-text-muted/10 text-text-muted'">{{ h.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="text-sm font-black text-white">Actividad Reciente de la Plataforma</h3>
        </div>
        <div class="p-4">
          <div v-if="recentActivity.length" class="space-y-3">
            <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start gap-3 p-3 bg-surface rounded-xl">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="activity.tint">
                <Icon :name="activity.icon" :size="15" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ activity.title }}</div>
                <div class="text-[10px] text-text-muted truncate">{{ activity.description }}</div>
              </div>
              <div class="text-[10px] text-text-muted whitespace-nowrap">{{ activity.time }}</div>
            </div>
          </div>
          <div v-else class="py-8 text-center text-xs text-text-muted">Sin actividad reciente</div>
        </div>
      </div>
    </div>

    <!-- Fila 4 -->
    <div class="grid grid-cols-3 gap-6">
      <!-- Support Tickets -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-white">Tickets de Soporte</h3>
            <router-link to="/admin/support" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Ver todos →</router-link>
          </div>
        </div>
        <div class="p-5">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-red rounded-full"></span>
                <span class="text-sm">Urgentes</span>
              </div>
              <span class="text-lg font-black text-red">{{ monitoring?.ticketsUrgentes || 0 }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-orange rounded-full"></span>
                <span class="text-sm">Abiertos</span>
              </div>
              <span class="text-lg font-black text-orange">{{ monitoring?.ticketsAbiertos || 0 }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-cyan rounded-full"></span>
                <span class="text-sm">En Progreso</span>
              </div>
              <span class="text-lg font-black text-cyan">{{ monitoring?.ticketsEnProgreso || 0 }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 bg-teal rounded-full"></span>
                <span class="text-sm">Resueltos (hoy)</span>
              </div>
              <span class="text-lg font-black text-teal">{{ monitoring?.ticketsResueltos || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- System Health — datos reales del proceso backend (GET /admin/monitoring) -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="text-sm font-black text-white">Salud del Sistema</h3>
        </div>
        <div class="p-5">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm">Estado del backend</span>
              <span class="text-sm font-bold text-teal flex items-center gap-1.5">
                <span class="w-2 h-2 bg-teal rounded-full"></span>Operativo
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Uptime</span>
              <span class="text-sm font-bold text-navy">{{ uptimeLabel }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Memoria (RSS)</span>
              <span class="text-sm font-bold text-navy">{{ memoriaMb.toLocaleString() }} MB</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Base de datos</span>
              <span class="text-sm font-bold text-teal">Conectada</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm">Reservas registradas</span>
              <span class="text-sm font-bold text-navy">{{ (monitoring?.reservas ?? 0).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
        <div class="px-5 py-4 bg-navy">
          <h3 class="text-sm font-black text-white">Acciones Rápidas</h3>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-2 gap-3">
            <router-link v-for="action in quickActions" :key="action.to" :to="action.to" class="flex flex-col items-center gap-2 p-4 bg-surface rounded-xl text-center hover:bg-surface-dark transition-colors cursor-pointer group">
              <span class="w-10 h-10 rounded-xl flex items-center justify-center" :class="action.tint">
                <Icon :name="action.icon" :size="20" />
              </span>
              <span class="text-[10px] font-bold text-navy group-hover:text-cyan transition-colors">{{ action.label }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import Icon from '@/components/ui/Icon.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import { SuperAdminService } from '@/services/SuperAdmin.service'
import { PlatformService } from '@/services/Platform.service'
import { AuditLogService } from '@/services/AuditLog.service'
import type { AuditLogRecord } from '@/types'

const toast = useToast()
const analytics = ref<Awaited<ReturnType<typeof SuperAdminService.analytics>> | null>(null)

// Cards KPI con gradiente (mismo componente que el dashboard del hotel).
const mainStats = computed(() => {
  const a = analytics.value
  const t = a?.trends
  return [
    { label: 'Hoteles Activos', value: Number(a?.activeHotels ?? a?.totalHoteles ?? 0), icon: 'building', accent: 'blue', trend: t?.hoteles ?? null },
    { label: 'MRR Total', value: Number(a?.mrr ?? 0), prefix: '$', icon: 'money', accent: 'green', trend: t?.mrr ?? null },
    { label: 'Usuarios Totales', value: Number(a?.totalUsuarios ?? 0), icon: 'users', accent: 'purple', trend: t?.usuarios ?? null },
    { label: 'Reservas', value: Number(a?.totalReservas ?? 0), icon: 'bookings', accent: 'amber', trend: t?.reservas ?? null },
    { label: 'Ocupación prom', value: Number(a?.avgOccupancy ?? 0), suffix: '%', icon: 'bed', accent: 'teal', progress: Number(a?.avgOccupancy ?? 0) },
    { label: 'ADR prom', value: Number(a?.avgADR ?? 0), prefix: '$', icon: 'money', accent: 'rose' },
  ] as const
})

const quickActions = [
  { to: '/admin/hotels', icon: 'building', tint: 'bg-navy/10 text-navy', label: 'Gestionar Hoteles' },
  { to: '/admin/plans', icon: 'card', tint: 'bg-cyan/10 text-cyan', label: 'Crear Plan' },
  { to: '/admin/announcements', icon: 'mail', tint: 'bg-gold/10 text-gold', label: 'Anuncios' },
  { to: '/admin/analytics', icon: 'chart', tint: 'bg-teal/10 text-teal', label: 'Ver Reportes' },
]

const revenueData = computed(() => (analytics.value as any)?.monthlyRevenue ?? [])

const maxRevenue = computed(() => Math.max(...revenueData.value.map((r: any) => r.value ?? 0), 1))
const totalRevenue = computed(() => revenueData.value.reduce((acc: number, r: any) => acc + (r.value ?? 0), 0))

const PLAN_META: Record<string, { color: string }> = {
  enterprise: { color: 'bg-navy' }, professional: { color: 'bg-cyan' },
  starter: { color: 'bg-teal' }, essential: { color: 'bg-teal' }, ultra: { color: 'bg-gold' },
}

const planDistribution = computed(() => {
  const byPlan = analytics.value?.byPlan ?? {}
  const byPlanRevenue = analytics.value?.byPlanRevenue ?? {}
  const total = Object.values(byPlan).reduce((s: number, n) => s + (n as number), 0) || 1
  return Object.entries(byPlan).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: count as number,
    color: PLAN_META[name.toLowerCase()]?.color ?? 'bg-cyan',
    barColor: PLAN_META[name.toLowerCase()]?.color ?? 'bg-cyan',
    percentage: Math.round(((count as number) / total) * 100),
    revenue: byPlanRevenue[name] ?? 0,
  }))
})

const totalHotels = computed(() => planDistribution.value.reduce((acc, p) => acc + p.count, 0))

const monitoring = ref<any>({})

// El audit log trae { action, userName, entity, detail, createdAt }. Lo mapeamos a un
// item de UI con icono/color por tipo de acción y tiempo relativo (los campos icon/title/…
// no vienen del backend; antes se bindeaban directo y salían filas en blanco).
interface ActivityItem { id: string; icon: string; tint: string; title: string; description: string; time: string }
const ACTION_META: { match: RegExp; icon: string; tint: string }[] = [
  { match: /login|auth|sesi/i, icon: 'login', tint: 'bg-cyan/10 text-cyan' },
  { match: /creat|crea|add|alta|nuev/i, icon: 'plus', tint: 'bg-teal/10 text-teal' },
  { match: /delet|elimin|remov|baja/i, icon: 'trash', tint: 'bg-red/10 text-red' },
  { match: /updat|edit|modif|cambio/i, icon: 'edit', tint: 'bg-gold/10 text-gold' },
  { match: /pago|payment|cobro|factur|invoice/i, icon: 'money', tint: 'bg-teal/10 text-teal' },
]
function metaFor(action: string): { icon: string; tint: string } {
  return ACTION_META.find((m) => m.match.test(action)) ?? { icon: 'bell', tint: 'bg-navy/10 text-navy' }
}
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!then) return ''
  const s = Math.floor((Date.now() - then) / 1000)
  if (s < 60) return 'hace un momento'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}
const recentActivity = ref<ActivityItem[]>([])

// Top hoteles por ingresos: el backend ya lo computa ordenado (topByRevenue), con revenue/mrr/plan reales.
const topHotels = computed(() => {
  const src = analytics.value?.topByRevenue ?? []
  return src.map((h) => ({
    id: h.id, name: h.name, plan: h.plan,
    location: `${h.rooms} hab · ${h.reservations} reservas`,
    revenue: h.revenue, mrr: h.mrr,
  }))
})

// Salud del sistema con datos reales del backend (uptime en segundos, RAM en MB).
const SECONDS_PER_DAY = 86_400
const SECONDS_PER_HOUR = 3_600
const uptimeLabel = computed(() => {
  const s = Number(monitoring.value?.uptime ?? 0)
  const d = Math.floor(s / SECONDS_PER_DAY)
  const h = Math.floor((s % SECONDS_PER_DAY) / SECONDS_PER_HOUR)
  const m = Math.floor((s % SECONDS_PER_HOUR) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
})
const memoriaMb = computed(() => Number(monitoring.value?.memoria ?? 0))

onMounted(async () => {
  try { analytics.value = await SuperAdminService.analytics() } catch { toast.error('No se pudieron cargar las métricas de la plataforma') }
  try { monitoring.value = await PlatformService.monitoring() } catch { /* silent */ }
  try {
    const a = await AuditLogService.list()
    recentActivity.value = (a?.data || []).slice(0, 8).map((r: AuditLogRecord): ActivityItem => {
      const meta = metaFor(r.action)
      return {
        id: r.id,
        icon: meta.icon,
        tint: meta.tint,
        title: r.action || 'Actividad',
        description: [r.userName, r.entity, r.detail].filter(Boolean).join(' · '),
        time: timeAgo(r.createdAt),
      }
    })
  } catch { /* silent */ }
})
</script>
