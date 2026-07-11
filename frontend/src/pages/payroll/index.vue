<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Nómina Automatizada</h2>
        <p class="text-sm text-text-muted mt-0.5">Cálculo, liquidación, deducciones y recibos de pago</p>
      </div>
      <button @click="openNewRunModal" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">+ Nueva Liquidación</button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-navy">{{ employeeCountAnim }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Empleados</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-teal">${{ totalGrossAnim.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Bruto Total</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-coral">${{ totalDeductionsAnim.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Deducciones</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-cyan">${{ totalNetAnim.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Neto a Pagar</div>
      </div>
    </div>

    <div class="flex gap-2 mb-6">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando...</span>
    </div>

    <!-- Liquidaciones -->
    <div v-if="activeTab === 'runs' && !loading">
      <div v-if="runs.length === 0 && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-8 text-center">
        <span class="w-10 h-10 mx-auto mb-3 block text-navy/30" v-html="ICON_BANKNOTE"></span>
        <p class="text-sm text-text-muted font-bold mb-4">No hay liquidaciones. Creá la primera para este período.</p>
        <button @click="openNewRunModal" class="px-4 py-2 bg-cyan text-navy rounded-full text-sm font-bold hover:shadow-lg transition-all cursor-pointer">+ Nueva Liquidación</button>
      </div>

      <div v-for="run in runs" :key="run.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5 mb-3">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-extrabold text-navy">Período {{ run.period }}</div>
            <div class="text-xs text-text-muted">{{ run.startDate }} → {{ run.endDate }} · Pago: {{ run.paymentDate }}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold px-3 py-1 rounded-full" :class="runStatusClass(run.status)">{{ runStatusLabel(run.status) }}</span>
            <span class="text-sm font-extrabold text-navy">${{ run.totalNet.toLocaleString() }}</span>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <button v-if="run.status === 'draft'" @click="openCalculateModal(run)" class="px-3.5 py-1.5 bg-teal text-white rounded-full text-[11px] font-bold hover:bg-teal-light transition-all cursor-pointer">Calcular</button>
          <button v-if="run.status === 'calculated'" @click="approveRun(run)" class="px-3.5 py-1.5 bg-cyan text-navy rounded-full text-[11px] font-bold hover:shadow-lg transition-all cursor-pointer">Aprobar</button>
          <button v-if="run.status === 'approved'" @click="markAsPaid(run)" class="px-3.5 py-1.5 bg-teal text-white rounded-full text-[11px] font-bold hover:bg-teal-light transition-all cursor-pointer">Marcar Pagada</button>
          <button v-if="run.status !== 'paid' && run.status !== 'cancelled'" @click="cancelRun(run)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Cancelar</button>
          <button @click="viewDetails(run)" class="text-[11px] font-bold text-navy/70 hover:text-navy transition-colors cursor-pointer">Ver Detalle</button>
        </div>
      </div>
    </div>

    <!-- Config -->
    <div v-if="activeTab === 'config' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5">
      <h3 class="font-extrabold text-navy text-sm mb-4">Configuración de Nómina</h3>
      <div v-if="config" class="grid grid-cols-2 gap-4">
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Frecuencia</label><input v-model="config.paymentFrequency" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Día de Pago</label><input v-model.number="config.paymentDay" type="number" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Horas Extra (x)</label><input v-model.number="config.overtimeMultiplier" type="number" step="0.1" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguridad Social (%)</label><input v-model.number="config.socialSecurityRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguro Salud (%)</label><input v-model.number="config.healthInsuranceRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Moneda</label><input v-model="config.currency" class="w-full px-4 py-2.5 rounded-full border border-border text-sm"></div>
      </div>
      <button @click="saveConfig" class="mt-4 px-5 py-2.5 bg-cyan text-navy rounded-full text-sm font-bold hover:shadow-lg transition-all cursor-pointer">Guardar Configuración</button>
    </div>

    <!-- Conceptos -->
    <div v-if="activeTab === 'concepts' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Conceptos de Nómina</h3>
        <button @click="openNewConcept" class="px-3.5 py-1.5 bg-cyan text-navy rounded-full text-[11px] font-extrabold hover:shadow-lg transition-all cursor-pointer">+ Nuevo</button>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Código</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Nombre</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Método</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Valor</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Sistema</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in concepts" :key="c.id" class="border-b border-border last:border-0 hover:bg-surface/50">
            <td class="p-4 text-sm font-bold text-navy">{{ c.code }}</td>
            <td class="p-4 text-sm">{{ c.name }}</td>
            <td class="p-4 text-sm">{{ c.type }}</td>
            <td class="p-4 text-sm text-text-secondary">{{ c.calculationMethod }}</td>
            <td class="p-4 text-sm">{{ c.value }}{{ c.formula ? ` (${c.formula})` : '' }}</td>
            <td class="p-4 text-right">
              <span v-if="c.system" class="text-[10px] bg-navy/5 text-text-muted px-2 py-1 rounded-full">Sistema</span>
              <button v-else @click="deleteConcept(c)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Nueva Liquidación -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="newRunModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="newRunModal = false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">
            <div class="shrink-0 p-6 pb-4">
              <h3 class="text-lg font-black text-navy">Nueva Liquidación</h3>
            </div>
            <div class="overflow-y-auto flex-1 px-6 space-y-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Período</label>
                <input v-model="newRunForm.period" type="month" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Inicio</label>
                  <input v-model="newRunForm.startDate" type="date" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fin</label>
                  <input v-model="newRunForm.endDate" type="date" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fecha de pago</label>
                <input v-model="newRunForm.paymentDate" type="date" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
              </div>
            </div>
            <div class="shrink-0 flex items-center justify-end gap-4 p-6 pt-5">
              <button @click="newRunModal = false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="submitNewRun" :disabled="creatingRun" class="px-4 py-2 bg-cyan text-navy rounded-full text-[11px] font-extrabold hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
                {{ creatingRun ? 'Creando...' : 'Crear Liquidación' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal Calcular Nómina -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="calcRunModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="calcRunModal = false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div class="shrink-0 p-6 pb-4 flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Calcular Nómina — Período {{ calcRunTarget?.period }}</h3>
              <button @click="addCalcEmployeeRow" class="px-3.5 py-1.5 bg-navy/5 text-navy rounded-full text-[11px] font-bold hover:bg-navy/10 transition-all cursor-pointer">+ Empleado</button>
            </div>
            <div class="overflow-y-auto flex-1 px-6 space-y-3">
              <div v-for="(emp, i) in calcEmployees" :key="i" class="rounded-2xl border border-border p-4">
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[10px] font-bold text-text-muted uppercase">Empleado {{ i + 1 }}</span>
                  <button v-if="calcEmployees.length > 1" @click="removeCalcEmployeeRow(i)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Quitar</button>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">ID Empleado</label>
                    <input v-model="emp.employeeId" type="text" placeholder="emp-1" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Salario base</label>
                    <input v-model.number="emp.baseSalary" type="number" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Días trabajados</label>
                    <input v-model.number="emp.daysWorked" type="number" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Horas trabajadas</label>
                    <input v-model.number="emp.hoursWorked" type="number" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Horas extra</label>
                    <input v-model.number="emp.overtimeHours" type="number" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                  <div class="col-span-2">
                    <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Ausencias</label>
                    <input v-model.number="emp.absences" type="number" class="w-full px-4 py-2 rounded-full border border-border text-sm">
                  </div>
                </div>
              </div>
            </div>
            <div class="shrink-0 flex items-center justify-end gap-4 p-6 pt-5">
              <button @click="calcRunModal = false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="submitCalculateRun" :disabled="calculatingRun" class="px-4 py-2 bg-teal text-white rounded-full text-[11px] font-extrabold hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">
                {{ calculatingRun ? 'Calculando...' : 'Calcular Nómina' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PayrollService, type PayrollRun, type PayrollConfig, type PayrollConcept } from '@/services/Payroll.service'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'
import { useCountUp } from '@/composables/useCountUp'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('runs')
const loading = ref(true)

const tabs = [
  { value: 'runs', label: 'Liquidaciones' },
  { value: 'config', label: 'Configuración' },
  { value: 'concepts', label: 'Conceptos' },
]

const ICON_BANKNOTE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>'

const runs = ref<PayrollRun[]>([])
const config = ref<PayrollConfig | null>(null)
const concepts = ref<PayrollConcept[]>([])

const lastRun = computed(() => runs.value[0])
const employeeCount = computed(() => lastRun.value?.employeeCount ?? 0)
const totalGross = computed(() => lastRun.value?.totalGross ?? 0)
const totalDeductions = computed(() => lastRun.value?.totalDeductions ?? 0)
const totalNet = computed(() => lastRun.value?.totalNet ?? 0)
const employeeCountAnim = useCountUp(employeeCount)
const totalGrossAnim = useCountUp(totalGross)
const totalDeductionsAnim = useCountUp(totalDeductions)
const totalNetAnim = useCountUp(totalNet)

function runStatusClass(s: string) {
  return { draft: 'bg-gray-100 text-gray-500', calculated: 'bg-blue-100 text-blue-700', approved: 'bg-gold/10 text-gold', paid: 'bg-teal/10 text-teal', cancelled: 'bg-coral/10 text-coral' }[s] ?? 'bg-gray-100'
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

const newRunModal = ref(false)
const creatingRun = ref(false)
const newRunForm = ref({ period: '', startDate: '', endDate: '', paymentDate: '' })

function openNewRunModal() {
  const period = new Date().toISOString().slice(0, 7)
  newRunForm.value = { period, startDate: `${period}-01`, endDate: `${period}-30`, paymentDate: new Date().toISOString().slice(0, 10) }
  newRunModal.value = true
}

async function submitNewRun() {
  const { period, startDate, endDate, paymentDate } = newRunForm.value
  if (!period || !startDate || !endDate || !paymentDate) { toast.warning('Completá todos los campos'); return }
  creatingRun.value = true
  try {
    await PayrollService.createRun(hotelId.value!, { period, startDate, endDate, paymentDate })
    toast.success('Liquidación creada')
    newRunModal.value = false
    await loadData()
  } catch { toast.error('Error al crear') }
  finally { creatingRun.value = false }
}

type CalcEmployee = { employeeId: string; baseSalary: number; daysWorked: number; hoursWorked: number; overtimeHours: number; absences: number }
const calcRunModal = ref(false)
const calcRunTarget = ref<PayrollRun | null>(null)
const calcEmployees = ref<CalcEmployee[]>([])
const calculatingRun = ref(false)

function blankCalcEmployee(): CalcEmployee {
  return { employeeId: '', baseSalary: 1500, daysWorked: 30, hoursWorked: 240, overtimeHours: 0, absences: 0 }
}

function openCalculateModal(run: PayrollRun) {
  calcRunTarget.value = run
  calcEmployees.value = [blankCalcEmployee()]
  calcRunModal.value = true
}

function addCalcEmployeeRow() { calcEmployees.value.push(blankCalcEmployee()) }
function removeCalcEmployeeRow(i: number) { calcEmployees.value.splice(i, 1) }

async function submitCalculateRun() {
  if (!calcRunTarget.value) return
  if (calcEmployees.value.some(e => !e.employeeId.trim())) { toast.warning('Todos los empleados necesitan un ID'); return }
  calculatingRun.value = true
  try {
    const employees = calcEmployees.value.map(e => ({ ...e, lateArrivals: 0 }))
    const result = await PayrollService.calculate(calcRunTarget.value.id, employees)
    toast.success(`Nómina calculada: ${result.employeeCount} empleados, $${result.totalNet.toLocaleString()} neto`)
    calcRunModal.value = false
    await loadData()
  } catch { toast.error('Error al calcular') }
  finally { calculatingRun.value = false }
}

async function approveRun(run: PayrollRun) {
  if (!confirm(`¿Aprobar liquidación ${run.period} por $${run.totalNet.toLocaleString()}?`)) return
  try { await PayrollService.approve(run.id); toast.success('Nómina aprobada — recibos generados'); loadData() }
  catch { toast.error('Error al aprobar') }
}

async function markAsPaid(run: PayrollRun) {
  if (!confirm(`¿Marcar como pagada la liquidación ${run.period}?`)) return
  try { await PayrollService.markAsPaid(run.id); toast.success('Pago registrado'); loadData() }
  catch { toast.error('Error') }
}

async function cancelRun(run: PayrollRun) {
  if (!confirm(`¿Cancelar liquidación ${run.period}?`)) return
  try { await PayrollService.cancel(run.id); toast.success('Liquidación cancelada'); loadData() }
  catch { toast.error('Error al cancelar') }
}

function viewDetails(run: PayrollRun) { toast.info(`Detalle de ${run.period} — ${run.employeeCount} empleados, $${run.totalNet.toLocaleString()} neto`) }
async function saveConfig() { try { await PayrollService.updateConfig(hotelId.value!, config.value!); toast.success('Configuración guardada') } catch { toast.error('Error') } }
function openNewConcept() { toast.info('Nuevo concepto — formulario pendiente') }
function deleteConcept(c: PayrollConcept) { toast.info(`Eliminar ${c.code} — pendiente`) }
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
