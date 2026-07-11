<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Panel de RRHH</h2>
      <p class="text-sm text-text-muted mt-0.5">Resumen consolidado de talento del hotel</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <template v-else-if="data">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div v-for="k in kpis" :key="k.label" class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="k.bg">
              <span class="w-5 h-5" :class="k.fg" v-html="k.icon"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none text-navy truncate">{{ k.value }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">{{ k.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Por departamento -->
        <div class="card p-5">
          <h3 class="font-extrabold text-navy text-sm mb-4">Plantilla por departamento</h3>
          <div v-if="!data.byDepartment.length" class="text-sm text-text-muted py-6 text-center">Sin empleados cargados</div>
          <div v-else class="space-y-3">
            <div v-for="d in data.byDepartment" :key="d.departmentId || d.name">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-bold text-navy">{{ d.name }}</span>
                <span class="text-text-muted">{{ d.count }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface overflow-hidden">
                <div class="h-full bg-cyan rounded-full" :style="{ width: barWidth(d.count) }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Alertas y pendientes -->
        <div class="card p-5">
          <h3 class="font-extrabold text-navy text-sm mb-4">Alertas y pendientes</h3>
          <div class="space-y-3">
            <div v-for="a in alerts" :key="a.label" class="flex items-center justify-between p-3 rounded-xl" :class="a.value > 0 ? a.bg : 'bg-surface'">
              <div class="flex items-center gap-2.5">
                <span class="w-4 h-4 shrink-0" :class="a.value > 0 ? a.fg : 'text-text-muted'" v-html="a.icon"></span>
                <span class="text-xs font-bold" :class="a.value > 0 ? 'text-navy' : 'text-text-muted'">{{ a.label }}</span>
              </div>
              <span class="text-sm font-black" :class="a.value > 0 ? a.fg : 'text-text-muted'">{{ a.value }}</span>
            </div>
          </div>
          <div class="mt-4 flex items-center justify-between p-3 rounded-xl bg-navy/5">
            <span class="text-xs font-bold text-navy">Puntaje promedio de evaluaciones</span>
            <span class="text-sm font-black text-teal">{{ data.reviews.avgScore ?? '—' }}</span>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="card p-10 text-center text-sm text-text-muted">No se pudo cargar el panel.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { EmpleadosService, type HrDashboard } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'

const I_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const I_DOC = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>'
const I_CAL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z"/></svg>'
const I_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 5.11a.56.56 0 0 0 .48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 0 0-.18.56l1.28 5.38a.56.56 0 0 1-.84.61l-4.72-2.88a.56.56 0 0 0-.59 0l-4.72 2.88a.56.56 0 0 1-.84-.61l1.28-5.38a.56.56 0 0 0-.18-.56l-4.2-3.6a.56.56 0 0 1 .32-.99l5.52-.44a.56.56 0 0 0 .48-.35L11.48 3.5Z"/></svg>'
const I_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'

const toast = useToast()
const loading = ref(true)
const data = ref<HrDashboard | null>(null)

onMounted(async () => {
  try { data.value = await EmpleadosService.getDashboard() }
  catch { toast.error('No se pudo cargar el panel de RRHH') }
  finally { loading.value = false }
})

const kpis = computed(() => data.value ? [
  { label: 'Empleados activos', value: data.value.headcount, icon: I_USERS, bg: 'bg-navy/10', fg: 'text-navy' },
  { label: 'Altas este mes', value: data.value.newHiresThisMonth, icon: I_USERS, bg: 'bg-teal/10', fg: 'text-teal' },
  { label: 'Contratos activos', value: data.value.contracts.active, icon: I_DOC, bg: 'bg-cyan/10', fg: 'text-cyan' },
  { label: 'Ausencias pendientes', value: data.value.leaves.pending, icon: I_CAL, bg: 'bg-gold/10', fg: 'text-gold' },
] : [])

const alerts = computed(() => data.value ? [
  { label: 'Contratos por vencer (30 días)', value: data.value.contracts.expiringSoon, icon: I_ALERT, bg: 'bg-coral/10', fg: 'text-coral' },
  { label: 'Documentos por vencer (30 días)', value: data.value.documentsExpiring, icon: I_DOC, bg: 'bg-coral/10', fg: 'text-coral' },
  { label: 'Solicitudes de ausencia pendientes', value: data.value.leaves.pending, icon: I_CAL, bg: 'bg-gold/10', fg: 'text-gold' },
  { label: 'Ausencias aprobadas próximas', value: data.value.leaves.upcomingApproved, icon: I_CAL, bg: 'bg-cyan/10', fg: 'text-cyan' },
  { label: 'Evaluaciones pendientes', value: data.value.reviews.pending, icon: I_STAR, bg: 'bg-gold/10', fg: 'text-gold' },
] : [])

const maxDept = computed(() => Math.max(1, ...(data.value?.byDepartment.map((d) => d.count) ?? [1])))
function barWidth(count: number): string { return `${Math.round((count / maxDept.value) * 100)}%` }
</script>
