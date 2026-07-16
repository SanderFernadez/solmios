<template>
  <div>
    <!-- Stats Principales -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div v-for="stat in mainStats" :key="stat.label" class="bg-white rounded-2xl border border-border card-shadow p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="text-2xl">{{ stat.icon }}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="stat.trend > 0 ? 'bg-teal/10 text-teal' : 'bg-red/10 text-red'">
            {{ stat.trend > 0 ? '+' : '' }}{{ stat.trend }}%
          </span>
        </div>
        <div class="text-2xl font-black text-navy">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase mt-1">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Fila 2 -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <!-- MRR Chart -->
      <div class="col-span-2 bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-navy">Ingresos Mensuales (MRR)</h3>
            <div class="flex gap-2">
              <button class="px-3 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer">6 meses</button>
              <button class="px-3 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-muted hover:bg-surface-dark cursor-pointer">12 meses</button>
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
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <h3 class="text-sm font-black text-navy">Distribución por Plan</h3>
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
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-navy">Top Hoteles por Ingresos</h3>
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
                <div class="text-sm font-black text-teal">${{ (hotel.mrr ?? 0).toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted">{{ hotel.plan }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PC-2.2: Consolidado por hotel (ocupación/ADR/revenue cross-hotel) -->
      <div v-if="(analytics as any)?.hotelsBreakdown?.length" class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <h3 class="text-sm font-black text-navy">Consolidado por hotel</h3>
        </div>
        <div class="p-4 overflow-x-auto">
          <table class="w-full text-xs">
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
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <h3 class="text-sm font-black text-navy">Actividad Reciente de la Plataforma</h3>
        </div>
        <div class="p-4">
          <div class="space-y-3">
            <div v-for="activity in recentActivity" :key="activity.id" class="flex items-start gap-3 p-3 bg-surface rounded-xl">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm" :class="activity.bgClass">
                {{ activity.icon }}
              </div>
              <div class="flex-1">
                <div class="text-sm font-bold text-navy">{{ activity.title }}</div>
                <div class="text-[10px] text-text-muted">{{ activity.description }}</div>
              </div>
              <div class="text-[10px] text-text-muted whitespace-nowrap">{{ activity.time }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fila 4 -->
    <div class="grid grid-cols-3 gap-6">
      <!-- Support Tickets -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-black text-navy">Tickets de Soporte</h3>
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

      <!-- System Health -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <h3 class="text-sm font-black text-navy">Salud del Sistema</h3>
        </div>
        <div class="p-5">
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm">Uptime</span>
                <span class="text-sm font-bold text-teal">99.9%</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full">
                <div class="h-2 bg-teal rounded-full" style="width: 99.9%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm">API Response</span>
                <span class="text-sm font-bold text-teal">142ms</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full">
                <div class="h-2 bg-cyan rounded-full" style="width: 85%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm">DB Performance</span>
                <span class="text-sm font-bold text-teal">OK</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full">
                <div class="h-2 bg-navy rounded-full" style="width: 92%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm">Storage</span>
                <span class="text-sm font-bold text-orange">67%</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full">
                <div class="h-2 bg-orange rounded-full" style="width: 67%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-5 border-b border-border">
          <h3 class="text-sm font-black text-navy">Acciones Rápidas</h3>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-2 gap-3">
            <button class="p-4 bg-surface rounded-xl text-center hover:bg-surface-dark transition-colors cursor-pointer group">
              <div class="text-2xl mb-2">🏨</div>
              <div class="text-[10px] font-bold text-navy group-hover:text-cyan transition-colors">Nuevo Hotel</div>
            </button>
            <button class="p-4 bg-surface rounded-xl text-center hover:bg-surface-dark transition-colors cursor-pointer group">
              <div class="text-2xl mb-2">💳</div>
              <div class="text-[10px] font-bold text-navy group-hover:text-cyan transition-colors">Crear Plan</div>
            </button>
            <button class="p-4 bg-surface rounded-xl text-center hover:bg-surface-dark transition-colors cursor-pointer group">
              <div class="text-2xl mb-2">📧</div>
              <div class="text-[10px] font-bold text-navy group-hover:text-cyan transition-colors">Enviar Newsletter</div>
            </button>
            <button class="p-4 bg-surface rounded-xl text-center hover:bg-surface-dark transition-colors cursor-pointer group">
              <div class="text-2xl mb-2">📊</div>
              <div class="text-[10px] font-bold text-navy group-hover:text-cyan transition-colors">Ver Reportes</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SuperAdminService } from '@/services/SuperAdmin.service'
import { PlatformService } from '@/services/Platform.service'
import { AuditLogService } from '@/services/AuditLog.service'

const analytics = ref<Awaited<ReturnType<typeof SuperAdminService.analytics>> | null>(null)

const mainStats = computed(() => {
  const a = analytics.value
  return [
    { icon: '🏨', label: 'Hoteles Activos', value: String(a?.activeHotels ?? a?.totalHoteles ?? 0), trend: 0 },
    { icon: '💰', label: 'MRR Total', value: `$${(a?.mrr ?? 0).toLocaleString()}`, trend: 0 },
    { icon: '👤', label: 'Usuarios Totales', value: String(a?.totalUsuarios ?? 0), trend: 0 },
    { icon: '📋', label: 'Reservas', value: String(a?.totalReservas ?? 0), trend: 0 },
    { icon: '🎯', label: 'Ocupación prom', value: `${a?.avgOccupancy ?? 0}%`, trend: 0 },
    { icon: '💵', label: 'ADR prom', value: `$${(a?.avgADR ?? 0).toLocaleString()}`, trend: 0 },
  ]
})

const revenueData = computed(() => (analytics.value as any)?.monthlyRevenue ?? [])

const maxRevenue = computed(() => Math.max(...revenueData.value.map((r: any) => r.value ?? 0), 1))
const totalRevenue = computed(() => revenueData.value.reduce((acc: number, r: any) => acc + (r.value ?? 0), 0))

const PLAN_META: Record<string, { color: string }> = {
  enterprise: { color: 'bg-navy' }, professional: { color: 'bg-cyan' },
  starter: { color: 'bg-teal' }, essential: { color: 'bg-teal' }, ultra: { color: 'bg-gold' },
}

const planDistribution = computed(() => {
  const byPlan = analytics.value?.byPlan ?? {}
  const total = Object.values(byPlan).reduce((s: number, n) => s + (n as number), 0) || 1
  return Object.entries(byPlan).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: count as number,
    color: PLAN_META[name.toLowerCase()]?.color ?? 'bg-cyan',
    barColor: PLAN_META[name.toLowerCase()]?.color ?? 'bg-cyan',
    percentage: Math.round(((count as number) / total) * 100),
    revenue: 0,
  }))
})

const totalHotels = computed(() => planDistribution.value.reduce((acc, p) => acc + p.count, 0))

const monitoring = ref<any>({})
const topHotels = ref<any[]>([])
const recentActivity = ref<any[]>([])

onMounted(async () => {
  try { analytics.value = await SuperAdminService.analytics() } catch { /* silent */ }
  try { monitoring.value = await PlatformService.monitoring() } catch { /* silent */ }
  try {
    const h = await SuperAdminService.hotels()
    const data = (h as any)?.data || (h as any)?.hotels || h || []
    topHotels.value = (Array.isArray(data) ? data : []).slice(0, 5)
  } catch { /* silent */ }
  try {
    const a = await AuditLogService.list()
    recentActivity.value = (a?.data || []).slice(0, 8)
  } catch { /* silent */ }
})
</script>
