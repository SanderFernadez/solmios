<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Gestión de Empleados</h2>
        <p class="text-sm text-text-muted mt-0.5">Expedientes, contratos, vacaciones, evaluaciones y organigrama</p>
      </div>
      <div class="flex gap-2">
        <button @click="openOrgChart" class="px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">🏢 Organigrama</button>
        <button @click="openNewEmployee" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Empleado</button>
      </div>
    </div>

    <div class="flex gap-2 mb-6 flex-wrap">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando datos...</span>
    </div>

    <!-- Expedientes -->
    <div v-if="activeTab === 'profiles' && !loading" class="card overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Cargo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Depto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Contrato</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Salario</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Ingreso</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in profiles" :key="emp.id" @click="openProfile(emp)"
            class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer">
            <td class="p-4 text-sm font-bold text-navy">{{ emp.userName || emp.position || emp.userId }}</td>
            <td class="p-4 text-sm">{{ emp.position || '—' }}</td>
            <td class="p-4 text-sm">{{ getDeptName(emp.departmentId) }}</td>
            <td class="p-4 text-sm">{{ emp.contractType || '—' }}</td>
            <td class="p-4 text-sm font-bold text-navy">${{ emp.salary?.toLocaleString() || '—' }}</td>
            <td class="p-4 text-sm text-text-secondary">{{ emp.hireDate || '—' }}</td>
            <td class="p-4 text-right">
              <button @click.stop="openProfile(emp)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 cursor-pointer">Ver</button>
              <button @click.stop="deactivateEmployee(emp)" class="ml-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Desactivar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="profiles.length === 0" class="p-8 text-center text-text-muted text-sm">No hay empleados registrados</div>
    </div>

    <!-- Contratos -->
    <div v-if="activeTab === 'contracts' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">Contratos Laborales</h3>
        <button @click="openNewContract" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo Contrato</button>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Inicio</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fin</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Salario</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in contracts" :key="c.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4 text-sm font-bold text-navy">{{ getEmployeeName(c.employeeId) }}</td>
            <td class="p-4 text-sm">{{ c.type }}</td>
            <td class="p-4 text-sm">{{ c.startDate }}</td>
            <td class="p-4 text-sm">{{ c.endDate || 'Indefinido' }}</td>
            <td class="p-4 text-sm font-bold text-navy">${{ c.salary.toLocaleString() }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status === 'active' ? 'Activo' : 'Terminado' }}</span>
            </td>
            <td class="p-4 text-right">
              <button v-if="c.status === 'active'" @click="terminateContract(c)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Terminar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="contracts.length === 0" class="p-8 text-center text-text-muted text-sm">No hay contratos registrados</div>
    </div>

    <!-- Documentos -->
    <div v-if="activeTab === 'documents' && !loading" class="space-y-4">
      <div v-if="documentAlerts.length" class="card p-4 bg-coral/5 border border-coral/20 rounded-xl mb-4">
        <h3 class="font-extrabold text-coral text-sm mb-3">⚠ Documentos por Vencer ({{ documentAlerts.length }})</h3>
        <div v-for="alert in documentAlerts" :key="alert.documentId" class="flex items-center justify-between py-2 border-b border-coral/10 last:border-0">
          <div class="flex items-center gap-3">
            <span class="text-lg">📄</span>
            <div>
              <div class="text-sm font-bold text-navy">{{ alert.documentName }}</div>
              <div class="text-[10px] text-text-muted">Vence en {{ alert.daysUntilExpiry }} días — {{ alert.expiryDate }}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-coral/10 text-coral">Urgente</span>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="p-4 border-b border-border flex justify-between">
          <h3 class="font-extrabold text-navy text-sm">Documentos del Expediente</h3>
          <button @click="openNewDocument" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo Documento</button>
        </div>
        <table class="w-full">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Documento</th>
              <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
              <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
              <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Vencimiento</th>
              <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in documents" :key="doc.id" class="border-b border-border last:border-0 hover:bg-surface/50">
              <td class="p-4 text-sm font-bold text-navy">{{ doc.name }}</td>
              <td class="p-4 text-sm">{{ doc.type }}</td>
              <td class="p-4 text-sm">{{ getEmployeeName(doc.employeeId) }}</td>
              <td class="p-4 text-sm" :class="isExpiringSoon(doc) ? 'text-coral font-bold' : 'text-text-secondary'">{{ doc.expiryDate || '—' }}</td>
              <td class="p-4 text-right">
                <button @click="deleteDocument(doc)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="documents.length === 0" class="p-8 text-center text-text-muted text-sm">No hay documentos registrados</div>
      </div>
    </div>

    <!-- Vacaciones y Permisos -->
    <div v-if="activeTab === 'leaves' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">Solicitudes de Vacaciones y Permisos</h3>
        <button @click="openNewLeave" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nueva Solicitud</button>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Desde</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hasta</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Días</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in leaveRequests" :key="l.id" class="border-b border-border last:border-0 hover:bg-surface/50">
            <td class="p-4 text-sm font-bold text-navy">{{ getEmployeeName(l.employeeId) }}</td>
            <td class="p-4 text-sm">{{ leaveTypeLabel(l.type) }}</td>
            <td class="p-4 text-sm">{{ l.startDate }}</td>
            <td class="p-4 text-sm">{{ l.endDate }}</td>
            <td class="p-4 text-sm">{{ l.days }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="leaveStatusClass(l.status)">{{ leaveStatusLabel(l.status) }}</span>
            </td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end" v-if="l.status === 'pending'">
                <button @click="approveLeave(l)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">Aprobar</button>
                <button @click="rejectLeave(l)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Rechazar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="leaveRequests.length === 0" class="p-8 text-center text-text-muted text-sm">No hay solicitudes pendientes</div>
    </div>

    <!-- Evaluaciones -->
    <div v-if="activeTab === 'reviews' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">Evaluaciones de Desempeño</h3>
        <button @click="openNewReview" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nueva Evaluación</button>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Período</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Puntaje</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reviews" :key="r.id" class="border-b border-border last:border-0 hover:bg-surface/50">
            <td class="p-4 text-sm font-bold text-navy">{{ getEmployeeName(r.employeeId) }}</td>
            <td class="p-4 text-sm">{{ r.period || '—' }}</td>
            <td class="p-4 text-sm">{{ r.reviewDate }}</td>
            <td class="p-4 text-sm">
              <span :class="scoreClass(r.score)">{{ r.score ?? '—' }}/10</span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="r.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ r.status === 'completed' ? 'Completada' : 'Borrador' }}</span>
            </td>
            <td class="p-4 text-right">
              <button v-if="r.status === 'draft'" @click="completeReview(r)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">Completar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="reviews.length === 0" class="p-8 text-center text-text-muted text-sm">No hay evaluaciones registradas</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { EmpleadosService, type EmployeeProfile, type Contract, type EmployeeDocument, type LeaveRequest, type PerformanceReview, type Department, type DocumentExpiryAlert } from '@/services/Empleados.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('profiles')
const loading = ref(true)

const tabs = [
  { value: 'profiles', label: '👥 Expedientes' },
  { value: 'contracts', label: '📝 Contratos' },
  { value: 'documents', label: '📄 Documentos' },
  { value: 'leaves', label: '🏖 Vacaciones' },
  { value: 'reviews', label: '⭐ Evaluaciones' },
]

const profiles = ref<EmployeeProfile[]>([])
const contracts = ref<Contract[]>([])
const documents = ref<EmployeeDocument[]>([])
const leaveRequests = ref<LeaveRequest[]>([])
const reviews = ref<PerformanceReview[]>([])
const departments = ref<Department[]>([])
const documentAlerts = ref<DocumentExpiryAlert[]>([])

function getDeptName(id: string | null): string {
  if (!id) return '—'
  return departments.value.find(d => d.id === id)?.name || id
}

function getEmployeeName(userId: string): string {
  if (!userId) return '—'
  const profile = profiles.value.find(p => p.userId === userId || p.id === userId)
  return profile?.userName || profile?.position || userId.slice(0, 8)
}

function leaveTypeLabel(type: string) {
  return { vacation: 'Vacaciones', permission: 'Permiso', sick_leave: 'Enfermedad', maternity: 'Maternidad', other: 'Otro' }[type] ?? type
}

function leaveStatusLabel(status: string) {
  return { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' }[status] ?? status
}

function leaveStatusClass(status: string) {
  return { pending: 'bg-gold/10 text-gold', approved: 'bg-teal/10 text-teal', rejected: 'bg-coral/10 text-coral' }[status] ?? ''
}

function scoreClass(score: number | null) {
  if (!score) return 'font-bold'
  if (score >= 8) return 'text-teal font-bold'
  if (score >= 6) return 'text-gold font-bold'
  return 'text-coral font-bold'
}

function isExpiringSoon(doc: EmployeeDocument): boolean {
  return documentAlerts.value.some(a => a.documentId === doc.id)
}

async function loadData() {
  loading.value = true
  const hid = hotelId.value
  const qs = hid ? { hotelId: hid } : undefined
  try {
    const [profilesRes, contractsRes, documentsRes, leavesRes, reviewsRes, alertsRes] = await Promise.all([
      EmpleadosService.listProfiles(qs),
      EmpleadosService.listContracts(undefined, hid),
      EmpleadosService.listDocuments(undefined, hid),
      EmpleadosService.listLeaveRequests(qs),
      EmpleadosService.listReviews(undefined, hid),
      EmpleadosService.getExpiringDocuments(),
    ])
    profiles.value = profilesRes.data ?? []
    contracts.value = contractsRes
    documents.value = documentsRes
    leaveRequests.value = leavesRes
    reviews.value = reviewsRes
    documentAlerts.value = alertsRes

    try { departments.value = await EmpleadosService.listDepartments() } catch { /* optional */ }
  } catch { toast.error('Error al cargar datos') }
  finally { loading.value = false }
}

onMounted(loadData)

// ─── Actions ────────────────────────────────────────────

function openOrgChart() { toast.info('Organigrama — use /api/org-chart para renderizar') }
function openNewEmployee() { toast.info('Crear empleado — requiere perfil + contrato') }
function openProfile(emp: EmployeeProfile) { toast.info(`Perfil: ${emp.userName || emp.position}`) }

async function deactivateEmployee(emp: EmployeeProfile) {
  if (!confirm(`¿Desactivar a ${emp.userName || emp.position}?`)) return
  try { await EmpleadosService.deactivateProfile(emp.id); toast.success('Empleado desactivado'); loadData() }
  catch { toast.error('Error al desactivar') }
}

async function terminateContract(c: Contract) {
  if (!confirm(`¿Terminar contrato de ${getEmployeeName(c.employeeId)}?`)) return
  try { await EmpleadosService.terminateContract(c.id); toast.success('Contrato terminado'); loadData() }
  catch { toast.error('Error al terminar contrato') }
}

async function deleteDocument(doc: EmployeeDocument) {
  if (!confirm(`¿Eliminar documento "${doc.name}"?`)) return
  try { await EmpleadosService.deleteDocument(doc.id); toast.success('Documento eliminado'); loadData() }
  catch { toast.error('Error al eliminar documento') }
}

async function approveLeave(l: LeaveRequest) {
  try { await EmpleadosService.approveLeaveRequest(l.id); toast.success('Solicitud aprobada'); loadData() }
  catch { toast.error('Error al aprobar') }
}

async function rejectLeave(l: LeaveRequest) {
  const reason = prompt('Motivo de rechazo (opcional):')
  try { await EmpleadosService.rejectLeaveRequest(l.id, reason || undefined); toast.success('Solicitud rechazada'); loadData() }
  catch { toast.error('Error al rechazar') }
}

async function completeReview(r: PerformanceReview) {
  try { await EmpleadosService.completeReview(r.id); toast.success('Evaluación completada'); loadData() }
  catch { toast.error('Error al completar') }
}

function openNewContract() { toast.info('Nuevo contrato — formulario pendiente') }
function openNewDocument() { toast.info('Nuevo documento — formulario pendiente') }
function openNewLeave() { toast.info('Nueva solicitud — formulario pendiente') }
function openNewReview() { toast.info('Nueva evaluación — formulario pendiente') }
</script>
