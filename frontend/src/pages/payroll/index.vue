<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Nómina Automatizada</h2>
        <p class="text-sm text-text-muted mt-0.5">Cálculo, liquidación, deducciones y recibos de pago</p>
      </div>
      <button @click="openNewRun" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nueva Liquidación</button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ lastRun?.employeeCount ?? 0 }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Empleados</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">${{ (lastRun?.totalGross ?? 0).toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Bruto Total</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-coral">${{ (lastRun?.totalDeductions ?? 0).toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Deducciones</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-cyan">${{ (lastRun?.totalNet ?? 0).toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Neto a Pagar</div>
      </div>
    </div>

    <div class="flex gap-2 mb-6">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
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
      <div v-if="runs.length === 0 && !loading" class="card p-8 text-center">
        <div class="text-3xl mb-2">💵</div>
        <p class="text-sm text-text-muted font-bold mb-4">No hay liquidaciones. Creá la primera para este período.</p>
        <button @click="openNewRun" class="px-4 py-2 bg-cyan text-navy rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer">+ Nueva Liquidación</button>
      </div>

      <div v-for="run in runs" :key="run.id" class="card p-5 mb-3">
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
        <div class="flex gap-2">
          <button v-if="run.status === 'draft'" @click="calculateRun(run)" class="px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-bold hover:bg-teal-light cursor-pointer">Calcular</button>
          <button v-if="run.status === 'calculated'" @click="approveRun(run)" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">Aprobar</button>
          <button v-if="run.status === 'approved'" @click="markAsPaid(run)" class="px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-bold hover:bg-teal-light cursor-pointer">Marcar Pagada</button>
          <button v-if="run.status !== 'paid' && run.status !== 'cancelled'" @click="cancelRun(run)" class="px-3 py-1.5 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Cancelar</button>
          <button @click="viewDetails(run)" class="px-3 py-1.5 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 cursor-pointer">Ver Detalle</button>
        </div>
      </div>
    </div>

    <!-- Config -->
    <div v-if="activeTab === 'config' && !loading" class="card p-5">
      <h3 class="font-extrabold text-navy text-sm mb-4">Configuración de Nómina</h3>
      <div v-if="config" class="grid grid-cols-2 gap-4">
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Frecuencia</label><input v-model="config.paymentFrequency" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Día de Pago</label><input v-model.number="config.paymentDay" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Horas Extra (x)</label><input v-model.number="config.overtimeMultiplier" type="number" step="0.1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguridad Social (%)</label><input v-model.number="config.socialSecurityRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Seguro Salud (%)</label><input v-model.number="config.healthInsuranceRate" type="number" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
        <div><label class="block text-[11px] font-bold text-navy uppercase mb-1">Moneda</label><input v-model="config.currency" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm"></div>
      </div>
      <button @click="saveConfig" class="mt-4 px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer">Guardar Configuración</button>
    </div>

    <!-- Conceptos -->
    <div v-if="activeTab === 'concepts' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">Conceptos de Nómina</h3>
        <button @click="openNewConcept" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo</button>
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
              <button v-else @click="deleteConcept(c)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 cursor-pointer">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PayrollService, type PayrollRun, type PayrollConfig, type PayrollConcept } from '@/services/Payroll.service'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const toast = useToast()
const activeTab = ref('runs')
const loading = ref(true)

const tabs = [
  { value: 'runs', label: '💰 Liquidaciones' },
  { value: 'config', label: '⚙️ Configuración' },
  { value: 'concepts', label: '📋 Conceptos' },
]

const runs = ref<PayrollRun[]>([])
const config = ref<PayrollConfig | null>(null)
const concepts = ref<PayrollConcept[]>([])

const lastRun = computed(() => runs.value[0])

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

async function openNewRun() {
  const period = prompt('Período (ej: 2026-06):', new Date().toISOString().slice(0,7))
  if (!period) return
  const startDate = prompt('Inicio (YYYY-MM-DD):', `${period}-01`)
  const endDate = prompt('Fin (YYYY-MM-DD):', `${period}-30`)
  const paymentDate = prompt('Fecha de pago:', new Date().toISOString().slice(0,10))
  if (!startDate || !endDate || !paymentDate) return
  try { await PayrollService.createRun(hotelId.value!, { period, startDate, endDate, paymentDate }); toast.success('Liquidación creada'); loadData() }
  catch { toast.error('Error al crear') }
}

async function calculateRun(run: PayrollRun) {
  const empCount = parseInt(prompt('N° de empleados a calcular:', '1') ?? '0')
  if (!empCount) return
  const employees = []
  for (let i = 0; i < empCount; i++) {
    const emp: any = { employeeId: prompt(`ID empleado ${i+1}:`, `emp-${i+1}`) ?? `emp-${i+1}` }
    emp.baseSalary = parseFloat(prompt(`Salario base ${i+1}:`, '1500') ?? '1500')
    emp.daysWorked = parseInt(prompt(`Días trabajados ${i+1}:`, '30') ?? '30')
    emp.hoursWorked = parseInt(prompt(`Horas trabajadas ${i+1}:`, '240') ?? '240')
    emp.overtimeHours = parseInt(prompt(`Horas extra ${i+1}:`, '0') ?? '0')
    emp.absences = parseInt(prompt(`Ausencias ${i+1}:`, '0') ?? '0')
    emp.lateArrivals = 0
    employees.push(emp)
  }
  try {
    const result = await PayrollService.calculate(run.id, employees)
    toast.success(`Nómina calculada: ${result.employeeCount} empleados, $${result.totalNet.toLocaleString()} neto`)
    loadData()
  } catch { toast.error('Error al calcular') }
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
