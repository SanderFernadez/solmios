<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Night Audit</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-xs text-text-muted mt-0.5">Cierre operativo diario — verificación, cargos y reporte</p>
      </div>
      <div class="flex items-center gap-4">
        <button @click="viewLastReport" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Último Reporte</button>
        <button @click="startAudit" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLAY"></span>
          Iniciar Night Audit
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="view in views"
        :key="view.value"
        @click="activeView = view.value"
        class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
        :class="activeView === view.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
      >
        {{ view.label }}
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      <KpiHeroCard label="Hab. Ocupadas" :value="habOcupadas" icon="bed" accent="teal"
        :unit="totalRooms ? `de ${totalRooms} habitaciones` : 'Ocupadas esta noche'"
        :progress="ocupacionPct" />
      <KpiHeroCard label="Check-outs" :value="checkoutsCount" icon="checkout" accent="amber"
        unit="Salidas del día" />
      <KpiHeroCard label="Check-ins" :value="checkinsCount" icon="checkin" accent="blue"
        unit="Entradas del día" />
      <KpiHeroCard label="Ocupación" :value="ocupacionPct" icon="building" accent="purple"
        suffix="%" unit="Del inventario total" :progress="ocupacionPct" />
      <KpiHeroCard label="Ingresos Día" :value="ingresosDia" icon="money" accent="green"
        prefix="$" unit="Total facturado hoy" />
    </div>

    <!-- Progreso del Audit -->
    <SectionCard v-if="auditInProgress" class="mb-6"
      title="Night Audit en Progreso" subtitle="No cierres esta pestaña hasta terminar">
      <template #actions>
        <span class="rounded-full bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white tabular-nums">
          Paso {{ currentStep }}/{{ totalSteps }}
        </span>
      </template>

      <div class="w-full h-2 bg-surface rounded-full mb-4">
        <div class="h-2 bg-cyan rounded-full transition-all" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
      </div>
      <div class="space-y-3">
        <div v-for="(step, index) in auditSteps" :key="index" class="flex items-center gap-3">
          <span v-if="index < currentStep" class="w-6 h-6 rounded-full bg-teal flex items-center justify-center text-white p-1 shrink-0" v-html="ICON_CHECK"></span>
          <span v-else-if="index === currentStep" class="w-6 h-6 rounded-full bg-cyan flex items-center justify-center text-navy text-xs animate-pulse shrink-0">...</span>
          <span v-else class="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-text-muted text-xs shrink-0 tabular-nums">{{ index + 1 }}</span>
          <span class="text-sm" :class="index <= currentStep ? 'text-navy font-bold' : 'text-text-muted'">{{ step }}</span>
        </div>
      </div>
    </SectionCard>

    <!-- Resumen de Actividad -->
    <div v-if="activeView === 'activity'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Movimientos de Hoy -->
      <SectionCard title="Movimientos de Hoy"
        :subtitle="todayMovements.length ? `${todayMovements.length} movimiento(s)` : 'Entradas y salidas de la jornada'"
        body-class="p-0">
        <EmptyState v-if="todayMovements.length === 0"
          :icon="ICON_ACTIVITY"
          title="Sin movimientos registrados"
          message="Todavía no hay check-ins ni check-outs pendientes para hoy." />
        <div v-else class="divide-y divide-border px-4 sm:px-5">
          <div v-for="movement in todayMovements" :key="movement.id" class="flex items-center justify-between gap-3 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="movement.kind === 'checkin' ? 'bg-cyan/10' : 'bg-navy/10'">
                <span class="w-4 h-4" :class="movement.kind === 'checkin' ? 'text-cyan' : 'text-navy'" v-html="movement.kind === 'checkin' ? ICON_LOGIN : ICON_LOGOUT"></span>
              </div>
              <div class="min-w-0">
                <div class="text-sm font-bold text-navy truncate">{{ movement.description }}</div>
                <div v-if="movement.time" class="text-[10px] text-text-muted">{{ movement.time }}</div>
              </div>
            </div>
            <span class="text-sm font-bold text-right tabular-nums shrink-0" :class="movement.amount > 0 ? 'text-teal' : 'text-coral'">
              {{ movement.amount > 0 ? '+' : '' }}${{ Math.abs(movement.amount).toLocaleString() }}
            </span>
          </div>
        </div>
      </SectionCard>

      <!-- Habitaciones por Estado -->
      <SectionCard title="Estado de Habitaciones"
        :subtitle="totalRooms ? `${totalRooms} habitaciones en inventario` : 'Distribución actual'"
        body-class="p-0">
        <EmptyState v-if="roomStatuses.length === 0"
          :icon="ICON_BED"
          title="Sin datos de habitaciones"
          message="Cargá el inventario de habitaciones para ver la distribución por estado." />
        <div v-else class="divide-y divide-border px-4 sm:px-5">
          <div v-for="status in roomStatuses" :key="status.label" class="flex items-center justify-between gap-3 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" :class="status.dot"></span>
              <span class="text-sm text-navy truncate">{{ status.label }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span class="text-lg font-black text-navy tabular-nums">{{ status.count }}</span>
              <div class="w-24 h-2 bg-surface rounded-full">
                <div class="h-2 rounded-full" :class="status.bar" :style="{ width: `${totalRooms ? (status.count / totalRooms) * 100 : 0}%` }"></div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Alertas -->
      <SectionCard title="Alertas Pendientes"
        :subtitle="alerts.length ? `${alerts.length} alerta(s) por revisar` : 'Incidencias detectadas en el cierre'"
        body-class="p-0">
        <EmptyState v-if="alerts.length === 0"
          :icon="ICON_CHECK_CIRCLE"
          title="Sin alertas pendientes"
          message="No hay incidencias que bloqueen el cierre operativo." />
        <div v-else class="divide-y divide-border px-4 sm:px-5">
          <div v-for="alert in alerts" :key="alert.id" class="flex items-start gap-3 py-3">
            <span class="w-5 h-5 mt-0.5 shrink-0" :class="alert.type === 'warning' ? 'text-gold' : 'text-coral'" v-html="ICON_ALERT"></span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy">{{ alert.title }}</div>
              <div v-if="alert.description" class="text-[10px] text-text-muted">{{ alert.description }}</div>
            </div>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="alert.type === 'warning' ? 'bg-gold/10 text-gold' : 'bg-coral/10 text-coral'">
              {{ alert.type === 'warning' ? 'Advertencia' : 'Crítico' }}
            </span>
          </div>
        </div>
      </SectionCard>

      <!-- Resumen Financiero -->
      <SectionCard title="Resumen Financiero" subtitle="Ingresos e impuestos de la jornada" body-class="p-0">
        <div class="divide-y divide-border px-4 sm:px-5">
          <div class="flex justify-between items-center gap-3 py-2.5">
            <span class="text-sm text-text-secondary">Ingresos por Habitaciones</span>
            <span class="text-sm font-bold text-teal text-right tabular-nums">${{ ((auditData as any)?.ingresosHabitaciones ?? 0).toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center gap-3 py-2.5">
            <span class="text-sm text-text-secondary">Ingresos por Servicios</span>
            <span class="text-sm font-bold text-teal text-right tabular-nums">${{ ((auditData as any)?.ingresosServicios ?? 0).toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center gap-3 py-2.5">
            <span class="text-sm text-text-secondary">Impuestos (ITBIS)</span>
            <span class="text-sm font-bold text-coral text-right tabular-nums">${{ ((auditData as any)?.impuestos ?? 0).toLocaleString() }}</span>
          </div>
          <div class="flex justify-between items-center gap-3 py-3">
            <span class="text-sm font-extrabold text-navy">Total del Día</span>
            <span class="text-lg font-black text-navy text-right tabular-nums">${{ ((auditData as any)?.totalDia ?? 0).toLocaleString() }}</span>
          </div>
        </div>
      </SectionCard>
    </div>

    <!-- Último Reporte -->
    <SectionCard v-if="activeView === 'report'"
      title="Reporte Night Audit" :subtitle="reportSubtitle" body-class="p-0">
      <template #actions>
        <button class="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 transition-colors cursor-pointer">
          Imprimir
        </button>
        <button class="flex items-center gap-1.5 rounded-full bg-cyan text-navy text-sm font-extrabold px-5 py-2 hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_MAIL"></span>
          Enviar
        </button>
      </template>

      <div class="p-4 sm:p-6">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-border">
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">Noches Vendidas</div>
            <div class="text-2xl font-black text-navy tabular-nums">{{ (auditData as any)?.nochesVendidas ?? 0 }}</div>
            <div class="text-[10px] text-teal font-bold mt-1 tabular-nums">{{ (auditData as any)?.ocupacion ?? 0 }}% ocupación</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">ADR (Tarifa Promedio)</div>
            <div class="text-2xl font-black text-navy tabular-nums">${{ ((auditData as any)?.adr ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-teal font-bold mt-1 tabular-nums">{{ ((auditData as any)?.adr ?? 0) > ((auditData as any)?.adrAyer ?? 0) ? '▲' : '▼' }}${{ Math.abs(((auditData as any)?.adr ?? 0) - ((auditData as any)?.adrAyer ?? 0)).toLocaleString() }} vs ayer</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">RevPAR</div>
            <div class="text-2xl font-black text-navy tabular-nums">${{ ((auditData as any)?.revpar ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted mt-1">Ingreso por habitación disponible</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
          <div>
            <h4 class="text-sm font-black text-navy mb-3">Resumen de Check-ins</h4>
            <div class="divide-y divide-border">
              <div class="flex justify-between gap-3 text-sm py-2 first:pt-0">
                <span class="text-text-secondary">Check-ins realizados</span>
                <span class="font-bold text-navy text-right tabular-nums">{{ (auditData as any)?.checkins ?? 0 }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2">
                <span class="text-text-secondary">Check-outs realizados</span>
                <span class="font-bold text-navy text-right tabular-nums">{{ (auditData as any)?.checkouts ?? 0 }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2">
                <span class="text-text-secondary">No-shows</span>
                <span class="font-bold text-coral text-right tabular-nums">{{ (auditData as any)?.noShows ?? 0 }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2 last:pb-0">
                <span class="text-text-secondary">Cancelaciones</span>
                <span class="font-bold text-gold text-right tabular-nums">{{ (auditData as any)?.cancelaciones ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-black text-navy mb-3">Resumen de Pagos</h4>
            <div class="divide-y divide-border">
              <div class="flex justify-between gap-3 text-sm py-2 first:pt-0">
                <span class="text-text-secondary">Pagos recibidos</span>
                <span class="font-bold text-teal text-right tabular-nums">${{ ((auditData as any)?.pagosRecibidos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2">
                <span class="text-text-secondary">Pagos pendientes</span>
                <span class="font-bold text-gold text-right tabular-nums">${{ ((auditData as any)?.pagosPendientes ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2">
                <span class="text-text-secondary">Depósitos de seguridad</span>
                <span class="font-bold text-navy text-right tabular-nums">${{ ((auditData as any)?.depositos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between gap-3 text-sm py-2 last:pb-0">
                <span class="text-text-secondary">Reembolsos</span>
                <span class="font-bold text-coral text-right tabular-nums">${{ ((auditData as any)?.reembolsos ?? 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useToast } from '@/composables/useToast'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const ICON_PLAY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M5 3.87v16.26a1 1 0 0 0 1.53.85l13.14-8.13a1 1 0 0 0 0-1.7L6.53 3.02A1 1 0 0 0 5 3.87Z"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75Zm0 0 9.75 6.75 9.75-6.75"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_LOGIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V4.5A1.5 1.5 0 0 1 10.5 3h6A1.5 1.5 0 0 1 18 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 9 19.5v-2.25M12 12h9m0 0-3-3m3 3-3 3"/></svg>'
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6.75V4.5A1.5 1.5 0 0 0 13.5 3h-6A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h6a1.5 1.5 0 0 0 1.5-1.5v-2.25M21 12h-9m0 0 3-3m-3 3 3 3"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m5-2h4a1 1 0 0 1 1 1v2"/></svg>'
const ICON_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 1.5 1.5 3.75-3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_ACTIVITY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h4l3 8 4-16 3 8h4"/></svg>'

const STATUS_META: Record<string, { label: string; dot: string; bar: string }> = {
  available: { label: 'Disponibles', dot: 'bg-teal', bar: 'bg-teal' },
  disponible: { label: 'Disponibles', dot: 'bg-teal', bar: 'bg-teal' },
  occupied: { label: 'Ocupadas', dot: 'bg-coral', bar: 'bg-coral' },
  ocupada: { label: 'Ocupadas', dot: 'bg-coral', bar: 'bg-coral' },
  cleaning: { label: 'Limpieza', dot: 'bg-cyan', bar: 'bg-cyan' },
  dirty: { label: 'Limpieza', dot: 'bg-cyan', bar: 'bg-cyan' },
  limpieza: { label: 'Limpieza', dot: 'bg-cyan', bar: 'bg-cyan' },
  'en limpieza': { label: 'Limpieza', dot: 'bg-cyan', bar: 'bg-cyan' },
  maintenance: { label: 'Mantenimiento', dot: 'bg-gold', bar: 'bg-gold' },
  mantenimiento: { label: 'Mantenimiento', dot: 'bg-gold', bar: 'bg-gold' },
  out_of_order: { label: 'Mantenimiento', dot: 'bg-gold', bar: 'bg-gold' },
  out_of_service: { label: 'Mantenimiento', dot: 'bg-gold', bar: 'bg-gold' },
  'fuera de servicio': { label: 'Mantenimiento', dot: 'bg-gold', bar: 'bg-gold' },
  reserved: { label: 'Reservadas', dot: 'bg-navy', bar: 'bg-navy' },
  pending: { label: 'Pendientes', dot: 'bg-gold', bar: 'bg-gold' },
  pendiente: { label: 'Pendientes', dot: 'bg-gold', bar: 'bg-gold' },
}

const auth = useAuthStore()
const dashboard = useDashboardStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeView = ref('activity')
const auditInProgress = ref(false)
const currentStep = ref(0)
const totalSteps = 8
const auditResult = ref<any>(null)

const views = [
  { label: 'Actividad', value: 'activity' },
  { label: 'Reporte', value: 'report' }
]

const auditData = ref<Awaited<ReturnType<typeof OperationsService.nightAudit>> | null>(null)

const habOcupadas = computed(() => (auditData.value as any)?.habitacionesOcupadas ?? 0)
const checkoutsCount = computed(() => (auditData.value as any)?.checkouts ?? 0)
const checkinsCount = computed(() => (auditData.value as any)?.checkins ?? 0)
const ocupacionPct = computed(() => (auditData.value as any)?.ocupacion ?? 0)
const ingresosDia = computed(() => (auditData.value as any)?.totalDia ?? 0)

// Los KPI los anima KpiHeroCard internamente (useCountUp propio) — no envolver acá.

const reportSubtitle = computed(() => {
  const fecha = (auditData.value as any)?.fecha
  return fecha ? `${fecha} — Generado ahora` : 'Generado ahora'
})

const auditSteps = [
  'Verificar disponibilidad de habitaciones',
  'Procesar check-outs pendientes',
  'Actualizar tarifas nocturnas',
  'Calcular impuestos del día',
  'Generar reporte de ingresos',
  'Verificar pagos pendientes',
  'Actualizar estados de habitaciones',
  'Generar reporte final'
]

const todayMovements = computed(() => {
  const d = auditData.value as any
  const movs: any[] = []
  for (const a of d?.arrivosPendientes ?? []) movs.push({ id: a.id, kind: 'checkin', description: `Check-in Hab ${a.roomNumber ?? ''} — ${a.guestName ?? ''}`, time: '', amount: a.totalAmount ?? 0 })
  for (const s of d?.salidasPendientes ?? []) movs.push({ id: s.id, kind: 'checkout', description: `Check-out Hab ${s.roomNumber ?? ''}`, time: '', amount: -(s.totalAmount ?? 0) })
  return movs
})

// Estado de habitaciones — derivado del mismo store que alimenta el widget "Ocupación Hoy" del sidebar.
const roomStatuses = computed(() => {
  return Object.entries(dashboard.stats.roomsByStatus || {}).map(([key, count]) => {
    const meta = STATUS_META[key]
    return { label: meta?.label ?? key, count: count as number, dot: meta?.dot ?? 'bg-navy/30', bar: meta?.bar ?? 'bg-navy/30' }
  })
})
const totalRooms = computed(() => (auditData.value as any)?.habitacionesTotales ?? 0)
// Sin fuente de datos de alertas en el backend todavía — se deja vacío en vez de fabricar alertas falsas.
const alerts = ref<any[]>([])

onMounted(() => {
  loadData()
  dashboard.fetchStats(hotelId.value)
})

async function loadData() {
  try {
    auditData.value = await OperationsService.nightAudit(hotelId.value)
  } catch { toast.error('Error al cargar datos del night audit') }
}

const startAudit = async () => {
  auditInProgress.value = true
  currentStep.value = 0
  try {
    for (let i = 0; i < totalSteps; i++) {
      currentStep.value = i
      await new Promise(r => setTimeout(r, 800))
    }
    const result = await OperationsService.nightAuditRun(hotelId.value)
    auditResult.value = result
    currentStep.value = totalSteps
    toast.success(`Night audit completado — ${result.posted ?? 0} habitaciones procesadas`)
    await loadData()
  } catch {
    toast.error('Error al ejecutar night audit')
  } finally {
    auditInProgress.value = false
    activeView.value = 'report'
  }
}

const viewLastReport = () => {
  activeView.value = 'report'
}
</script>

<style scoped></style>
