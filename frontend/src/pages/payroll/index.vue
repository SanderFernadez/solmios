<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Nómina Automatizada</h2>
        <p class="text-sm text-text-muted mt-0.5">Cálculo, liquidación, deducciones y recibos de pago</p>
      </div>
      <button @click="openNewRun" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Nueva Liquidación
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10"><span class="w-5 h-5 text-navy" v-html="ICON_USERS"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-navy truncate">{{ lastRun?.employeeCount ?? 0 }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Empleados</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10"><span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-teal truncate">${{ (lastRun?.totalGross ?? 0).toLocaleString() }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Bruto Total</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10"><span class="w-5 h-5 text-coral" v-html="ICON_MINUS_CIRCLE"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-coral truncate">${{ (lastRun?.totalDeductions ?? 0).toLocaleString() }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Deducciones</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10"><span class="w-5 h-5 text-cyan" v-html="ICON_CHECK_CIRCLE"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-cyan truncate">${{ (lastRun?.totalNet ?? 0).toLocaleString() }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Neto a Pagar</div></div>
        </div>
      </div>
    </div>

    <div class="flex gap-2 mb-6 flex-wrap">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span class="w-4 h-4 shrink-0" v-html="tab.icon"></span>{{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando...</span>
    </div>

    <!-- Liquidaciones -->
    <div v-if="activeTab === 'runs' && !loading">
      <div v-if="runs.length === 0 && !loading" class="card p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_WALLET"></span>
        <p class="text-sm text-text-muted font-bold mb-4">No hay liquidaciones. Creá la primera para este período.</p>
        <button @click="openNewRun" class="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan text-navy rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Nueva Liquidación
        </button>
      </div>

      <div v-for="run in runs" :key="run.id" class="card p-5 mb-3">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div class="font-extrabold text-navy">Período {{ run.period }}</div>
            <div class="text-xs text-text-muted">{{ run.startDate }} → {{ run.endDate }} · Pago: {{ run.paymentDate }}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold px-3 py-1 rounded-full" :class="runStatusClass(run.status)">{{ runStatusLabel(run.status) }}</span>
            <span class="text-sm font-extrabold text-navy">${{ run.totalNet.toLocaleString() }}</span>
          </div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button v-if="run.status === 'draft'" @click="calculateRun(run)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-bold hover:bg-teal-light cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_CALC"></span>Calcular
          </button>
          <button v-if="run.status === 'calculated'" @click="approveRun(run)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_CHECK"></span>Aprobar
          </button>
          <button v-if="run.status === 'approved'" @click="markAsPaid(run)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-bold hover:bg-teal-light cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_WALLET"></span>Marcar Pagada
          </button>
          <button v-if="run.status !== 'paid' && run.status !== 'cancelled'" @click="cancelRun(run)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_XCIRCLE"></span>Cancelar
          </button>
          <button @click="viewDetails(run)" class="inline-flex items-center gap-1 px-3 py-1.5 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 cursor-pointer">
            <span class="w-3 h-3 shrink-0" v-html="ICON_EYE"></span>Ver Detalle
          </button>
        </div>
      </div>
    </div>

    <!-- Config -->
    <div v-if="activeTab === 'config' && !loading" class="card p-5">
      <h3 class="font-extrabold text-navy text-sm mb-4">Configuración de Nómina</h3>
      <div v-if="config" class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-[11px] font-bold text-navy uppercase mb-1">Frecuencia de pago</label>
          <select v-model="config.paymentFrequency" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
            <option value="monthly">Mensual</option>
          </select>
          <p class="text-[10px] text-text-muted mt-1">Define cuánto del sueldo mensual se paga por liquidación (semanal ≈ ¼, quincenal ½, mensual completo).</p>
        </div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Día de Pago</label><input v-model.number="config.paymentDay" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Horas Extra (x)</label><input v-model.number="config.overtimeMultiplier" type="number" step="0.1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguridad Social (%)</label><input v-model.number="config.socialSecurityRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguro Salud (%)</label><input v-model.number="config.healthInsuranceRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Moneda</label><input v-model="config.currency" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy"></div>
      </div>
      <button @click="saveConfig" class="flex items-center gap-1.5 mt-4 px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_SAVE"></span>Guardar Configuración
      </button>
    </div>

    <!-- Conceptos -->
    <div v-if="activeTab === 'concepts' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Conceptos de Nómina</h3>
        <button @click="openNewConcept" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo
        </button>
      </div>
      <div v-if="concepts.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_LIST"></span>
        <p class="text-text-muted text-sm">No hay conceptos de nómina configurados</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Código</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Nombre</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Método</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Valor</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Sistema</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in concepts" :key="c.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ c.code }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ c.name }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ c.type }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ c.calculationMethod }}</td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.value }}{{ c.formula ? ` (${c.formula})` : '' }}</td>
              <td class="px-4 py-2.5 text-right">
                <span v-if="c.system" class="text-[10px] bg-navy/5 text-text-muted px-2 py-1 rounded-full">Sistema</span>
                <button v-else @click="deleteConcept(c)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Nueva Liquidación -->
    <Teleport to="body">
      <div v-if="showNewRunModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0" v-html="ICON_PLUS"></span>Nueva Liquidación
            </h3>
            <button @click="showNewRunModal = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Período</label>
              <input v-model="newRunForm.period" type="month" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fecha inicio</label>
                <input v-model="newRunForm.startDate" type="date" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fecha fin</label>
                <input v-model="newRunForm.endDate" type="date" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fecha de pago</label>
              <input v-model="newRunForm.paymentDate" type="date" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <p v-if="newRunError" class="text-xs font-bold text-coral">{{ newRunError }}</p>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="showNewRunModal = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="createRun" :disabled="creatingRun" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ creatingRun ? 'Creando...' : 'Crear Liquidación' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <PayrollDetailModal
      v-if="detailRun"
      :run="detailRun"
      @close="detailRun = null"
    />

    <ConfirmModal
      v-if="confirmDialog"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-label="confirmDialog.confirmLabel"
      :danger="confirmDialog.danger"
      :loading="confirmLoading"
      @confirm="runConfirm"
      @close="confirmDialog = null"
    />

    <CalculatePayrollModal
      v-if="calcRun"
      :run="calcRun"
      @close="calcRun = null"
      @calculated="onCalculated"
    />

    <FormModal
      v-if="conceptModal"
      title="Nuevo Concepto"
      :fields="conceptFields"
      :loading="savingConcept"
      submit-label="Crear Concepto"
      @close="conceptModal = false"
      @submit="createConcept"
    />
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PayrollService, type PayrollRun, type PayrollConfig, type PayrollConcept } from '@/services/Payroll.service'
import CalculatePayrollModal from '@/components/features/CalculatePayrollModal.vue'
import PayrollDetailModal from '@/components/features/PayrollDetailModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_MINUS_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 1.5 1.5 3.75-3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_SETTINGS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.752.43.992l1.005.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.216.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.752-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_LIST = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_CALC = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="3" width="15" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 7.5h8M8 12h1.5m3.25 0h1.5m3.25 0h0M8 15.75h1.5m3.25 0h1.5m3.25 0h0M8 19.5h1.5m3.25 0h1.5m3.25 0h0"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_XCIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_EYE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_SAVE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3h6.982c.478 0 .717 0 .942.055.2.049.39.129.564.237.197.122.367.292.706.632l2.082 2.082c.34.34.51.51.632.706.108.175.188.365.237.564.055.225.055.464.055.942V16.2c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C17.72 21 16.88 21 15.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21v-6.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 .75.75V21M7.5 3v3.75a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75V3"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('runs')
const loading = ref(true)

const tabs = [
  { value: 'runs', label: 'Liquidaciones', icon: ICON_WALLET },
  { value: 'config', label: 'Configuración', icon: ICON_SETTINGS },
  { value: 'concepts', label: 'Conceptos', icon: ICON_LIST },
]

const runs = ref<PayrollRun[]>([])
const config = ref<PayrollConfig | null>(null)
const concepts = ref<PayrollConcept[]>([])

const calcRun = ref<PayrollRun | null>(null)
const detailRun = ref<PayrollRun | null>(null)
const showNewRunModal = ref(false)
const creatingRun = ref(false)
const newRunError = ref('')
const newRunForm = ref({ period: '', startDate: '', endDate: '', paymentDate: '' })

const lastRun = computed(() => runs.value[0])

function runStatusClass(s: string) {
  return { draft: 'bg-gray-100 text-gray-500', calculated: 'bg-blue/10 text-blue', approved: 'bg-gold/10 text-gold', paid: 'bg-teal/10 text-teal', cancelled: 'bg-coral/10 text-coral' }[s] ?? 'bg-gray-100'
}
function runStatusLabel(s: string) {
  return { draft: 'Borrador', calculated: 'Calculado', approved: 'Aprobado', paid: 'Pagado', cancelled: 'Cancelado' }[s] ?? s
}

async function loadData() {
  loading.value = true
  try {
    const [r, c, cn] = await Promise.all([PayrollService.listRuns(hotelId.value), PayrollService.getConfig(hotelId.value), PayrollService.listConcepts(hotelId.value)])
    runs.value = r; config.value = c; concepts.value = cn
  } catch { toast.error('Error al cargar') }
  finally { loading.value = false }
}

onMounted(loadData)

function openNewRun() {
  const today = new Date()
  const period = today.toISOString().slice(0, 7)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)
  newRunForm.value = { period, startDate: `${period}-01`, endDate: monthEnd, paymentDate: today.toISOString().slice(0, 10) }
  newRunError.value = ''
  showNewRunModal.value = true
}

async function createRun() {
  const { period, startDate, endDate, paymentDate } = newRunForm.value
  if (!period || !startDate || !endDate || !paymentDate) { newRunError.value = 'Completá todos los campos'; return }
  creatingRun.value = true
  newRunError.value = ''
  try {
    await PayrollService.createRun(hotelId.value!, { period, startDate, endDate, paymentDate })
    toast.success('Liquidación creada')
    showNewRunModal.value = false
    loadData()
  } catch (e: unknown) {
    newRunError.value = e instanceof Error ? e.message : 'Error al crear la liquidación'
  } finally {
    creatingRun.value = false
  }
}

function calculateRun(run: PayrollRun) {
  calcRun.value = run
}

function onCalculated(result: { employeeCount: number; totalNet: number }) {
  toast.success(`Nómina calculada: ${result.employeeCount} empleados, $${result.totalNet.toLocaleString()} neto`)
  calcRun.value = null
  loadData()
}

// Confirmaciones con modal propio (no el alert del navegador).
const confirmDialog = ref<{ title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> } | null>(null)
const confirmLoading = ref(false)

async function runConfirm() {
  if (!confirmDialog.value) return
  confirmLoading.value = true
  try { await confirmDialog.value.onConfirm() }
  finally { confirmLoading.value = false; confirmDialog.value = null }
}

function approveRun(run: PayrollRun) {
  confirmDialog.value = {
    title: 'Aprobar liquidación',
    message: `¿Aprobar la liquidación del período ${run.period} por $${run.totalNet.toLocaleString()} neto? Se generan los recibos.`,
    confirmLabel: 'Aprobar',
    onConfirm: async () => {
      try { await PayrollService.approve(run.id); toast.success('Nómina aprobada — recibos generados'); loadData() }
      catch { toast.error('Error al aprobar') }
    },
  }
}

function markAsPaid(run: PayrollRun) {
  confirmDialog.value = {
    title: 'Marcar como pagada',
    message: `¿Marcar como pagada la liquidación del período ${run.period}? Se asienta el egreso en gastos.`,
    confirmLabel: 'Marcar pagada',
    onConfirm: async () => {
      try { await PayrollService.markAsPaid(run.id); toast.success('Pago registrado'); loadData() }
      catch { toast.error('Error') }
    },
  }
}

function cancelRun(run: PayrollRun) {
  confirmDialog.value = {
    title: 'Cancelar liquidación',
    message: `¿Cancelar la liquidación del período ${run.period}? Esta acción no se puede deshacer.`,
    confirmLabel: 'Sí, cancelar', danger: true,
    onConfirm: async () => {
      try { await PayrollService.cancel(run.id); toast.success('Liquidación cancelada'); loadData() }
      catch { toast.error('Error al cancelar') }
    },
  }
}

function viewDetails(run: PayrollRun) { detailRun.value = run }
async function saveConfig() { try { await PayrollService.updateConfig(hotelId.value!, config.value!); toast.success('Configuración guardada') } catch { toast.error('Error') } }

const conceptModal = ref(false)
const savingConcept = ref(false)
const conceptFields: FormField[] = [
  { key: 'code', label: 'Código', required: true, placeholder: 'OT, BONO…' },
  { key: 'name', label: 'Nombre', required: true, placeholder: 'Horas extra' },
  { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'earning', options: [
    { value: 'earning', label: 'Percepción' }, { value: 'deduction', label: 'Deducción' },
    { value: 'contribution', label: 'Aporte' }, { value: 'tax', label: 'Impuesto' },
  ] },
  { key: 'calculationMethod', label: 'Cálculo', type: 'select', required: true, default: 'fixed', options: [
    { value: 'fixed', label: 'Monto fijo' }, { value: 'percentage', label: 'Porcentaje' },
    { value: 'formula', label: 'Fórmula' }, { value: 'hours_based', label: 'Por horas' },
  ] },
  { key: 'value', label: 'Valor', type: 'number', min: 0 },
]

function openNewConcept() { conceptModal.value = true }

async function createConcept(values: Record<string, string | number>) {
  savingConcept.value = true
  try {
    await PayrollService.createConcept(hotelId.value!, values as unknown as Partial<PayrollConcept>)
    toast.success('Concepto creado')
    conceptModal.value = false
    loadData()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al crear el concepto')
  } finally {
    savingConcept.value = false
  }
}

async function deleteConcept(c: PayrollConcept) {
  if (!confirm(`¿Eliminar el concepto "${c.code}"?`)) return
  try { await PayrollService.deleteConcept(c.id); toast.success('Concepto eliminado'); loadData() }
  catch { toast.error('Error al eliminar el concepto') }
}
</script>
