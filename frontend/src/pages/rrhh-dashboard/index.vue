<template>
  <div>
    <div class="mb-6">
      <h2 class="text-xl font-black text-navy">Panel de RRHH</h2>
      <p class="text-sm text-text-muted mt-0.5">Resumen consolidado de talento del hotel</p>
    </div>

    <!-- Skeletons -->
    <template v-if="loading">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div v-for="i in 4" :key="i" class="h-[132px] animate-pulse rounded-[16px] bg-surface"></div>
      </div>
      <div class="grid lg:grid-cols-2 gap-6 mb-6">
        <div v-for="i in 2" :key="i" class="h-48 animate-pulse rounded-2xl bg-surface"></div>
      </div>
      <div class="grid md:grid-cols-3 gap-6">
        <div v-for="i in 3" :key="i" class="h-56 animate-pulse rounded-2xl bg-surface"></div>
      </div>
    </template>

    <template v-else-if="data">
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiHeroCard v-for="k in kpis" :key="k.label" :label="k.label" :value="k.value"
          :icon="k.icon" :accent="k.accent" :unit="k.unit" />
      </div>

      <div class="grid lg:grid-cols-2 gap-6 mb-6">
        <!-- Ocupación del personal (3 estados) -->
        <SectionCard title="Estado de ocupación del personal"
          :subtitle="`${data.occupancy.total} colaboradores en total`"
          :class="data.attendance ? '' : 'lg:col-span-2'">
          <div class="h-3 rounded-full bg-surface overflow-hidden flex mb-4">
            <div class="h-full bg-teal" :style="{ width: occPct(data.occupancy.available) }" title="Disponibles"></div>
            <div class="h-full bg-gold" :style="{ width: occPct(data.occupancy.onLeave) }" title="De licencia"></div>
            <div class="h-full bg-text-muted/40" :style="{ width: occPct(data.occupancy.inactive) }" title="Inactivos"></div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-teal/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-teal shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Disponibles</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.occupancy.available }}</div>
            </div>
            <div class="rounded-xl bg-gold/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-gold shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">De licencia</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.occupancy.onLeave }}</div>
            </div>
            <div class="rounded-xl bg-surface p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-text-muted/40 shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Inactivos</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.occupancy.inactive }}</div>
            </div>
          </div>
        </SectionCard>

        <!-- Resumen de asistencia de hoy (#198, #611, #612) -->
        <SectionCard v-if="data.attendance" title="Resumen de asistencia" subtitle="Asistencia de hoy · fichaje en vivo">
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-teal/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-teal shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Presentes</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.attendance.present }}</div>
            </div>
            <div class="rounded-xl bg-gold/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-gold shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Tardanzas</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.attendance.late }}</div>
            </div>
            <div class="rounded-xl bg-coral/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-coral shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Ausentes</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ data.attendance.absent }}</div>
            </div>
            <div class="rounded-xl bg-purple/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-purple shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Licencias</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ licensesToday }}</div>
            </div>
            <div class="rounded-xl bg-cyan/5 p-3">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-cyan shrink-0"></span>
                <span class="text-[10px] font-bold uppercase tracking-wide text-text-muted truncate">Vacaciones</span>
              </div>
              <div class="mt-1.5 text-lg font-black leading-none tabular-nums text-navy">{{ vacationsToday }}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div class="grid lg:grid-cols-2 gap-6">
        <!-- Por departamento -->
        <SectionCard title="Plantilla por departamento"
          :subtitle="data.byDepartment.length ? `${data.byDepartment.length} departamentos` : undefined"
          :body-class="data.byDepartment.length ? 'p-4 sm:p-5' : 'p-0'">
          <EmptyState v-if="!data.byDepartment.length" icon="🏢" title="Sin empleados cargados"
            message="Cuando registres colaboradores vas a ver acá el reparto por departamento." />
          <div v-else class="space-y-3">
            <div v-for="d in data.byDepartment" :key="d.departmentId || d.name">
              <div class="flex items-center justify-between text-xs mb-1 gap-2">
                <span class="font-bold text-navy truncate">{{ d.name }}</span>
                <span class="text-text-muted tabular-nums shrink-0">{{ d.count }}</span>
              </div>
              <div class="h-2 rounded-full bg-surface overflow-hidden">
                <div class="h-full bg-cyan rounded-full" :style="{ width: barWidth(d.count) }"></div>
              </div>
            </div>
          </div>
        </SectionCard>

        <!-- Alertas y pendientes -->
        <SectionCard title="Alertas y pendientes" subtitle="Requieren seguimiento" body-class="p-0">
          <div class="divide-y divide-border">
            <div v-for="a in alerts" :key="a.label" class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="h-8 w-8 shrink-0 grid place-items-center rounded-lg"
                  :class="a.value > 0 ? [a.bg, a.fg] : 'bg-surface text-text-muted'">
                  <span class="h-4 w-4" v-html="a.icon"></span>
                </span>
                <span class="text-xs font-bold truncate" :class="a.value > 0 ? 'text-navy' : 'text-text-muted'">{{ a.label }}</span>
              </div>
              <span class="text-sm font-black tabular-nums shrink-0" :class="a.value > 0 ? a.fg : 'text-text-muted'">{{ a.value }}</span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 border-t-2 border-navy/10 bg-navy/5 px-4 sm:px-5 py-3">
            <span class="text-xs font-bold text-navy">Puntaje promedio de evaluaciones</span>
            <span v-if="data.reviews.avgScore != null" class="text-sm font-black tabular-nums text-teal">{{ data.reviews.avgScore }}</span>
            <span v-else class="text-[11px] font-bold text-text-muted">Sin evaluaciones</span>
          </div>
        </SectionCard>
      </div>

      <!-- Cumpleaños · Licencias hoy · Top desempeño -->
      <div class="grid md:grid-cols-3 gap-6 mt-6">
        <!-- Cumpleaños del mes -->
        <SectionCard title="🎂 Cumpleaños del mes" :subtitle="`Mes de ${monthName}`"
          :body-class="data.birthdaysThisMonth.length ? 'p-4 sm:p-5' : 'p-0'">
          <EmptyState v-if="!data.birthdaysThisMonth.length" icon="🎂" title="Sin cumpleaños este mes"
            message="No hay colaboradores que cumplan años en este período." />
          <div v-else class="space-y-2.5">
            <div v-for="b in data.birthdaysThisMonth" :key="b.employeeId" class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-navy truncate">{{ b.name }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan/10 text-cyan shrink-0 tabular-nums">{{ b.day }} {{ monthName }}</span>
            </div>
          </div>
        </SectionCard>

        <!-- Colaboradores de licencia hoy -->
        <SectionCard title="🌴 De licencia hoy"
          :subtitle="data.onLeaveToday.length ? `${data.onLeaveToday.length} colaboradores` : undefined"
          :body-class="data.onLeaveToday.length ? 'p-4 sm:p-5' : 'p-0'">
          <EmptyState v-if="!data.onLeaveToday.length" icon="🌴" title="Nadie de licencia hoy"
            message="Todo el equipo disponible está en operación." />
          <div v-else class="space-y-2.5">
            <div v-for="l in data.onLeaveToday" :key="l.employeeId + l.startDate" class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-navy truncate">{{ l.name }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold/10 text-gold shrink-0">{{ leaveTypeLabel(l.type) }}</span>
            </div>
          </div>
        </SectionCard>

        <!-- Top desempeño -->
        <SectionCard title="⭐ Top desempeño" subtitle="Mejores puntajes de evaluación"
          :body-class="data.topPerformers.length ? 'p-4 sm:p-5' : 'p-0'">
          <EmptyState v-if="!data.topPerformers.length" icon="⭐" title="Sin evaluaciones completadas"
            message="Cuando cierres evaluaciones vas a ver acá el ranking del equipo." />
          <div v-else class="space-y-2.5">
            <div v-for="(t, i) in data.topPerformers" :key="t.employeeId" class="flex items-center gap-2.5">
              <span class="w-5 h-5 rounded-full bg-teal/10 text-teal text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums">{{ i + 1 }}</span>
              <span class="text-xs font-bold text-navy truncate flex-1">{{ t.name }}</span>
              <span class="text-xs font-black text-teal shrink-0 tabular-nums">{{ t.avgScore }}</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </template>

    <SectionCard v-else body-class="p-0">
      <EmptyState icon="⚠️" title="No se pudo cargar el panel"
        message="Ocurrió un problema al traer los datos de RRHH. Volvé a intentarlo." />
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { EmpleadosService, type HrDashboard } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'

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

type KpiIcon = 'bed' | 'checkin' | 'checkout' | 'money' | 'building' | 'users' | 'bookings'
type KpiAccent = 'blue' | 'green' | 'purple' | 'amber' | 'teal' | 'rose'
type Kpi = { label: string; value: number; icon: KpiIcon; accent: KpiAccent; unit?: string }

const kpis = computed<Kpi[]>(() => data.value ? [
  { label: 'Empleados activos', value: data.value.headcount, icon: 'users', accent: 'blue', unit: `${data.value.occupancy.available} disponibles` },
  { label: 'Altas este mes', value: data.value.newHiresThisMonth, icon: 'checkin', accent: 'teal' },
  { label: 'Contratos activos', value: data.value.contracts.active, icon: 'building', accent: 'purple', unit: `${data.value.contracts.expiringSoon} por vencer` },
  { label: 'Ausencias pendientes', value: data.value.leaves.pending, icon: 'bookings', accent: 'amber', unit: `${data.value.leaves.upcomingApproved} aprobadas próximas` },
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

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const monthName = MONTHS[new Date().getMonth()]

function occPct(n: number): string {
  const total = data.value?.occupancy.total || 1
  return `${(n / total) * 100}%`
}

// #611/#612: desglose de "de licencia hoy" por tipo. `type === 'vacation'` es vacaciones;
// cualquier otro tipo (permission/sick_leave/maternity/other) cuenta como licencia.
const vacationsToday = computed(() => data.value?.onLeaveToday.filter((l) => l.type === 'vacation').length ?? 0)
const licensesToday = computed(() => data.value?.onLeaveToday.filter((l) => l.type !== 'vacation').length ?? 0)

const LEAVE_LABELS: Record<string, string> = {
  vacation: 'Vacaciones', permission: 'Permiso', sick_leave: 'Licencia médica', maternity: 'Maternidad', other: 'Otro',
}
function leaveTypeLabel(type: string): string { return LEAVE_LABELS[type] ?? type }
</script>
