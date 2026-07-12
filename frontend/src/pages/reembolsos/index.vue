<template>
  <div>
    <div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-black text-navy">Reembolsos</h2>
        <p class="text-sm text-text-muted mt-0.5">Gastos del personal — enviar, aprobar y reintegrar</p>
      </div>
      <button @click="openNew" class="flex items-center gap-1.5 px-4 py-2 bg-cyan text-navy rounded-xl text-xs font-bold hover:shadow-lg cursor-pointer">
        + Nuevo reembolso
      </button>
    </div>

    <div v-if="totals" class="grid grid-cols-3 gap-4 mb-6">
      <div class="card p-4"><div class="text-lg font-black text-gold">{{ money(totals.submitted.amount) }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1">Enviados · {{ totals.submitted.count }}</div></div>
      <div class="card p-4"><div class="text-lg font-black text-cyan">{{ money(totals.approved.amount) }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1">Por pagar · {{ totals.approved.count }}</div></div>
      <div class="card p-4"><div class="text-lg font-black text-teal">{{ money(totals.paid.amount) }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1">Pagados · {{ totals.paid.count }}</div></div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Descripción</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Monto</th>
              <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in claims" :key="c.id" class="border-b border-border/60 last:border-0 hover:bg-surface/50">
              <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ nameOf(c.employeeId) }}</td>
              <td class="px-4 py-2.5 text-text-secondary">{{ c.description }}<span v-if="c.category" class="text-[10px] text-text-muted"> · {{ c.category }}</span></td>
              <td class="px-4 py-2.5 text-text-secondary whitespace-nowrap">{{ c.date }}</td>
              <td class="px-4 py-2.5 text-right font-bold text-navy whitespace-nowrap">{{ money(c.amount, c.currency) }}</td>
              <td class="px-4 py-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
              <td class="px-4 py-2.5 text-right whitespace-nowrap">
                <div class="inline-flex items-center gap-1.5">
                  <button v-if="c.status === 'draft'" @click="submit(c)" class="text-[10px] font-bold px-2 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 cursor-pointer">Enviar</button>
                  <button v-if="c.status === 'submitted'" @click="approve(c)" class="text-[10px] font-bold px-2 py-1 rounded-lg bg-teal/10 text-teal hover:bg-teal/20 cursor-pointer">Aprobar</button>
                  <button v-if="c.status === 'approved'" @click="pay(c)" class="text-[10px] font-bold px-2 py-1 rounded-lg bg-cyan/20 text-navy hover:bg-cyan/30 cursor-pointer">Pagar</button>
                  <button v-if="c.status === 'submitted'" @click="reject(c)" class="text-[10px] font-bold px-2 py-1 rounded-lg bg-coral/10 text-coral hover:bg-coral/20 cursor-pointer">Rechazar</button>
                  <span v-if="c.status === 'rejected'" class="text-[10px] text-coral">{{ c.rejectReason }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="claims.length === 0" class="p-12 text-center text-sm text-text-muted">No hay reembolsos registrados</div>
    </div>

    <FormModal
      v-if="formModal"
      :title="formModal.title"
      :fields="formModal.fields"
      :submit-label="formModal.submitLabel"
      :loading="saving"
      @close="formModal = null"
      @submit="submitForm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ReembolsosService, type ExpenseClaim, type ClaimTotals } from '@/services/Reembolsos.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'

type FormValues = Record<string, string | number>

const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const claims = ref<ExpenseClaim[]>([])
const totals = ref<ClaimTotals | null>(null)
const profiles = ref<EmployeeProfile[]>([])
const formModal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: FormValues) => Promise<unknown> } | null>(null)

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-surface text-text-muted' },
  submitted: { label: 'Enviado', cls: 'bg-gold/10 text-gold' },
  approved: { label: 'Aprobado', cls: 'bg-cyan/10 text-cyan' },
  rejected: { label: 'Rechazado', cls: 'bg-coral/10 text-coral' },
  paid: { label: 'Pagado', cls: 'bg-teal/10 text-teal' },
}
function statusLabel(s: string) { return STATUS[s]?.label ?? s }
function statusClass(s: string) { return STATUS[s]?.cls ?? '' }
function money(n: number, currency = 'DOP') { return `${currency} ${(Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}` }
function nameOf(employeeId: string) {
  const p = profiles.value.find((x) => x.id === employeeId)
  return p?.userName || p?.position || employeeId.slice(0, 8)
}

async function load() {
  loading.value = true
  try {
    const [c, t, p] = await Promise.all([ReembolsosService.list(), ReembolsosService.totals(), EmpleadosService.listProfiles()])
    claims.value = c; totals.value = t; profiles.value = p.data ?? []
  } catch { toast.error('No se pudieron cargar los reembolsos') }
  finally { loading.value = false }
}
onMounted(load)

const employeeOptions = () => profiles.value.map((p) => ({ value: p.id, label: p.userName || p.position || p.id }))

function openNew() {
  formModal.value = {
    title: 'Nuevo reembolso', submitLabel: 'Crear',
    fields: [
      { key: 'employeeId', label: 'Empleado', type: 'select', required: true, options: employeeOptions() },
      { key: 'description', label: 'Descripción', required: true, maxLength: 300, placeholder: 'Taxi al aeropuerto' },
      { key: 'category', label: 'Categoría', placeholder: 'transporte, comida…', maxLength: 40 },
      { key: 'amount', label: 'Monto', type: 'number', required: true, min: 0 },
      { key: 'date', label: 'Fecha del gasto', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    ],
    onSubmit: (v) => ReembolsosService.create(v),
  }
}

async function submit(c: ExpenseClaim) {
  try { await ReembolsosService.submit(c.id); toast.success('Enviado a aprobación'); load() }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
}
async function approve(c: ExpenseClaim) {
  try { await ReembolsosService.approve(c.id); toast.success('Aprobado'); load() }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
}
function reject(c: ExpenseClaim) {
  formModal.value = {
    title: `Rechazar reembolso`, submitLabel: 'Rechazar',
    fields: [{ key: 'reason', label: 'Motivo del rechazo', type: 'textarea', required: true, maxLength: 500 }],
    onSubmit: (v) => ReembolsosService.reject(c.id, String(v.reason ?? '')),
  }
}
function pay(c: ExpenseClaim) {
  formModal.value = {
    title: `Pagar reembolso (${money(c.amount, c.currency)})`, submitLabel: 'Registrar pago',
    fields: [{ key: 'paymentMethod', label: 'Método de pago', type: 'select', required: true, default: 'cash', options: [
      { value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'payroll', label: 'Con la nómina' },
    ] }],
    onSubmit: (v) => ReembolsosService.pay(c.id, String(v.paymentMethod)),
  }
}

async function submitForm(values: FormValues) {
  if (!formModal.value) return
  saving.value = true
  try { await formModal.value.onSubmit(values); toast.success('Guardado'); formModal.value = null; load() }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Error al guardar') }
  finally { saving.value = false }
}
</script>
