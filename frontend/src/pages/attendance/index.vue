<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Asistencia y Ponche Digital</h2>
        <p class="text-sm text-text-muted mt-0.5">Fichaje de entrada/salida, horarios y reportes</p>
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
    </div>

    <!-- Ponche Digital -->
    <div v-if="activeTab === 'clock' && !loading" class="max-w-md mx-auto">
      <div class="card p-8 text-center">
        <div class="text-5xl mb-4">{{ todayRecord?.clockIn && !todayRecord?.clockOut ? '⏱️' : todayRecord?.clockOut ? '✅' : '🕐' }}</div>
        <div class="text-2xl font-black text-navy mb-2">{{ now }}</div>
        <div class="text-sm text-text-secondary mb-6">{{ today }}</div>

        <!-- Método selector -->
        <div v-if="!todayRecord?.clockIn" class="mb-6">
          <div class="text-[10px] font-bold text-navy uppercase tracking-wide mb-3">Método de fichaje</div>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="m in methods" :key="m.value" @click="selectedMethod = m.value"
              class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
              :class="selectedMethod === m.value ? 'border-navy bg-navy/5 shadow-md' : 'border-border hover:border-navy/30'">
              <div class="text-xl mb-1">{{ m.icon }}</div>
              <div class="text-[9px] font-bold" :class="selectedMethod === m.value ? 'text-navy' : 'text-text-muted'">{{ m.label }}</div>
            </button>
          </div>
        </div>

        <!-- Camera for facial -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && !showCamera" class="mb-4 p-4 bg-surface rounded-xl text-center cursor-pointer hover:bg-navy/5 transition-colors" @click="showCamera = true">
          <div class="text-4xl mb-2">📸</div>
          <div class="text-sm font-bold text-navy">Tocar para abrir cámara</div>
          <div class="text-[10px] text-text-muted mt-1">Se verificará tu rostro contra tu foto de perfil</div>
        </div>

        <CameraCapture v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && showCamera" @verify="onFacialVerify" @close="showCamera = false" />

        <!-- Fingerprint info -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'fingerprint'" class="mb-4 p-4 bg-surface rounded-xl text-center">
          <div class="text-4xl mb-2">👆</div>
          <div class="text-sm font-bold text-navy">Colocá tu dedo en el lector</div>
          <div class="text-[10px] text-text-muted mt-1">Esperando señal del dispositivo ZKTeco...</div>
          <div class="w-6 h-6 mt-3 mx-auto border-2 border-navy/20 border-t-navy rounded-full animate-spin"></div>
        </div>

        <!-- PIN input -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'pin'" class="mb-4">
          <label class="block text-[10px] font-bold text-navy uppercase mb-2">Código PIN</label>
          <input v-model="pinCode" type="password" maxlength="6" placeholder="••••••" class="w-32 text-center px-4 py-3 rounded-xl border-2 border-navy/20 text-xl font-bold tracking-widest focus:outline-none focus:border-navy text-navy">
        </div>

        <div v-if="todayRecord" class="mb-6 p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-center gap-2 mb-3">
            <span class="text-xl">{{ methods.find(m => m.value === todayRecord?.method)?.icon || '🕐' }}</span>
            <span class="text-[10px] font-bold text-text-muted">{{ methods.find(m => m.value === todayRecord?.method)?.label || todayRecord?.method }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 text-left">
            <div><span class="text-[10px] text-text-muted uppercase block">Entrada</span><span class="text-sm font-bold text-navy">{{ todayRecord.clockIn ? new Date(todayRecord.clockIn).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Salida</span><span class="text-sm font-bold text-navy">{{ todayRecord.clockOut ? new Date(todayRecord.clockOut).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Descanso</span><span class="text-sm font-bold">{{ todayRecord.breakStart && !todayRecord.breakEnd ? 'En curso' : (todayRecord.breakEnd ? 'Completado' : '—') }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Horas</span><span class="text-sm font-bold text-teal">{{ todayRecord.totalHours?.toFixed(1) ?? '—' }}h</span></div>
          </div>
        </div>

        <div class="space-y-3">
          <button v-if="!todayRecord?.clockIn" @click="doClockIn"
            class="w-full py-4 bg-teal text-white rounded-2xl text-lg font-extrabold hover:bg-teal-light transition-all cursor-pointer shadow-lg">
            🕐 Fichar Entrada
          </button>
          <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut && !todayRecord?.breakStart" @click="doStartBreak"
            class="w-full py-3 bg-gold/20 text-gold rounded-xl text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
            ☕ Iniciar Descanso
          </button>
          <button v-if="todayRecord?.breakStart && !todayRecord?.breakEnd" @click="doEndBreak"
            class="w-full py-3 bg-gold/20 text-gold rounded-xl text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
            ☕ Terminar Descanso
          </button>
          <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut" @click="doClockOut"
            class="w-full py-4 bg-coral text-white rounded-2xl text-lg font-extrabold hover:bg-coral/80 transition-all cursor-pointer shadow-lg">
            🏠 Fichar Salida
          </button>
          <div v-if="todayRecord?.clockOut" class="py-4 bg-teal/5 border border-teal/20 rounded-xl">
            <span class="text-teal font-bold text-sm">✅ Jornada completada</span>
          </div>
        </div>
      </div>

      <!-- Manual Record (admin) -->
      <div class="card p-5 mt-4">
        <h3 class="font-extrabold text-navy text-sm mb-3">Fichaje Manual (Supervisor)</h3>
        <div class="space-y-3">
          <input v-model="manualForm.employeeId" placeholder="ID Empleado" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm">
          <div class="grid grid-cols-2 gap-2">
            <input v-model="manualForm.clockIn" type="datetime-local" class="px-4 py-2.5 rounded-xl border border-border text-sm">
            <input v-model="manualForm.clockOut" type="datetime-local" class="px-4 py-2.5 rounded-xl border border-border text-sm">
          </div>
          <input v-model="manualForm.notes" placeholder="Motivo..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm">
          <button @click="doManualRecord" class="w-full py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light cursor-pointer">Registrar Manualmente</button>
        </div>
      </div>
    </div>

    <!-- Horarios -->
    <div v-if="activeTab === 'schedules' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between">
        <h3 class="font-extrabold text-navy text-sm">Horarios y Turnos</h3>
        <button @click="openNewSchedule" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">+ Nuevo Turno</button>
      </div>
      <div class="p-4 grid grid-cols-3 gap-4">
        <div v-for="s in schedules" :key="s.id" class="p-4 bg-surface rounded-xl">
          <div class="font-extrabold text-navy text-sm mb-2">{{ s.name }}</div>
          <div class="text-xs text-text-muted">🕐 {{ s.startTime }} → {{ s.endTime }}</div>
          <div class="text-xs text-text-muted">☕ {{ s.breakMinutes }}min descanso · ⏰ {{ s.graceMinutes }}min tolerancia</div>
          <button @click="deleteSchedule(s)" class="mt-2 text-[10px] text-coral font-bold hover:underline cursor-pointer">Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Reportes -->
    <div v-if="activeTab === 'reports' && !loading" class="card p-5">
      <h3 class="font-extrabold text-navy text-sm mb-4">Reporte de Asistencia</h3>
      <div class="flex gap-3 mb-4">
        <input v-model="reportFrom" type="date" class="px-4 py-2 rounded-xl border border-border text-sm">
        <input v-model="reportTo" type="date" class="px-4 py-2 rounded-xl border border-border text-sm">
        <button @click="loadReport" class="px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light cursor-pointer">Generar</button>
      </div>
      <table v-if="report.length" class="w-full">
        <thead><tr class="border-b"><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Empleado</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Días</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Horas</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Extra</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Faltas</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Tarde</th></tr></thead>
        <tbody><tr v-for="r in report" :key="r.employeeId" class="border-b hover:bg-surface/50"><td class="p-3 text-sm font-bold text-navy">{{ r.employeeId }}</td><td class="p-3 text-sm">{{ r.daysWorked }}</td><td class="p-3 text-sm">{{ r.hoursWorked }}h</td><td class="p-3 text-sm text-gold font-bold">{{ r.overtimeHours }}h</td><td class="p-3 text-sm text-coral">{{ r.absences }}</td><td class="p-3 text-sm text-coral">{{ r.lateArrivals }}</td></tr></tbody>
      </table>
      <div v-if="!report.length" class="p-8 text-center text-text-muted text-sm">Seleccioná un rango de fechas y generá el reporte</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { AttendanceService, type AttendanceRecord, type AttendanceSchedule } from '@/services/Attendance.service'
import { useToast } from '@/composables/useToast'
import CameraCapture from '@/components/features/CameraCapture.vue'

const toast = useToast()
const activeTab = ref('clock')
const loading = ref(true)
const now = ref(''); const today = ref('')

const todayRecord = ref<AttendanceRecord | null>(null)
const schedules = ref<AttendanceSchedule[]>([])
const report = ref<any[]>([])
const reportFrom = ref(''); const reportTo = ref('')
const manualForm = ref({ employeeId: '', clockIn: '', clockOut: '', notes: '' })
const selectedMethod = ref('pin')
const pinCode = ref('')
const showCamera = ref(false)

const methods = [
  { value: 'pin', label: 'PIN', icon: '🔢' },
  { value: 'facial', label: 'Facial', icon: '📸' },
  { value: 'fingerprint', label: 'Huella', icon: '👆' },
  { value: 'mobile_gps', label: 'Móvil', icon: '📱' },
]

const tabs = [
  { value: 'clock', label: '🕐 Ponche Digital' },
  { value: 'schedules', label: '📅 Horarios' },
  { value: 'reports', label: '📊 Reportes' },
]

function updateClock() { const d = new Date(); now.value = d.toLocaleTimeString('es'); today.value = d.toLocaleDateString('es', { weekday:'long', day:'numeric', month:'long' }) }

async function loadData() {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const empId = user.id || 'e1'
    const [rec, sch] = await Promise.allSettled([AttendanceService.getToday(empId), AttendanceService.listSchedules()])
    todayRecord.value = rec.status === 'fulfilled' ? rec.value : null
    schedules.value = sch.status === 'fulfilled' ? sch.value : []
  } catch { /* silent */ }
  finally { loading.value = false }
}

onMounted(() => { updateClock(); setInterval(updateClock, 10000); loadData() })

// Clock actions
function getEmpId() { return JSON.parse(localStorage.getItem('user') || '{}').id || 'e1' }

async function doClockIn() { try { todayRecord.value = await AttendanceService.clockIn(getEmpId(), selectedMethod.value); toast.success('✅ Entrada registrada (' + (methods.find(m => m.value === selectedMethod.value)?.label || '') + ')') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al fichar') } }

async function onFacialVerify(success: boolean) {
  showCamera.value = false
  if (success) { await doClockIn() }
  else { toast.error('Rostro no verificado. Intentá de nuevo o usá otro método.') }
}
async function doClockOut() { try { todayRecord.value = await AttendanceService.clockOut(getEmpId()); toast.success('🏠 Salida registrada') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doStartBreak() { try { todayRecord.value = await AttendanceService.startBreak(getEmpId()); toast.info('☕ Descanso iniciado') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doEndBreak() { try { todayRecord.value = await AttendanceService.endBreak(getEmpId()); toast.info('☕ Descanso finalizado') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doManualRecord() {
  if (!manualForm.value.employeeId || !manualForm.value.clockIn) { toast.warning('ID empleado y hora entrada requeridos'); return }
  try { await AttendanceService.manualRecord(manualForm.value); toast.success('Fichaje manual registrado'); manualForm.value = { employeeId: '', clockIn: '', clockOut: '', notes: '' } }
  catch { toast.error('Error') }
}

async function loadReport() {
  if (!reportFrom.value || !reportTo.value) { toast.warning('Seleccioná fechas'); return }
  try { report.value = await AttendanceService.getReport(reportFrom.value, reportTo.value) } catch { toast.error('Error') }
}

function openNewSchedule() { const n = prompt('Nombre del turno:'); if (!n) return; const s = prompt('Hora inicio (HH:MM):','06:00'); const e = prompt('Hora fin (HH:MM):','14:00'); if (!s || !e) return; AttendanceService.createSchedule({ name: n, startTime: s, endTime: e }).then(() => { toast.success('Turno creado'); loadData() }).catch(() => toast.error('Error')) }
function deleteSchedule(s: AttendanceSchedule) { AttendanceService.deleteSchedule(s.id).then(() => { toast.success('Turno eliminado'); loadData() }).catch(() => toast.error('Error')) }
</script>
