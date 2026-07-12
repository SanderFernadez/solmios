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
      <div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span class="text-[11px] text-text-muted">{{ profiles.length }} {{ showInactive ? 'empleados (incluye inactivos)' : 'empleados activos' }}</span>
        <label class="inline-flex items-center gap-2 cursor-pointer text-[11px] font-bold text-text-secondary select-none">
          <input type="checkbox" v-model="showInactive" @change="loadData" class="accent-cyan cursor-pointer" />
          Ver inactivos
        </label>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Cargo</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Depto</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Contrato</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Salario</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in profiles" :key="emp.id" @click="openProfile(emp)"
              class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors cursor-pointer" :class="{ 'opacity-60': !emp.active }">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ emp.userName || emp.position || emp.userId }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ emp.position || '—' }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ getDeptName(emp.departmentId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ emp.contractType || '—' }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-navy whitespace-nowrap">${{ emp.salary?.toLocaleString() || '—' }}</td>
              <td class="px-4 py-2.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="emp.active ? 'bg-teal/10 text-teal' : 'bg-text-muted/15 text-text-muted'">{{ emp.active ? 'Activo' : 'Inactivo' }}</span>
              </td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <button @click.stop="openProfile(emp)" class="inline-flex items-center gap-1 px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver
                </button>
                <button v-if="emp.active" @click.stop="deactivateEmployee(emp)" class="inline-flex items-center gap-1 ml-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_POWER"></span>Desactivar
                </button>
                <button v-else @click.stop="reactivateEmployee(emp)" class="inline-flex items-center gap-1 ml-1 px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_POWER"></span>Reactivar
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
                <td class="px-4 py-2.5 text-right whitespace-nowrap">
                  <a v-if="doc.fileUrl" :href="doc.fileUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 cursor-pointer mr-1">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver
                  </a>
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
                <div class="inline-flex items-center gap-1.5">
                  <template v-if="r.status === 'draft'">
                    <button @click="openEditReview(r)" class="inline-flex items-center gap-1 px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 cursor-pointer">
                      <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Editar
                    </button>
                    <button @click="completeReview(r)" class="inline-flex items-center gap-1 px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 cursor-pointer">
                      <span class="w-3 h-3 shrink-0" v-html="ICON_CHECK"></span>Completar
                    </button>
                  </template>
                  <button v-else @click="openViewReview(r)" class="inline-flex items-center gap-1 px-2 py-1 bg-surface text-text-secondary rounded-lg text-[10px] font-bold hover:bg-border/40 cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver
                  </button>
                </div>
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
      :read-only="formModal.readOnly"
      @close="formModal = null"
      @submit="submitForm"
    />

    <ConfirmModal
      v-if="confirmModal"
      :title="confirmModal.title"
      :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel"
      :danger="confirmModal.danger"
      :loading="confirmBusy"
      @confirm="runConfirm"
      @close="confirmModal = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { EmpleadosService, type EmployeeProfile, type Contract, type EmployeeDocument, type LeaveRequest, type PerformanceReview, type Department, type DocumentExpiryAlert, type LeaveType, type JobPosition, type ContractType } from '@/services/Empleados.service'
import { TeamService } from '@/services/Team.service'
import { RolesService, type Role } from '@/services/Roles.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'

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
const router = useRouter()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('profiles')
const loading = ref(true)

const tabs = [
  { value: 'profiles', label: 'Expedientes', icon: ICON_USERS },
  { value: 'contracts', label: 'Contratos', icon: ICON_DOCUMENT },
  { value: 'documents', label: 'Documentos', icon: ICON_DOCUMENT },
  { value: 'leaves', label: 'Vacaciones y permisos', icon: ICON_BEACH },
  { value: 'reviews', label: 'Evaluaciones', icon: ICON_STAR },
]

const profiles = ref<EmployeeProfile[]>([])
const contracts = ref<Contract[]>([])
const documents = ref<EmployeeDocument[]>([])
const leaveRequests = ref<LeaveRequest[]>([])
const showInactive = ref(false)
const leaveTypes = ref<LeaveType[]>([])
const jobPositions = ref<JobPosition[]>([])
const contractTypes = ref<ContractType[]>([])
const reviews = ref<PerformanceReview[]>([])
const departments = ref<Department[]>([])
const documentAlerts = ref<DocumentExpiryAlert[]>([])
const customRoles = ref<Role[]>([])

// Roles del sistema (nombre-máquina) + los personalizados del hotel. El valor es el `name` que se
// guarda en users.role: para los del sistema es la máquina (receptionist…), para los custom es su nombre.
const SYSTEM_ROLE_OPTIONS = [
  { value: 'receptionist', label: 'Recepcionista' },
  { value: 'housekeeper', label: 'Limpieza' },
  { value: 'maintenance', label: 'Mantenimiento' },
  { value: 'supervisor', label: 'Supervisor' },
]
const roleOptions = () => [
  ...SYSTEM_ROLE_OPTIONS,
  ...customRoles.value.map((r) => ({ value: r.name, label: `${r.icon ?? '👤'} ${r.name}` })),
]

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
  const configured = leaveTypes.value.find((t) => t.code === type)
  if (configured) return configured.name
  return { vacation: 'Vacaciones', permission: 'Permiso', sick_leave: 'Licencia médica', maternity: 'Maternidad', other: 'Otro' }[type] ?? type
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
  const profileQs = { ...(qs ?? {}), ...(showInactive.value ? { includeInactive: 'true' } : {}) }
  try {
    const [profilesRes, contractsRes, documentsRes, leavesRes, reviewsRes, alertsRes] = await Promise.all([
      EmpleadosService.listProfiles(profileQs),
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
    try { customRoles.value = await RolesService.list() } catch { /* optional */ }
    try { leaveTypes.value = await EmpleadosService.listLeaveTypes() } catch { /* optional */ }
    try { jobPositions.value = await EmpleadosService.listJobPositions() } catch { /* optional */ }
    try { contractTypes.value = await EmpleadosService.listContractTypes() } catch { /* optional */ }
  } catch { toast.error('Error al cargar datos') }
  finally { loading.value = false }
}

onMounted(loadData)

// ─── Actions ────────────────────────────────────────────

function openOrgChart() { router.push('/panel/rrhh/organigrama') }

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
      { key: 'name', label: 'Nombre', required: true, maxLength: 80, placeholder: 'María Pérez' },
      { key: 'email', label: 'Email', type: 'email', required: true, maxLength: 120, placeholder: 'maria@hotel.com' },
      { key: 'phone', label: 'Teléfono', type: 'tel', maxLength: 20, placeholder: '809-555-0000' },
      { key: 'password', label: 'Contraseña temporal', type: 'password', required: true, minLength: 6, maxLength: 72, placeholder: 'Mínimo 6 caracteres' },
      // El puesto lo define el Rol (feedback #169): un solo lugar para la función del empleado.
      { key: 'role', label: 'Rol', type: 'select', required: true, default: 'receptionist', options: roleOptions() },
      { key: 'departmentId', label: 'Departamento', type: 'select', options: departmentOptions() },
      { key: 'salary', label: 'Salario', type: 'number', min: 0 },
      { key: 'hireDate', label: 'Fecha de ingreso', type: 'date', default: new Date().toISOString().slice(0, 10) },
    ],
    onSubmit: async (v) => {
      const newUser = await TeamService.create({
        name: String(v.name).trim(), email: String(v.email).trim(),
        phone: String(v.phone || '').trim() || undefined,
        password: String(v.password), role: String(v.role), hotelId: hotelId.value ?? '',
      })
      try {
        await EmpleadosService.createProfile({
          userId: newUser.id,
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
      { key: 'departmentId', label: 'Departamento', type: 'select', default: emp.departmentId || '', options: departmentOptions() },
      { key: 'jobPositionId', label: 'Puesto', type: 'select', default: emp.jobPositionId || '', options: jobPositionOptions() },
      { key: 'salary', label: 'Salario', type: 'number', min: 0, default: emp.salary || 0 },
      { key: 'hireDate', label: 'Fecha de ingreso', type: 'date', default: (emp.hireDate || '').slice(0, 10) },
      { key: 'birthDate', label: 'Fecha de nacimiento', type: 'date', default: (emp.birthDate || '').slice(0, 10) },
      { key: 'nationality', label: 'Nacionalidad', maxLength: 60, default: emp.nationality || '' },
      { key: 'maritalStatus', label: 'Estado civil', type: 'select', default: emp.maritalStatus || '', options: MARITAL_OPTIONS },
      { key: 'gender', label: 'Género', type: 'select', default: emp.gender || '', options: GENDER_OPTIONS },
      { key: 'education', label: 'Educación', maxLength: 100, default: emp.education || '' },
    ],
    onSubmit: (v) => EmpleadosService.updateProfile(emp.id, v),
  }
}

const jobPositionOptions = () => jobPositions.value.map((j) => ({ value: j.id, label: j.name }))
const MARITAL_OPTIONS = [
  { value: 'single', label: 'Soltero/a' }, { value: 'married', label: 'Casado/a' },
  { value: 'divorced', label: 'Divorciado/a' }, { value: 'widowed', label: 'Viudo/a' },
]
const GENDER_OPTIONS = [
  { value: 'female', label: 'Femenino' }, { value: 'male', label: 'Masculino' }, { value: 'other', label: 'Otro' },
]

// #174: modal estilado (no confirm() nativo). Desactivar es reversible → aclara que NO borra la cuenta.
function deactivateEmployee(emp: EmployeeProfile) {
  askConfirm({
    title: 'Desactivar empleado',
    message: `${emp.userName || emp.position} pasará a inactivo. No se borra: la cuenta y el legajo se conservan y podés reactivarlo cuando quieras.`,
    confirmLabel: 'Desactivar', danger: true,
    run: async () => { await EmpleadosService.deactivateProfile(emp.id); toast.success('Empleado desactivado') },
  })
}

async function reactivateEmployee(emp: EmployeeProfile) {
  try { await EmpleadosService.reactivateProfile(emp.id); toast.success('Empleado reactivado'); loadData() }
  catch { toast.error('Error al reactivar') }
}

function terminateContract(c: Contract) {
  askConfirm({
    title: 'Terminar contrato',
    message: `¿Terminar el contrato de ${getEmployeeName(c.employeeId)}?`,
    confirmLabel: 'Terminar', danger: true,
    run: async () => { await EmpleadosService.terminateContract(c.id); toast.success('Contrato terminado') },
  })
}

function deleteDocument(doc: EmployeeDocument) {
  askConfirm({
    title: 'Eliminar documento',
    message: `¿Eliminar el documento "${doc.name}"? Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => { await EmpleadosService.deleteDocument(doc.id); toast.success('Documento eliminado') },
  })
}

async function approveLeave(l: LeaveRequest) {
  try { await EmpleadosService.approveLeaveRequest(l.id); toast.success('Solicitud aprobada'); loadData() }
  catch { toast.error('Error al aprobar') }
}

function rejectLeave(l: LeaveRequest) {
  // Modal con motivo OBLIGATORIO (#190/#191): no se rechaza sin justificar.
  formModal.value = {
    title: 'Rechazar solicitud', submitLabel: 'Rechazar',
    fields: [{ key: 'reason', label: 'Motivo del rechazo', type: 'textarea', required: true, placeholder: 'Explicá por qué se rechaza…' }],
    onSubmit: (v) => EmpleadosService.rejectLeaveRequest(l.id, String(v.reason ?? '')),
  }
}

async function completeReview(r: PerformanceReview) {
  try { await EmpleadosService.completeReview(r.id); toast.success('Evaluación completada'); loadData() }
  catch { toast.error('Error al completar') }
}

// ─── Formularios (modal genérico dirigido por estado) ───
type FormValues = Record<string, string | number>
const formModal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit?: (v: FormValues) => Promise<unknown>; readOnly?: boolean } | null>(null)
const savingForm = ref(false)

// Confirmación estilada (reemplaza confirm() nativo, #174).
const confirmModal = ref<{ title: string; message: string; confirmLabel?: string; danger?: boolean; run: () => Promise<unknown> } | null>(null)
const confirmBusy = ref(false)
function askConfirm(cfg: { title: string; message: string; confirmLabel?: string; danger?: boolean; run: () => Promise<unknown> }) { confirmModal.value = cfg }
async function runConfirm() {
  if (!confirmModal.value) return
  confirmBusy.value = true
  try { await confirmModal.value.run(); confirmModal.value = null; loadData() }
  catch (e) { toast.error(e instanceof Error ? e.message : 'La acción falló') }
  finally { confirmBusy.value = false }
}

const employeeOptions = () => profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id }))
const contractTypeOptions = () => contractTypes.value.length
  ? contractTypes.value.map((t) => ({ value: t.code, label: t.name }))
  : [{ value: 'full_time', label: 'Tiempo completo' }, { value: 'part_time', label: 'Medio tiempo' }]
/** Monedas para elegir en un contrato. DOP primero (salario local). */
const CURRENCIES = [
  { value: 'DOP', label: 'DOP — Peso Dominicano' },
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'CAD', label: 'CAD — Dólar Canadiense' },
  { value: 'GBP', label: 'GBP — Libra' },
  { value: 'MXN', label: 'MXN — Peso Mexicano' },
]

function openNewContract() {
  formModal.value = {
    title: 'Nuevo Contrato', submitLabel: 'Crear Contrato',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: contractTypes.value[0]?.code ?? 'full_time', options: contractTypeOptions() },
      { key: 'startDate', label: 'Fecha inicio', type: 'date', required: true },
      { key: 'endDate', label: 'Fecha fin (opcional)', type: 'date' },
      { key: 'salary', label: 'Salario', type: 'number', required: true, min: 0 },
      { key: 'currency', label: 'Moneda', type: 'select', default: 'DOP', options: CURRENCIES },
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
      { key: 'name', label: 'Nombre', required: true, maxLength: 120, placeholder: 'Cédula, Título…' },
      { key: 'fileData', label: 'Archivo', type: 'file', required: true, accept: '.pdf,image/*' },
      { key: 'expiryDate', label: 'Vence (opcional)', type: 'date' },
    ],
    onSubmit: (v) => EmpleadosService.createDocument({
      employeeId: v.employeeId, type: v.type, name: v.name, expiryDate: v.expiryDate,
      fileData: v.fileData, fileName: v.fileDataName,
    }),
  }
}

function leaveTypeOptions() {
  const opts = leaveTypes.value.map((t) => ({ value: t.code, label: t.name }))
  return opts.length ? opts : [
    { value: 'vacation', label: 'Vacaciones' }, { value: 'permission', label: 'Permiso' },
    { value: 'sick_leave', label: 'Licencia médica' }, { value: 'maternity', label: 'Maternidad' }, { value: 'other', label: 'Otro' },
  ]
}

function openNewLeave() {
  formModal.value = {
    title: 'Nueva Solicitud de Ausencia', submitLabel: 'Crear Solicitud',
    // Sin campo "Días": el servidor lo calcula desde el rango, descontando festivos (#188).
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'vacation', options: leaveTypeOptions() },
      { key: 'startDate', label: 'Desde', type: 'date', required: true },
      { key: 'endDate', label: 'Hasta', type: 'date', required: true },
      { key: 'reason', label: 'Motivo', type: 'textarea' },
    ],
    onSubmit: (v) => {
      const leaveTypeId = leaveTypes.value.find((t) => t.code === v.type)?.id
      return EmpleadosService.createLeaveRequest({ ...v, leaveTypeId })
    },
  }
}

function reviewFields(r?: PerformanceReview): FormField[] {
  return [
    { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions(), default: r?.employeeId },
    { key: 'reviewDate', label: 'Fecha', type: 'date', required: true, default: r?.reviewDate ?? new Date().toISOString().slice(0, 10) },
    { key: 'period', label: 'Período', placeholder: '2026-Q3', default: r?.period },
    // Puntaje 1-10 con tope validado en el modal y en el backend (#192).
    { key: 'score', label: 'Puntaje del evaluador (1-10)', type: 'number', min: 1, max: 10, default: r?.score ?? undefined },
    { key: 'strengths', label: 'Fortalezas', type: 'textarea', default: r?.strengths },
    { key: 'improvements', label: 'A mejorar', type: 'textarea', default: r?.improvements },
    { key: 'goals', label: 'Objetivos del próximo período', type: 'textarea', default: r?.goals },
    { key: 'selfScore', label: 'Auto-evaluación del empleado (1-10)', type: 'number', min: 1, max: 10, default: r?.selfScore ?? undefined },
    { key: 'selfComments', label: 'Comentarios del empleado', type: 'textarea', default: r?.selfComments },
  ]
}

function openNewReview() {
  formModal.value = {
    title: 'Nueva Evaluación', submitLabel: 'Crear Evaluación',
    fields: reviewFields(),
    onSubmit: (v) => EmpleadosService.createReview({ ...v, reviewerId: auth.user?.id ?? '' } as FormValues),
  }
}

// #193 Borrador editable
function openEditReview(r: PerformanceReview) {
  formModal.value = {
    title: 'Editar Evaluación (borrador)', submitLabel: 'Guardar cambios',
    fields: reviewFields(r),
    onSubmit: (v) => EmpleadosService.updateReview(r.id, v),
  }
}

// #194 Completada = solo lectura
function openViewReview(r: PerformanceReview) {
  formModal.value = {
    title: 'Evaluación (solo lectura)', submitLabel: '',
    fields: reviewFields(r),
    readOnly: true,
  }
}

async function submitForm(values: FormValues) {
  if (!formModal.value || !formModal.value.onSubmit) return
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
