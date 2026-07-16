<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6 flex-wrap">
      <button @click="goBack" class="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_BACK"></span>Volver
      </button>
      <div>
        <h2 class="text-xl font-black text-navy">Expediente del Empleado</h2>
        <p class="text-sm text-text-muted mt-0.5">Vista integral: datos, contratos, documentos, ausencias y evaluaciones</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando expediente...</span>
    </div>

    <div v-else-if="!dossier" class="card p-12 text-center">
      <p class="text-text-muted text-sm">No se pudo cargar el expediente.</p>
    </div>

    <div v-else class="space-y-5">
      <!-- Encabezado del empleado + resumen de evaluación -->
      <div class="card p-5 flex flex-wrap items-center gap-5">
        <div class="w-16 h-16 rounded-2xl bg-navy/10 flex items-center justify-center text-navy font-black text-2xl shrink-0">
          {{ initials }}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-black text-navy truncate">{{ employeeName }}</h3>
          <p class="text-sm text-text-muted">{{ dossier.profile.position || 'Sin puesto' }} · {{ roleLabel }}</p>
          <span class="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full" :class="dossier.profile.active ? 'bg-teal/10 text-teal' : 'bg-text-muted/15 text-text-muted'">
            {{ dossier.profile.active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
        <div v-if="dossier.evalSummary" class="text-center px-5 py-3 rounded-2xl" :class="bandBg(dossier.evalSummary.band)">
          <div class="text-3xl font-black leading-none">{{ dossier.evalSummary.latestScore ?? '—' }}</div>
          <div class="text-[10px] font-bold uppercase tracking-wider mt-1">{{ bandLabel(dossier.evalSummary.band) }}</div>
          <div class="text-[10px] opacity-70 mt-0.5">{{ dossier.evalSummary.period || '' }}</div>
        </div>
      </div>

      <!-- Datos personales -->
      <section class="card overflow-hidden">
        <header class="px-4 py-3 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_USER"></span>
          <h3 class="font-extrabold text-navy text-sm">Datos personales</h3>
        </header>
        <dl class="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 p-4 text-sm">
          <div v-for="f in personalFields" :key="f.label">
            <dt class="text-[10px] font-bold text-text-muted uppercase tracking-wider">{{ f.label }}</dt>
            <dd class="text-navy font-semibold mt-0.5 break-words">{{ f.value || '—' }}</dd>
          </div>
        </dl>
      </section>

      <!-- Contratos -->
      <section class="card overflow-hidden">
        <header class="px-4 py-3 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_DOCUMENT"></span>
          <h3 class="font-extrabold text-navy text-sm">Contratos ({{ dossier.contracts.length }})</h3>
        </header>
        <div v-if="dossier.contracts.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Inicio</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fin</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Salario</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in dossier.contracts" :key="c.id" class="border-b border-border/60 last:border-0">
                <td class="px-4 py-2.5 text-text-secondary">{{ c.type }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.startDate }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.endDate || 'Indefinido' }}</td>
                <td class="px-4 py-2.5 text-right font-bold text-navy whitespace-nowrap">{{ c.currency }} {{ c.salary?.toLocaleString() }}</td>
                <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-text-muted/15 text-text-muted'">{{ c.status === 'active' ? 'Activo' : 'Terminado' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="p-6 text-center text-text-muted text-sm">Sin contratos registrados</p>
      </section>

      <!-- Documentos -->
      <section class="card overflow-hidden">
        <header class="px-4 py-3 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_DOCUMENT"></span>
          <h3 class="font-extrabold text-navy text-sm">Documentos ({{ dossier.documents.length }})</h3>
        </header>
        <div v-if="dossier.documents.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Documento</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Vencimiento</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Archivo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in dossier.documents" :key="d.id" class="border-b border-border/60 last:border-0">
                <td class="px-4 py-2.5 font-bold text-navy">{{ d.name }}</td>
                <td class="px-4 py-2.5 text-text-secondary">{{ d.type }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ d.expiryDate || '—' }}</td>
                <td class="px-4 py-2.5 text-right">
                  <a v-if="d.fileUrl" :href="d.fileUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver
                  </a>
                  <span v-else class="text-text-muted text-[10px]">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="p-6 text-center text-text-muted text-sm">Sin documentos registrados</p>
      </section>

      <!-- Ausencias / vacaciones -->
      <section class="card overflow-hidden">
        <header class="px-4 py-3 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_BEACH"></span>
          <h3 class="font-extrabold text-navy text-sm">Ausencias y vacaciones ({{ dossier.leaveRequests.length }})</h3>
        </header>
        <div v-if="dossier.leaveRequests.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Desde</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Hasta</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Días</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in dossier.leaveRequests" :key="l.id" class="border-b border-border/60 last:border-0">
                <td class="px-4 py-2.5 text-text-secondary">{{ l.type }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ l.startDate }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ l.endDate }}</td>
                <td class="px-4 py-2.5 text-right text-text-secondary">{{ l.days }}</td>
                <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="leaveStatusClass(l.status)">{{ leaveStatusLabel(l.status) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="p-6 text-center text-text-muted text-sm">Sin ausencias registradas</p>
      </section>

      <!-- Evaluaciones -->
      <section class="card overflow-hidden">
        <header class="px-4 py-3 border-b border-border flex items-center gap-2">
          <span class="w-4 h-4 text-navy shrink-0" v-html="ICON_STAR"></span>
          <h3 class="font-extrabold text-navy text-sm">Evaluaciones ({{ dossier.reviews.length }})</h3>
        </header>
        <div v-if="dossier.reviews.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Período</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Origen</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Puntaje</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in dossier.reviews" :key="r.id" class="border-b border-border/60 last:border-0">
                <td class="px-4 py-2.5 text-text-secondary">{{ r.period || '—' }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ (r.reviewDate || '').slice(0, 10) }}</td>
                <td class="px-4 py-2.5">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="r.reviewerId === 'system' ? 'bg-cyan/10 text-cyan' : 'bg-navy/10 text-navy'">
                    {{ r.reviewerId === 'system' ? 'Automática' : 'Manual' }}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-right font-bold" :class="scoreClass(r.score)">{{ r.score ?? '—' }}</td>
                <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="r.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ r.status === 'completed' ? 'Completada' : 'Borrador' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="p-6 text-center text-text-muted text-sm">Sin evaluaciones registradas</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { EmpleadosService, type EmployeeDossier, type EvalBand } from '@/services/Empleados.service'
import { TeamService } from '@/services/Team.service'
import { useToast } from '@/composables/useToast'

const ICON_BACK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_BEACH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m-7.5 6a7.5 7.5 0 0 1 15 0h-15Zm7.5 0v9m-9 0h18"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 5.11a.56.56 0 0 0 .48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 0 0-.18.56l1.28 5.38a.56.56 0 0 1-.84.61l-4.72-2.88a.56.56 0 0 0-.59 0l-4.72 2.88a.56.56 0 0 1-.84-.61l1.28-5.38a.56.56 0 0 0-.18-.56l-4.2-3.6a.56.56 0 0 1 .32-.99l5.52-.44a.56.56 0 0 0 .48-.35L11.48 3.5Z"/></svg>'
const ICON_EYE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.5 7.36 4.5 12 4.5c4.64 0 8.57 3 9.96 7.18.07.2.07.43 0 .64C20.58 16.49 16.64 19.5 12 19.5c-4.64 0-8.57-3-9.96-7.18Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const loading = ref(true)
const dossier = ref<EmployeeDossier | null>(null)
const userNames = ref<Map<string, string>>(new Map())

const employeeId = computed(() => String(route.params.id ?? ''))

const employeeName = computed(() => {
  const p = dossier.value?.profile
  if (!p) return '—'
  return p.userName || userNames.value.get(p.userId) || p.position || p.userId.slice(0, 8)
})

const initials = computed(() => {
  const n = employeeName.value.trim()
  if (!n || n === '—') return '?'
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
})

const ROLE_LABELS: Record<string, string> = {
  hotel_admin: 'Admin Hotel', super_admin: 'Super Admin', receptionist: 'Recepcionista',
  housekeeper: 'Limpieza', maintenance: 'Mantenimiento', supervisor: 'Supervisor',
}
const roleLabel = computed(() => {
  const r = dossier.value?.profile.userRole
  return r ? (ROLE_LABELS[r] ?? r) : 'Sin rol'
})

const personalFields = computed(() => {
  const p = dossier.value?.profile
  if (!p) return []
  return [
    { label: 'Departamento', value: p.departmentId ?? '' },
    { label: 'Fecha de ingreso', value: (p.hireDate || '').slice(0, 10) },
    { label: 'Fecha de nacimiento', value: (p.birthDate || '').slice(0, 10) },
    { label: 'Nacionalidad', value: p.nationality },
    { label: 'Documento', value: p.documentNumber ? `${p.documentType || ''} ${p.documentNumber}`.trim() : '' },
    { label: 'Teléfono emergencia', value: p.emergencyContactPhone },
    { label: 'Contacto emergencia', value: p.emergencyContactName },
    { label: 'Dirección', value: [p.address, p.city, p.country].filter(Boolean).join(', ') },
    { label: 'Días de vacaciones', value: p.vacationDaysTotal != null ? `${p.vacationDaysUsed ?? 0} / ${p.vacationDaysTotal}` : '' },
  ]
})

function leaveStatusLabel(status: string) {
  return ({ pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' } as Record<string, string>)[status] ?? status
}
function leaveStatusClass(status: string) {
  return ({ pending: 'bg-gold/10 text-gold', approved: 'bg-teal/10 text-teal', rejected: 'bg-coral/10 text-coral' } as Record<string, string>)[status] ?? ''
}
function scoreClass(score: number | null) {
  if (score == null) return 'text-text-muted'
  if (score >= 80) return 'text-teal'
  if (score >= 60) return 'text-gold'
  return 'text-coral'
}

const BAND_LABELS: Record<EvalBand, string> = { excellent: 'Excelente', good: 'Bueno', fair: 'Regular', poor: 'Bajo' }
function bandLabel(band: EvalBand | null) { return band ? BAND_LABELS[band] : 'Sin banda' }
function bandBg(band: EvalBand | null) {
  return ({
    excellent: 'bg-teal/10 text-teal', good: 'bg-cyan/10 text-cyan',
    fair: 'bg-gold/10 text-gold', poor: 'bg-coral/10 text-coral',
  } as Record<string, string>)[band ?? ''] ?? 'bg-navy/5 text-navy'
}

function goBack() { router.push('/panel/rrhh/empleados') }

onMounted(async () => {
  try {
    // Nombres SIEMPRE por /usuarios (regla del proyecto): el perfil no siempre trae userName.
    try {
      const team = await TeamService.list()
      for (const m of team.data ?? []) userNames.value.set(m.id, m.name)
    } catch { /* opcional: si falla, cae al puesto/userId */ }
    dossier.value = await EmpleadosService.getDossier(employeeId.value)
  } catch {
    toast.error('No se pudo cargar el expediente')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* Utilidades inline en el template (Tailwind); sin @apply para no requerir @reference en SFC scoped. */
</style>
