<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Night Audit</h2>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex gap-2">
        <button
          v-for="view in views"
          :key="view.value"
          @click="activeView = view.value"
          class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
          :class="activeView === view.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
        >
          {{ view.label }}
        </button>
      </div>
      <div class="flex gap-2">
        <button @click="startAudit" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          ▶ Iniciar Night Audit
        </button>
        <button @click="viewLastReport" class="bg-white text-text-secondary border border-border font-bold text-sm px-5 py-2.5 rounded-xl hover:border-navy/30 transition-all cursor-pointer">
          📄 Último Reporte
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-5 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
        <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Progreso del Audit -->
    <div v-if="auditInProgress" class="bg-white rounded-2xl border border-border card-shadow p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-black text-navy">Night Audit en Progreso</h3>
        <span class="text-[10px] font-bold px-3 py-1 rounded-full bg-cyan/10 text-cyan">Paso {{ currentStep }}/{{ totalSteps }}</span>
      </div>
      <div class="w-full h-2 bg-surface rounded-full mb-4">
        <div class="h-2 bg-cyan rounded-full transition-all" :style="{ width: `${(currentStep / totalSteps) * 100}%` }"></div>
      </div>
      <div class="space-y-3">
        <div v-for="(step, index) in auditSteps" :key="index" class="flex items-center gap-3">
          <span v-if="index < currentStep" class="w-6 h-6 rounded-full bg-teal flex items-center justify-center text-white text-xs">✓</span>
          <span v-else-if="index === currentStep" class="w-6 h-6 rounded-full bg-cyan flex items-center justify-center text-navy text-xs animate-pulse">...</span>
          <span v-else class="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-text-muted text-xs">{{ index + 1 }}</span>
          <span class="text-sm" :class="index <= currentStep ? 'text-navy font-bold' : 'text-text-muted'">{{ step }}</span>
        </div>
      </div>
    </div>

    <!-- Resumen de Actividad -->
    <div v-if="activeView === 'activity'" class="grid grid-cols-2 gap-6">
      <!-- Movimientos de Hoy -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border">
          <h3 class="text-sm font-black text-navy">Movimientos de Hoy</h3>
        </div>
        <div class="p-4">
          <div class="space-y-3">
            <div v-for="movement in todayMovements" :key="movement.id" class="flex items-center justify-between p-3 bg-surface rounded-xl">
              <div class="flex items-center gap-3">
                <span class="text-lg">{{ movement.icon }}</span>
                <div>
                  <div class="text-sm font-bold text-navy">{{ movement.description }}</div>
                  <div class="text-[10px] text-text-muted">{{ movement.time }}</div>
                </div>
              </div>
              <span class="text-sm font-bold" :class="movement.amount > 0 ? 'text-teal' : 'text-coral'">
                {{ movement.amount > 0 ? '+' : '' }}${{ Math.abs(movement.amount) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Habitaciones por Estado -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border">
          <h3 class="text-sm font-black text-navy">Estado de Habitaciones</h3>
        </div>
        <div class="p-4">
          <div class="space-y-3">
            <div v-for="status in roomStatuses" :key="status.label" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full" :class="status.color"></span>
                <span class="text-sm">{{ status.label }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-lg font-black text-navy">{{ status.count }}</span>
                <div class="w-24 h-2 bg-surface rounded-full">
                  <div class="h-2 rounded-full" :class="status.barColor" :style="{ width: `${(status.count / totalRooms) * 100}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alertas -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border">
          <h3 class="text-sm font-black text-navy">Alertas Pendientes</h3>
        </div>
        <div class="p-4">
          <div class="space-y-3">
            <div v-for="alert in alerts" :key="alert.id" class="flex items-start gap-3 p-3 bg-surface rounded-xl">
              <span class="text-lg mt-0.5">{{ alert.icon }}</span>
              <div class="flex-1">
                <div class="text-sm font-bold text-navy">{{ alert.title }}</div>
                <div class="text-[10px] text-text-muted">{{ alert.description }}</div>
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="alert.type === 'warning' ? 'bg-orange/10 text-orange' : 'bg-red/10 text-red'">
                {{ alert.type === 'warning' ? 'Advertencia' : 'Crítico' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen Financiero -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border">
          <h3 class="text-sm font-black text-navy">Resumen Financiero</h3>
        </div>
        <div class="p-4">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Ingresos por Habitaciones</span>
              <span class="text-sm font-bold text-teal">\${{ ((auditData as any)?.ingresosHabitaciones ?? 0).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Ingresos por Servicios</span>
              <span class="text-sm font-bold text-teal">\${{ ((auditData as any)?.ingresosServicios ?? 0).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Impuestos (ITBIS)</span>
              <span class="text-sm font-bold text-coral">\${{ ((auditData as any)?.impuestos ?? 0).toLocaleString() }}</span>
            </div>
            <div class="border-t border-border pt-3">
              <div class="flex justify-between items-center">
                <span class="text-sm font-bold text-navy">Total del Día</span>
                <span class="text-lg font-black text-navy">\${{ ((auditData as any)?.totalDia ?? 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Último Reporte -->
    <div v-if="activeView === 'report'" class="bg-white rounded-2xl border border-border card-shadow">
      <div class="p-6 border-b border-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-black text-navy">Reporte Night Audit</h3>
            <div class="text-sm text-text-muted">{{ (auditData as any)?.fecha || '—' }} — Generado ahora</div>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 bg-surface rounded-lg text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">🖨 Imprimir</button>
            <button class="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold hover:shadow-lg transition-colors cursor-pointer">📧 Enviar</button>
          </div>
        </div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-3 gap-6 mb-6">
          <div class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Noches Vendidas</div>
            <div class="text-2xl font-black text-navy">{{ (auditData as any)?.nochesVendidas ?? 0 }}</div>
            <div class="text-[10px] text-teal font-bold">{{ (auditData as any)?.ocupacion ?? 0 }}% ocupación</div>
          </div>
          <div class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">ADR (Tarifa Promedio)</div>
            <div class="text-2xl font-black text-navy">\${{ ((auditData as any)?.adr ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-teal font-bold">{{ ((auditData as any)?.adr ?? 0) > ((auditData as any)?.adrAyer ?? 0) ? '▲' : '▼' }}\${{ Math.abs(((auditData as any)?.adr ?? 0) - ((auditData as any)?.adrAyer ?? 0)).toLocaleString() }} vs ayer</div>
          </div>
          <div class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">RevPAR</div>
            <div class="text-2xl font-black text-navy">\${{ ((auditData as any)?.revpar ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted">—</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div>
            <h4 class="text-sm font-black text-navy mb-3">Resumen de Check-ins</h4>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Check-ins realizados</span>
                <span class="font-bold text-navy">{{ (auditData as any)?.checkins ?? 0 }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Check-outs realizados</span>
                <span class="font-bold text-navy">{{ (auditData as any)?.checkouts ?? 0 }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">No-shows</span>
                <span class="font-bold text-coral">{{ (auditData as any)?.noShows ?? 0 }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Cancelaciones</span>
                <span class="font-bold text-orange">{{ (auditData as any)?.cancelaciones ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-black text-navy mb-3">Resumen de Pagos</h4>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Pagos recibidos</span>
                <span class="font-bold text-teal">\${{ ((auditData as any)?.pagosRecibidos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Pagos pendientes</span>
                <span class="font-bold text-orange">\${{ ((auditData as any)?.pagosPendientes ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Depósitos de seguridad</span>
                <span class="font-bold text-navy">\${{ ((auditData as any)?.depositos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Reembolsos</span>
                <span class="font-bold text-coral">\${{ ((auditData as any)?.reembolsos ?? 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
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

const stats = computed(() => {
  const d = auditData.value as any
  return [
    { label: 'Hab. Ocupadas', value: d?.habitacionesOcupadas ?? 0, color: 'text-teal' },
    { label: 'Check-outs', value: d?.checkouts ?? 0, color: 'text-orange' },
    { label: 'Check-ins', value: d?.checkins ?? 0, color: 'text-cyan' },
    { label: 'Ocupación', value: `${d?.ocupacion ?? 0}%`, color: 'text-cyan' },
    { label: 'Ingresos Día', value: `$${(d?.totalDia ?? 0).toLocaleString()}`, color: 'text-navy' },
  ]
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
  for (const a of d?.arrivosPendientes ?? []) movs.push({ id: a.id, icon: '🏨', description: `Check-in Hab ${a.roomNumber ?? ''} — ${a.guestName ?? ''}`, time: '', amount: a.totalAmount ?? 0 })
  for (const s of d?.salidasPendientes ?? []) movs.push({ id: s.id, icon: '🚪', description: `Check-out Hab ${s.roomNumber ?? ''}`, time: '', amount: -(s.totalAmount ?? 0) })
  return movs
})

const roomStatuses = ref<any[]>([])
const totalRooms = computed(() => (auditData.value as any)?.habitacionesTotales ?? 0)
const alerts = ref<any[]>([])

onMounted(loadData)

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
