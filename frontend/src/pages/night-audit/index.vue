<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Night Audit</h2>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
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
        <button @click="startAudit" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLAY"></span>
          Iniciar Night Audit
        </button>
        <button @click="viewLastReport" class="flex items-center gap-1.5 bg-white text-text-secondary border border-border font-bold text-sm px-5 py-2.5 rounded-xl hover:border-navy/30 transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_DOCUMENT"></span>
          Último Reporte
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="stat.bg">
            <span class="w-5 h-5" :class="stat.color" v-html="stat.icon"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none truncate" :class="stat.color">{{ stat.value }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">{{ stat.label }}</div>
          </div>
        </div>
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
          <span v-if="index < currentStep" class="w-6 h-6 rounded-full bg-teal flex items-center justify-center text-white p-1 shrink-0" v-html="ICON_CHECK"></span>
          <span v-else-if="index === currentStep" class="w-6 h-6 rounded-full bg-cyan flex items-center justify-center text-navy text-xs animate-pulse shrink-0">...</span>
          <span v-else class="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-text-muted text-xs shrink-0">{{ index + 1 }}</span>
          <span class="text-sm" :class="index <= currentStep ? 'text-navy font-bold' : 'text-text-muted'">{{ step }}</span>
        </div>
      </div>
    </div>

    <!-- Resumen de Actividad -->
    <div v-if="activeView === 'activity'" class="grid grid-cols-2 gap-6">
      <!-- Movimientos de Hoy -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 shrink-0 text-navy" v-html="ICON_ACTIVITY"></span>
          <h3 class="text-sm font-black text-navy">Movimientos de Hoy</h3>
        </div>
        <div class="p-4">
          <div v-if="todayMovements.length === 0" class="text-center py-8">
            <span class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_ACTIVITY"></span>
            <p class="text-xs text-text-muted">Sin movimientos registrados hoy</p>
          </div>
          <div v-else class="space-y-3">
            <div v-for="movement in todayMovements" :key="movement.id" class="flex items-center justify-between p-3 bg-surface rounded-xl">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="movement.kind === 'checkin' ? 'bg-cyan/10' : 'bg-navy/10'">
                  <span class="w-4 h-4" :class="movement.kind === 'checkin' ? 'text-cyan' : 'text-navy'" v-html="movement.kind === 'checkin' ? ICON_LOGIN : ICON_LOGOUT"></span>
                </div>
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
        <div class="p-4 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 shrink-0 text-navy" v-html="ICON_BED"></span>
          <h3 class="text-sm font-black text-navy">Estado de Habitaciones</h3>
        </div>
        <div class="p-4">
          <div v-if="roomStatuses.length === 0" class="text-center py-8">
            <p class="text-xs text-text-muted">Sin datos de habitaciones</p>
          </div>
          <div v-else class="space-y-3">
            <div v-for="status in roomStatuses" :key="status.label" class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full shrink-0" :class="status.dot"></span>
                <span class="text-sm">{{ status.label }}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-lg font-black text-navy">{{ status.count }}</span>
                <div class="w-24 h-2 bg-surface rounded-full">
                  <div class="h-2 rounded-full" :class="status.bar" :style="{ width: `${totalRooms ? (status.count / totalRooms) * 100 : 0}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alertas -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 shrink-0 text-navy" v-html="ICON_BELL"></span>
          <h3 class="text-sm font-black text-navy">Alertas Pendientes</h3>
        </div>
        <div class="p-4">
          <div v-if="alerts.length === 0" class="text-center py-8">
            <span class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_CHECK_CIRCLE"></span>
            <p class="text-xs text-text-muted">Sin alertas pendientes</p>
          </div>
          <div v-else class="space-y-3">
            <div v-for="alert in alerts" :key="alert.id" class="flex items-start gap-3 p-3 bg-surface rounded-xl">
              <span class="w-5 h-5 mt-0.5 shrink-0" :class="alert.type === 'warning' ? 'text-gold' : 'text-coral'" v-html="ICON_ALERT"></span>
              <div class="flex-1">
                <div class="text-sm font-bold text-navy">{{ alert.title }}</div>
                <div class="text-[10px] text-text-muted">{{ alert.description }}</div>
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="alert.type === 'warning' ? 'bg-gold/10 text-gold' : 'bg-coral/10 text-coral'">
                {{ alert.type === 'warning' ? 'Advertencia' : 'Crítico' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen Financiero -->
      <div class="bg-white rounded-2xl border border-border card-shadow">
        <div class="p-4 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 shrink-0 text-navy" v-html="ICON_WALLET"></span>
          <h3 class="text-sm font-black text-navy">Resumen Financiero</h3>
        </div>
        <div class="p-4">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Ingresos por Habitaciones</span>
              <span class="text-sm font-bold text-teal">${{ ((auditData as any)?.ingresosHabitaciones ?? 0).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Ingresos por Servicios</span>
              <span class="text-sm font-bold text-teal">${{ ((auditData as any)?.ingresosServicios ?? 0).toLocaleString() }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Impuestos (ITBIS)</span>
              <span class="text-sm font-bold text-coral">${{ ((auditData as any)?.impuestos ?? 0).toLocaleString() }}</span>
            </div>
            <div class="border-t border-border pt-3">
              <div class="flex justify-between items-center">
                <span class="text-sm font-bold text-navy">Total del Día</span>
                <span class="text-lg font-black text-navy">${{ ((auditData as any)?.totalDia ?? 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Último Reporte -->
    <div v-if="activeView === 'report'" class="bg-white rounded-2xl border border-border card-shadow">
      <div class="p-6 border-b border-border">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 class="text-lg font-black text-navy">Reporte Night Audit</h3>
            <div class="text-sm text-text-muted">{{ (auditData as any)?.fecha || '—' }} — Generado ahora</div>
          </div>
          <div class="flex gap-2">
            <button class="flex items-center gap-1.5 px-4 py-2 bg-surface rounded-lg text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_PRINTER"></span>
              Imprimir
            </button>
            <button class="flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold hover:shadow-lg transition-colors cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_MAIL"></span>
              Enviar
            </button>
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
            <div class="text-2xl font-black text-navy">${{ ((auditData as any)?.adr ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-teal font-bold">{{ ((auditData as any)?.adr ?? 0) > ((auditData as any)?.adrAyer ?? 0) ? '▲' : '▼' }}${{ Math.abs(((auditData as any)?.adr ?? 0) - ((auditData as any)?.adrAyer ?? 0)).toLocaleString() }} vs ayer</div>
          </div>
          <div class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">RevPAR</div>
            <div class="text-2xl font-black text-navy">${{ ((auditData as any)?.revpar ?? 0).toLocaleString() }}</div>
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
                <span class="font-bold text-gold">{{ (auditData as any)?.cancelaciones ?? 0 }}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 class="text-sm font-black text-navy mb-3">Resumen de Pagos</h4>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Pagos recibidos</span>
                <span class="font-bold text-teal">${{ ((auditData as any)?.pagosRecibidos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Pagos pendientes</span>
                <span class="font-bold text-gold">${{ ((auditData as any)?.pagosPendientes ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Depósitos de seguridad</span>
                <span class="font-bold text-navy">${{ ((auditData as any)?.depositos ?? 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Reembolsos</span>
                <span class="font-bold text-coral">${{ ((auditData as any)?.reembolsos ?? 0).toLocaleString() }}</span>
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
import { useDashboardStore } from '@/stores/dashboard.store'
import { useToast } from '@/composables/useToast'

const ICON_PLAY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M5 3.87v16.26a1 1 0 0 0 1.53.85l13.14-8.13a1 1 0 0 0 0-1.7L6.53 3.02A1 1 0 0 0 5 3.87Z"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_PRINTER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5V3.75h10.5V7.5m-10.5 0h10.5m-10.5 0H3.75A1.5 1.5 0 0 0 2.25 9v6a1.5 1.5 0 0 0 1.5 1.5h1.5m13.5-9h1.5A1.5 1.5 0 0 1 21.75 9v6a1.5 1.5 0 0 1-1.5 1.5h-1.5m-10.5 0v3.75h10.5V16.5m-10.5 0h10.5"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75Zm0 0 9.75 6.75 9.75-6.75"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_LOGIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V4.5A1.5 1.5 0 0 1 10.5 3h6A1.5 1.5 0 0 1 18 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 9 19.5v-2.25M12 12h9m0 0-3-3m3 3-3 3"/></svg>'
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6.75V4.5A1.5 1.5 0 0 0 13.5 3h-6A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h6a1.5 1.5 0 0 0 1.5-1.5v-2.25M21 12h-9m0 0 3-3m-3 3 3 3"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m5-2h4a1 1 0 0 1 1 1v2"/></svg>'
const ICON_DOOR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M5 21V5a1 1 0 0 1 .8-.98l9-1.8A1 1 0 0 1 16 3.2V21M5 21h11M5 21H3m13 0h5m-5 0V3.2M13 12h.01"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_BELL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.85 23.85 0 0 0 5.454-1.31A8.97 8.97 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.97 8.97 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.26 24.26 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/></svg>'
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

const stats = computed(() => {
  const d = auditData.value as any
  return [
    { label: 'Hab. Ocupadas', value: d?.habitacionesOcupadas ?? 0, color: 'text-teal', bg: 'bg-teal/10', icon: ICON_BED },
    { label: 'Check-outs', value: d?.checkouts ?? 0, color: 'text-gold', bg: 'bg-gold/10', icon: ICON_DOOR },
    { label: 'Check-ins', value: d?.checkins ?? 0, color: 'text-cyan', bg: 'bg-cyan/10', icon: ICON_LOGIN },
    { label: 'Ocupación', value: `${d?.ocupacion ?? 0}%`, color: 'text-cyan', bg: 'bg-cyan/10', icon: ICON_CHART },
    { label: 'Ingresos Día', value: `$${(d?.totalDia ?? 0).toLocaleString()}`, color: 'text-navy', bg: 'bg-navy/10', icon: ICON_WALLET },
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
