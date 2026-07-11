<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Gestión de Empleados</h2>
        <p class="text-sm text-text-muted mt-0.5">Expedientes, contratos, vacaciones, evaluaciones y organigrama</p>
      </div>
      <div class="flex gap-2">
        <button @click="openOrgChart" class="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_BUILDING"></span>Organigrama
        </button>
        <button @click="openNewEmployee" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Nuevo Empleado
        </button>
      </div>
    </div>

    <div class="flex gap-2 mb-6 flex-wrap">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span class="w-4 h-4 shrink-0" v-html="tab.icon"></span>
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando datos...</span>
    </div>

    <!-- Expedientes -->
    <div v-if="activeTab === 'profiles' && !loading" class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Cargo</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Depto</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Contrato</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Salario</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Ingreso</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in profiles" :key="emp.id" @click="openProfile(emp)"
              class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors cursor-pointer">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ emp.userName || emp.position || emp.userId }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ emp.position || '—' }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ getDeptName(emp.departmentId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ emp.contractType || '—' }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-navy whitespace-nowrap">${{ emp.salary?.toLocaleString() || '—' }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ emp.hireDate || '—' }}</td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button @click.stop="openProfile(emp)" class="inline-flex items-center gap-1 px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver
                </button>
                <button @click.stop="deactivateEmployee(emp)" class="inline-flex items-center gap-1 ml-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_POWER"></span>Desactivar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="profiles.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_USERS"></span>
        <p class="text-text-muted text-sm">No hay empleados registrados</p>
      </div>
    </div>

    <!-- Contratos -->
    <div v-if="activeTab === 'contracts' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Contratos Laborales</h3>
        <button @click="openNewContract" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo Contrato
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Inicio</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fin</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Salario</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in contracts" :key="c.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ getEmployeeName(c.employeeId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ c.type }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.startDate }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.endDate || 'Indefinido' }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-navy whitespace-nowrap">${{ c.salary.toLocaleString() }}</td>
              <td class="px-4 py-2.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status === 'active' ? 'Activo' : 'Terminado' }}</span>
              </td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button v-if="c.status === 'active'" @click="terminateContract(c)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_XCIRCLE"></span>Terminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="contracts.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
        <p class="text-text-muted text-sm">No hay contratos registrados</p>
      </div>
    </div>

    <!-- Documentos -->
    <div v-if="activeTab === 'documents' && !loading" class="space-y-4">
      <div v-if="documentAlerts.length" class="card p-4 bg-coral/5 border border-coral/20 rounded-xl mb-4">
        <h3 class="flex items-center gap-2 font-extrabold text-coral text-sm mb-3">
          <span class="w-4 h-4 shrink-0" v-html="ICON_ALERT"></span>Documentos por Vencer ({{ documentAlerts.length }})
        </h3>
        <div v-for="alert in documentAlerts" :key="alert.documentId" class="flex items-center justify-between py-2 border-b border-coral/10 last:border-0">
          <div class="flex items-center gap-3">
            <span class="w-5 h-5 text-coral shrink-0" v-html="ICON_DOCUMENT"></span>
            <div>
              <div class="text-sm font-bold text-navy">{{ alert.documentName }}</div>
              <div class="text-[10px] text-text-muted">Vence en {{ alert.daysUntilExpiry }} días — {{ alert.expiryDate }}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-coral/10 text-coral shrink-0">Urgente</span>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div class="p-4 border-b border-border flex justify-between items-center">
          <h3 class="font-extrabold text-navy text-sm">Documentos del Expediente</h3>
          <button @click="openNewDocument" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo Documento
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Documento</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Vencimiento</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in documents" :key="doc.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50">
                <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ doc.name }}</td>
                <td class="px-4 py-2.5 text-text-secondary">{{ doc.type }}</td>
                <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ getEmployeeName(doc.employeeId) }}</td>
                <td class="px-4 py-2.5 whitespace-nowrap" :class="isExpiringSoon(doc) ? 'text-coral font-bold' : 'text-text-secondary'">{{ doc.expiryDate || '—' }}</td>
                <td class="px-4 py-2.5 text-right">
                  <button @click="deleteDocument(doc)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="documents.length === 0" class="p-12 text-center">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
          <p class="text-text-muted text-sm">No hay documentos registrados</p>
        </div>
      </div>
    </div>

    <!-- Vacaciones y Permisos -->
    <div v-if="activeTab === 'leaves' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Solicitudes de Vacaciones y Permisos</h3>
        <button @click="openNewLeave" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nueva Solicitud
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Desde</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Hasta</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Días</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in leaveRequests" :key="l.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ getEmployeeName(l.employeeId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ leaveTypeLabel(l.type) }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ l.startDate }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ l.endDate }}</td>
              <td class="px-4 py-2.5 text-right text-text-secondary">{{ l.days }}</td>
              <td class="px-4 py-2.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="leaveStatusClass(l.status)">{{ leaveStatusLabel(l.status) }}</span>
              </td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <div class="flex gap-1 justify-end" v-if="l.status === 'pending'">
                  <button @click="approveLeave(l)" class="inline-flex items-center gap-1 px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_CHECK"></span>Aprobar
                  </button>
                  <button @click="rejectLeave(l)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_XCIRCLE"></span>Rechazar
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="leaveRequests.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_BEACH"></span>
        <p class="text-text-muted text-sm">No hay solicitudes pendientes</p>
      </div>
    </div>

    <!-- Evaluaciones -->
    <div v-if="activeTab === 'reviews' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Evaluaciones de Desempeño</h3>
        <button @click="openNewReview" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nueva Evaluación
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Período</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Puntaje</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reviews" :key="r.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ getEmployeeName(r.employeeId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ r.period || '—' }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ r.reviewDate }}</td>
              <td class="px-4 py-2.5 text-right">
                <span :class="scoreClass(r.score)">{{ r.score ?? '—' }}/10</span>
              </td>
              <td class="px-4 py-2.5">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="r.status === 'completed' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ r.status === 'completed' ? 'Completada' : 'Borrador' }}</span>
              </td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button v-if="r.status === 'draft'" @click="completeReview(r)" class="inline-flex items-center gap-1 px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_CHECK"></span>Completar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="reviews.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_STAR"></span>
        <p class="text-text-muted text-sm">No hay evaluaciones registradas</p>
      </div>
    </div>

    <FormModal
      v-if="formModal"
      :title="formModal.title"
      :fields="formModal.fields"
      :submit-label="formModal.submitLabel"
      :loading="savingForm"
      @close="formModal = null"
      @submit="submitForm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { EmpleadosService, type EmployeeProfile, type Contract, type EmployeeDocument, type LeaveRequest, type PerformanceReview, type Department, type DocumentExpiryAlert } from '@/services/Empleados.service'
import { TeamService } from '@/services/Team.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'

const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_BEACH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m-7.5 6a7.5 7.5 0 0 1 15 0h-15Zm7.5 0v9m-9 0h18"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 21.44a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>'
const ICON_EYE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_POWER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9"/></svg>'
const ICON_XCIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('profiles')
const loading = ref(true)

const tabs = [
  { value: 'profiles', label: 'Expedientes', icon: ICON_USERS },
  { value: 'contracts', label: 'Contratos', icon: ICON_DOCUMENT },
  { value: 'documents', label: 'Documentos', icon: ICON_DOCUMENT },
  { value: 'leaves', label: 'Vacaciones', icon: ICON_BEACH },
  { value: 'reviews', label: 'Evaluaciones', icon: ICON_STAR },
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

const departmentOptions = () => departments.value.map((d) => ({ value: d.id, label: d.name }))

/**
 * Registra un empleado de cero: crea la CUENTA (usuario) y su EXPEDIENTE en un paso.
 * Si el expediente falla tras crear la cuenta, se borra la cuenta para no dejarla huérfana
 * (así el admin puede reintentar sin chocar con "email ya existe").
 */
function openNewEmployee() {
  formModal.value = {
    title: 'Nuevo Empleado', submitLabel: 'Registrar Empleado',
    fields: [
      { key: 'name', label: 'Nombre', required: true, placeholder: 'María Pérez' },
      { key: 'email', label: 'Email', required: true, placeholder: 'maria@hotel.com' },
      { key: 'password', label: 'Contraseña temporal', required: true, placeholder: 'Mínimo 6 caracteres' },
      { key: 'role', label: 'Rol', type: 'select', required: true, default: 'receptionist', options: [
        { value: 'receptionist', label: 'Recepcionista' }, { value: 'housekeeper', label: 'Limpieza' },
        { value: 'maintenance', label: 'Mantenimiento' }, { value: 'supervisor', label: 'Supervisor' },
      ] },
      { key: 'position', label: 'Puesto', placeholder: 'Recepcionista, Camarera…' },
      { key: 'departmentId', label: 'Departamento', type: 'select', options: departmentOptions() },
      { key: 'salary', label: 'Salario', type: 'number', min: 0 },
      { key: 'hireDate', label: 'Fecha de ingreso', type: 'date', default: new Date().toISOString().slice(0, 10) },
    ],
    onSubmit: async (v) => {
      const newUser = await TeamService.create({
        name: String(v.name).trim(), email: String(v.email).trim(),
        password: String(v.password), role: String(v.role), hotelId: hotelId.value ?? '',
      })
      try {
        await EmpleadosService.createProfile({
          userId: newUser.id, position: String(v.position || ''),
          departmentId: (v.departmentId as string) || undefined,
          salary: Number(v.salary) || 0, hireDate: String(v.hireDate || ''),
        })
      } catch (e) {
        await TeamService.remove(newUser.id).catch(() => {})   // rollback de la cuenta huérfana
        throw e
      }
    },
  }
}

/** Ver/editar el expediente: abre el mismo modal precargado con los datos del empleado. */
function openProfile(emp: EmployeeProfile) {
  formModal.value = {
    title: `Editar: ${emp.userName || emp.position || 'empleado'}`, submitLabel: 'Guardar',
    fields: [
      { key: 'position', label: 'Puesto', default: emp.position || '' },
      { key: 'departmentId', label: 'Departamento', type: 'select', default: emp.departmentId || '', options: departmentOptions() },
      { key: 'salary', label: 'Salario', type: 'number', min: 0, default: emp.salary || 0 },
      { key: 'hireDate', label: 'Fecha de ingreso', type: 'date', default: (emp.hireDate || '').slice(0, 10) },
    ],
    onSubmit: (v) => EmpleadosService.updateProfile(emp.id, v),
  }
}

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

// ─── Formularios (modal genérico dirigido por estado) ───
type FormValues = Record<string, string | number>
const formModal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: FormValues) => Promise<unknown> } | null>(null)
const savingForm = ref(false)

const employeeOptions = () => profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id }))

function openNewContract() {
  formModal.value = {
    title: 'Nuevo Contrato', submitLabel: 'Crear Contrato',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'full_time', options: [
        { value: 'full_time', label: 'Tiempo completo' }, { value: 'part_time', label: 'Medio tiempo' },
        { value: 'temporary', label: 'Temporal' }, { value: 'contractor', label: 'Por servicios' },
      ] },
      { key: 'startDate', label: 'Fecha inicio', type: 'date', required: true },
      { key: 'endDate', label: 'Fecha fin (opcional)', type: 'date' },
      { key: 'salary', label: 'Salario', type: 'number', required: true, min: 0 },
      { key: 'currency', label: 'Moneda', default: 'DOP' },
      { key: 'position', label: 'Puesto' },
    ],
    onSubmit: (v) => EmpleadosService.createContract(v),
  }
}

function openNewDocument() {
  formModal.value = {
    title: 'Nuevo Documento', submitLabel: 'Guardar Documento',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'id', options: [
        { value: 'id', label: 'Identificación' }, { value: 'contract', label: 'Contrato' },
        { value: 'certificate', label: 'Certificado' }, { value: 'other', label: 'Otro' },
      ] },
      { key: 'name', label: 'Nombre', required: true, placeholder: 'Cédula, Título…' },
      { key: 'fileUrl', label: 'URL del archivo', placeholder: 'https://…' },
      { key: 'expiryDate', label: 'Vence (opcional)', type: 'date' },
    ],
    onSubmit: (v) => EmpleadosService.createDocument(v),
  }
}

function openNewLeave() {
  formModal.value = {
    title: 'Nueva Solicitud de Ausencia', submitLabel: 'Crear Solicitud',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'vacation', options: [
        { value: 'vacation', label: 'Vacaciones' }, { value: 'permission', label: 'Permiso' },
        { value: 'sick_leave', label: 'Enfermedad' }, { value: 'maternity', label: 'Maternidad' }, { value: 'other', label: 'Otro' },
      ] },
      { key: 'startDate', label: 'Desde', type: 'date', required: true },
      { key: 'endDate', label: 'Hasta', type: 'date', required: true },
      { key: 'days', label: 'Días', type: 'number', required: true, min: 1, default: 1 },
      { key: 'reason', label: 'Motivo', type: 'textarea' },
    ],
    onSubmit: (v) => EmpleadosService.createLeaveRequest(v),
  }
}

function openNewReview() {
  formModal.value = {
    title: 'Nueva Evaluación', submitLabel: 'Crear Evaluación',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'reviewDate', label: 'Fecha', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
      { key: 'period', label: 'Período', placeholder: '2026-Q3' },
      { key: 'score', label: 'Puntaje (1-10)', type: 'number', min: 1 },
      { key: 'strengths', label: 'Fortalezas', type: 'textarea' },
      { key: 'improvements', label: 'A mejorar', type: 'textarea' },
    ],
    onSubmit: (v) => EmpleadosService.createReview({ ...v, reviewerId: auth.user?.id ?? '' } as FormValues),
  }
}

async function submitForm(values: FormValues) {
  if (!formModal.value) return
  savingForm.value = true
  try {
    await formModal.value.onSubmit(values)
    toast.success('Guardado')
    formModal.value = null
    loadData()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    savingForm.value = false
  }
}
</script>
