<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-start justify-between p-6 pb-4 shrink-0">
          <div>
            <h3 class="text-lg font-black text-navy">Liquidación — Período {{ run.period }}</h3>
            <p class="text-xs text-text-muted mt-0.5">
              {{ run.startDate }} → {{ run.endDate }} · Pago: {{ run.paymentDate }} ·
              <span class="font-bold" :class="statusClass(run.status)">{{ statusLabel(run.status) }}</span>
            </p>
          </div>
          <button @click="$emit('close')" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
            <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
          </button>
        </div>

        <!-- KPIs del período -->
        <div class="grid grid-cols-4 gap-3 px-6 pb-4 shrink-0">
          <div class="p-3 rounded-xl bg-navy/5"><div class="text-[10px] text-text-muted uppercase font-bold">Empleados</div><div class="text-lg font-black text-navy">{{ run.employeeCount }}</div></div>
          <div class="p-3 rounded-xl bg-teal/5"><div class="text-[10px] text-text-muted uppercase font-bold">Bruto</div><div class="text-lg font-black text-teal">{{ money(run.totalGross) }}</div></div>
          <div class="p-3 rounded-xl bg-coral/5"><div class="text-[10px] text-text-muted uppercase font-bold">Deducciones</div><div class="text-lg font-black text-coral">{{ money(run.totalDeductions) }}</div></div>
          <div class="p-3 rounded-xl bg-cyan/5"><div class="text-[10px] text-text-muted uppercase font-bold">Neto</div><div class="text-lg font-black text-cyan">{{ money(run.totalNet) }}</div></div>
        </div>

        <!-- Estados -->
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
        </div>
        <div v-else-if="loadError" class="px-6 py-10 text-center">
          <p class="text-sm font-bold text-coral">{{ loadError }}</p>
          <button @click="load" class="mt-3 px-4 py-2 border border-border rounded-xl text-xs font-bold text-text-secondary cursor-pointer">Reintentar</button>
        </div>
        <div v-else-if="!details.length" class="px-6 py-12 text-center">
          <p class="text-sm text-text-muted">Esta liquidación todavía no fue calculada. Calculala primero para ver el detalle por empleado.</p>
        </div>

        <!-- Tabla por empleado -->
        <div v-else class="overflow-auto px-6 pb-2">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-white">
              <tr class="border-b border-border text-left">
                <th class="py-2 pr-2 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
                <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase text-right">Días</th>
                <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase text-right">Extra</th>
                <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase text-right">Bruto</th>
                <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase text-right">Deducciones</th>
                <th class="py-2 px-2 text-[10px] font-bold text-text-muted uppercase text-right">Neto</th>
                <th class="py-2 pl-2 text-[10px] font-bold text-text-muted uppercase text-right"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="d in details" :key="d.id">
                <tr class="border-b border-border/50 hover:bg-surface/30">
                  <td class="py-2 pr-2 font-bold text-navy">{{ employeeName(d.employeeId) }}</td>
                  <td class="py-2 px-2 text-right text-text-secondary">{{ d.daysWorked }}</td>
                  <td class="py-2 px-2 text-right text-gold">{{ d.overtimeHours }}h</td>
                  <td class="py-2 px-2 text-right text-navy font-bold">{{ money(d.grossPay) }}</td>
                  <td class="py-2 px-2 text-right text-coral">{{ money(d.totalDeductions) }}</td>
                  <td class="py-2 px-2 text-right text-teal font-black">{{ money(d.netPay) }}</td>
                  <td class="py-2 pl-2 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-2">
                      <button @click="toggle(d.id)" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">{{ expanded === d.id ? 'Ocultar' : 'Conceptos' }}</button>
                      <button @click="openPayslip(d)" :disabled="busy === d.id" class="text-[10px] font-bold text-navy hover:underline cursor-pointer disabled:opacity-50">Recibo</button>
                      <button @click="emailPayslip(d)" :disabled="busy === d.id" class="text-[10px] font-bold text-teal hover:underline cursor-pointer disabled:opacity-50">Email</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="expanded === d.id" class="bg-surface/40">
                  <td colspan="7" class="px-3 py-3">
                    <div class="grid sm:grid-cols-2 gap-4">
                      <div>
                        <div class="text-[10px] font-black text-teal uppercase mb-1">Percepciones</div>
                        <div v-for="(it, i) in parse(d.earnings)" :key="'e'+i" class="flex justify-between text-xs py-0.5">
                          <span class="text-text-secondary">{{ it.name }}</span><span class="font-bold text-navy">{{ money(it.amount) }}</span>
                        </div>
                        <div v-if="!parse(d.earnings).length" class="text-xs text-text-muted">—</div>
                      </div>
                      <div>
                        <div class="text-[10px] font-black text-coral uppercase mb-1">Deducciones</div>
                        <div v-for="(it, i) in parse(d.deductions)" :key="'d'+i" class="flex justify-between text-xs py-0.5">
                          <span class="text-text-secondary">{{ it.name }}</span><span class="font-bold text-coral">−{{ money(it.amount) }}</span>
                        </div>
                        <div v-if="!parse(d.deductions).length" class="text-xs text-text-muted">—</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="p-6 pt-3 shrink-0">
          <button @click="$emit('close')" class="w-full py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cerrar</button>
        </div>
      </div>
    </div>
  </Teleport>

  <FormModal
    v-if="emailModal"
    :title="emailModal.title"
    :fields="emailModal.fields"
    :submit-label="emailModal.submitLabel"
    :loading="emailSaving"
    @close="emailModal = null"
    @submit="submitEmail"
  />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PayrollService, type PayrollRun, type PayrollRunDetail } from '@/services/Payroll.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import { formatCurrency } from '@/composables/useCurrency'

const props = withDefaults(defineProps<{ run: PayrollRun; currency?: string }>(), { currency: 'DOP' })
defineEmits<{ close: [] }>()
const toast = useToast()
const busy = ref<string | null>(null)
const emailModal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: Record<string, string | number>) => Promise<unknown> } | null>(null)
const emailSaving = ref(false)

// #157 Recibo imprimible: trae el HTML con auth y lo abre en pestaña nueva (el navegador imprime a PDF).
async function openPayslip(d: PayrollRunDetail) {
  busy.value = d.id
  try {
    const html = await PayrollService.payslipHtml(props.run.id, d.id, employeeName(d.employeeId))
    const w = window.open('', '_blank')
    if (!w) { toast.error('Permití las ventanas emergentes para ver el recibo'); return }
    w.document.open(); w.document.write(html); w.document.close()
  } catch { toast.error('No se pudo generar el recibo') }
  finally { busy.value = null }
}

// #157 Envío por email — modal con campo validado (sin prompt() nativo).
function emailPayslip(d: PayrollRunDetail) {
  emailModal.value = {
    title: `Enviar recibo de ${employeeName(d.employeeId)}`, submitLabel: 'Enviar',
    fields: [{ key: 'to', label: 'Correo del destinatario', type: 'email', required: true, maxLength: 120, placeholder: 'empleado@mail.com' }],
    onSubmit: async (v: Record<string, string | number>) => {
      await PayrollService.emailPayslip(props.run.id, d.id, String(v.to), employeeName(d.employeeId))
      toast.success(`Recibo enviado a ${v.to}`)
    },
  }
}

async function submitEmail(values: Record<string, string | number>) {
  if (!emailModal.value) return
  emailSaving.value = true
  try { await emailModal.value.onSubmit(values); emailModal.value = null }
  catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo enviar el recibo') }
  finally { emailSaving.value = false }
}

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'

const details = ref<PayrollRunDetail[]>([])
const profiles = ref<EmployeeProfile[]>([])
const loading = ref(true)
const loadError = ref('')
const expanded = ref<string | null>(null)

// Formatea con la moneda configurada en la nómina (RD$ por defecto en RD). Antes era un '$' pelado
// con locale 'es', mientras la tabla de la vista usaba el locale del navegador: el mismo importe se
// veía "$31.875,00" acá y "$31,875.00" allá. `formatCurrency` es la única fuente de formato.
const money = (n: number) => formatCurrency(Number(n) || 0, props.currency)
const employeeName = (id: string) => { const p = profiles.value.find((x) => x.id === id || x.userId === id); return p?.userName || p?.position || id.slice(0, 8) }
function statusLabel(s: string) { return ({ draft: 'Borrador', calculated: 'Calculado', approved: 'Aprobado', paid: 'Pagado', cancelled: 'Cancelado' } as Record<string, string>)[s] ?? s }
function statusClass(s: string) { return ({ draft: 'text-text-muted', calculated: 'text-blue', approved: 'text-gold', paid: 'text-teal', cancelled: 'text-coral' } as Record<string, string>)[s] ?? 'text-navy' }
function toggle(id: string) { expanded.value = expanded.value === id ? null : id }
function parse(json: string): Array<{ name: string; amount: number }> {
  try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : [] } catch { return [] }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [d, pr] = await Promise.all([PayrollService.getRunDetails(props.run.id), EmpleadosService.listProfiles()])
    details.value = d
    profiles.value = pr.data ?? []
  } catch {
    loadError.value = 'No se pudo cargar el detalle de la liquidación.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
