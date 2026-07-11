<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Asistencia y Ponche Digital</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-sm text-text-muted mt-0.5">Fichaje de entrada/salida, horarios y reportes</p>
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
    </div>

    <!-- Ponche Digital -->
    <div v-if="activeTab === 'clock' && !loading" class="max-w-md mx-auto">
      <!-- Fichaje Manual (Supervisor) — card desplegable, encima de Método de fichaje -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden mb-4">
        <button @click="showManualRecord = !showManualRecord" class="w-full flex items-center justify-between px-5 py-4 cursor-pointer">
          <span class="text-[11px] font-bold text-navy uppercase tracking-wide">Fichaje Manual (Supervisor)</span>
          <span class="w-4 h-4 text-text-muted transition-transform duration-200" :class="showManualRecord ? 'rotate-180' : ''" v-html="ICON_CHEVRON_DOWN"></span>
        </button>
        <div v-if="showManualRecord" class="space-y-3 px-5 pb-5 text-left">
          <input v-model="manualForm.employeeId" placeholder="ID Empleado" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
          <div class="grid grid-cols-2 gap-2">
            <input v-model="manualForm.clockIn" type="datetime-local" class="px-4 py-2.5 rounded-full border border-border text-sm">
            <input v-model="manualForm.clockOut" type="datetime-local" class="px-4 py-2.5 rounded-full border border-border text-sm">
          </div>
          <input v-model="manualForm.notes" placeholder="Motivo..." class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
          <button @click="doManualRecord" class="w-full py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-all cursor-pointer">Registrar Manualmente</button>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-8 text-center">
        <div class="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
          :class="todayRecord?.clockOut ? 'bg-teal/10 text-teal' : todayRecord?.clockIn ? 'bg-gold/10 text-gold' : 'bg-navy/5 text-navy'">
          <span class="w-7 h-7" v-html="clockStatusIcon"></span>
        </div>
        <div class="text-2xl font-black text-navy mb-2">{{ now }}</div>
        <div class="text-sm text-text-secondary mb-6">{{ today }}</div>

        <!-- Método selector -->
        <div v-if="!todayRecord?.clockIn" class="mb-6">
          <div class="text-[10px] font-bold text-navy uppercase tracking-wide mb-3">Método de fichaje</div>
          <div class="flex flex-wrap justify-center gap-2">
            <button v-for="m in methods" :key="m.value" @click="selectedMethod = m.value"
              class="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold border transition-all cursor-pointer"
              :class="selectedMethod === m.value ? 'border-navy bg-navy text-white' : 'border-border text-text-secondary hover:border-navy/30'">
              <span class="w-3.5 h-3.5" v-html="m.icon"></span>
              <span>{{ m.label }}</span>
            </button>
          </div>
        </div>

        <!-- Camera for facial -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && !showCamera" class="mb-4 p-4 bg-surface rounded-2xl text-center cursor-pointer hover:bg-navy/5 transition-colors" @click="showCamera = true">
          <span class="w-8 h-8 mx-auto mb-2 block text-navy/60" v-html="ICON_CAMERA"></span>
          <div class="text-sm font-bold text-navy">Tocar para abrir cámara</div>
          <div class="text-[10px] text-text-muted mt-1">Se verificará tu rostro contra tu foto de perfil</div>
        </div>

        <CameraCapture v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && showCamera" @verify="onFacialVerify" @close="showCamera = false" />

        <!-- Fingerprint info -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'fingerprint'" class="mb-4 p-4 bg-surface rounded-2xl text-center">
          <span class="w-8 h-8 mx-auto mb-2 block text-navy/60" v-html="ICON_FINGERPRINT"></span>
          <div class="text-sm font-bold text-navy">Colocá tu dedo en el lector</div>
          <div class="text-[10px] text-text-muted mt-1">Esperando señal del dispositivo ZKTeco...</div>
          <div class="w-6 h-6 mt-3 mx-auto border-2 border-navy/20 border-t-navy rounded-full animate-spin"></div>
        </div>

        <!-- PIN input -->
        <div v-if="!todayRecord?.clockIn && selectedMethod === 'pin'" class="mb-4">
          <label class="block text-[10px] font-bold text-navy uppercase mb-2">Código PIN</label>
          <input v-model="pinCode" type="password" maxlength="6" placeholder="••••••" class="w-32 text-center px-4 py-3 rounded-full border-2 border-navy/20 text-xl font-bold tracking-widest focus:outline-none focus:border-navy text-navy">
        </div>

        <div v-if="todayRecord" class="mb-6 py-5 border-t border-border">
          <div class="flex items-center justify-center gap-2 mb-4">
            <span class="w-4 h-4 text-text-muted" v-html="methods.find(m => m.value === todayRecord?.method)?.icon || ICON_CLOCK"></span>
            <span class="text-[10px] font-bold text-text-muted uppercase">{{ methods.find(m => m.value === todayRecord?.method)?.label || todayRecord?.method }}</span>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-left">
            <div><span class="text-[10px] text-text-muted uppercase block">Entrada</span><span class="text-sm font-bold text-navy mt-0.5">{{ todayRecord.clockIn ? new Date(todayRecord.clockIn).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Salida</span><span class="text-sm font-bold text-navy mt-0.5">{{ todayRecord.clockOut ? new Date(todayRecord.clockOut).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Descanso</span><span class="text-sm font-bold mt-0.5">{{ todayRecord.breakStart && !todayRecord.breakEnd ? 'En curso' : (todayRecord.breakEnd ? 'Completado' : '—') }}</span></div>
            <div><span class="text-[10px] text-text-muted uppercase block">Horas</span><span class="text-sm font-bold text-teal mt-0.5">{{ todayRecord.totalHours?.toFixed(1) ?? '—' }}h</span></div>
          </div>
        </div>

        <div class="space-y-3">
          <button v-if="!todayRecord?.clockIn" @click="doClockIn"
            class="w-full py-4 bg-teal text-white rounded-full text-lg font-extrabold hover:bg-teal-light transition-all cursor-pointer shadow-lg">
            Fichar Entrada
          </button>
          <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut && !todayRecord?.breakStart" @click="doStartBreak"
            class="w-full py-3 bg-gold/20 text-gold rounded-full text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
            Iniciar Descanso
          </button>
          <button v-if="todayRecord?.breakStart && !todayRecord?.breakEnd" @click="doEndBreak"
            class="w-full py-3 bg-gold/20 text-gold rounded-full text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
            Terminar Descanso
          </button>
          <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut" @click="doClockOut"
            class="w-full py-4 bg-coral text-white rounded-full text-lg font-extrabold hover:bg-coral/80 transition-all cursor-pointer shadow-lg">
            Fichar Salida
          </button>
          <div v-if="todayRecord?.clockOut" class="py-4 bg-teal/5 border border-teal/20 rounded-full flex items-center justify-center gap-2">
            <span class="w-4 h-4 text-teal" v-html="ICON_CHECK"></span>
            <span class="text-teal font-bold text-sm">Jornada completada</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Horarios -->
    <div v-if="activeTab === 'schedules' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Horarios y Turnos</h3>
        <button @click="openNewScheduleModal" class="px-3.5 py-1.5 bg-cyan text-navy rounded-full text-[11px] font-extrabold hover:shadow-lg transition-all cursor-pointer">+ Nuevo Turno</button>
      </div>
      <div class="p-4 grid grid-cols-3 gap-4">
        <div v-for="s in schedules" :key="s.id" class="rounded-[20px] border border-border p-4">
          <div class="font-extrabold text-navy text-sm mb-2">{{ s.name }}</div>
          <div class="text-xs text-text-muted">{{ s.startTime }} → {{ s.endTime }}</div>
          <div class="text-xs text-text-muted">{{ s.breakMinutes }}min descanso · {{ s.graceMinutes }}min tolerancia</div>
          <button @click="deleteSchedule(s)" class="mt-2 text-[11px] text-coral font-bold hover:text-navy transition-colors cursor-pointer">Eliminar</button>
        </div>
      </div>
    </div>

    <!-- Reportes -->
    <div v-if="activeTab === 'reports' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5">
      <h3 class="font-extrabold text-navy text-sm mb-4">Reporte de Asistencia</h3>
      <div class="flex gap-3 mb-4">
        <input v-model="reportFrom" type="date" class="px-4 py-2 rounded-full border border-border text-sm">
        <input v-model="reportTo" type="date" class="px-4 py-2 rounded-full border border-border text-sm">
        <button @click="loadReport" class="px-4 py-2 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light cursor-pointer">Generar</button>
      </div>
      <table v-if="report.length" class="w-full">
        <thead><tr class="border-b"><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Empleado</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Días</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Horas</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Extra</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Faltas</th><th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Tarde</th></tr></thead>
        <tbody><tr v-for="r in report" :key="r.employeeId" class="border-b hover:bg-surface/50"><td class="p-3 text-sm font-bold text-navy">{{ r.employeeId }}</td><td class="p-3 text-sm">{{ r.daysWorked }}</td><td class="p-3 text-sm">{{ r.hoursWorked }}h</td><td class="p-3 text-sm text-gold font-bold">{{ r.overtimeHours }}h</td><td class="p-3 text-sm text-coral">{{ r.absences }}</td><td class="p-3 text-sm text-coral">{{ r.lateArrivals }}</td></tr></tbody>
      </table>
      <div v-if="!report.length" class="p-8 text-center text-text-muted text-sm">Seleccioná un rango de fechas y generá el reporte</div>
    </div>

    <!-- Modal Nuevo Turno -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="newScheduleModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="newScheduleModal = false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">
            <div class="shrink-0 p-6 pb-4">
              <h3 class="text-lg font-black text-navy">Nuevo Turno</h3>
            </div>
            <div class="overflow-y-auto flex-1 px-6 space-y-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre del turno</label>
                <input v-model="newScheduleForm.name" type="text" placeholder="Ej: Turno Mañana" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Hora inicio</label>
                  <input v-model="newScheduleForm.startTime" type="time" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Hora fin</label>
                  <input v-model="newScheduleForm.endTime" type="time" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Descanso (min)</label>
                  <input v-model.number="newScheduleForm.breakMinutes" type="number" min="0" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
                <div>
                  <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tolerancia (min)</label>
                  <input v-model.number="newScheduleForm.graceMinutes" type="number" min="0" class="w-full px-4 py-2.5 rounded-full border border-border text-sm">
                </div>
              </div>
            </div>
            <div class="shrink-0 flex items-center justify-end gap-4 p-6 pt-5">
              <button @click="newScheduleModal = false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="submitNewSchedule" :disabled="creatingSchedule" class="px-4 py-2 bg-cyan text-navy rounded-full text-[11px] font-extrabold hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
                {{ creatingSchedule ? 'Creando...' : 'Crear Turno' }}
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
const showManualRecord = ref(false)
const selectedMethod = ref('pin')
const pinCode = ref('')
const showCamera = ref(false)

const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>'
const ICON_TIMER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>'
const ICON_HASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>'
const ICON_CAMERA = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'
const ICON_FINGERPRINT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>'
const ICON_SMARTPHONE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>'
const ICON_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'

const methods = [
  { value: 'pin', label: 'PIN', icon: ICON_HASH },
  { value: 'facial', label: 'Facial', icon: ICON_CAMERA },
  { value: 'fingerprint', label: 'Huella', icon: ICON_FINGERPRINT },
  { value: 'mobile_gps', label: 'Móvil', icon: ICON_SMARTPHONE },
]

const clockStatusIcon = computed(() => {
  if (todayRecord.value?.clockOut) return ICON_CHECK
  if (todayRecord.value?.clockIn) return ICON_TIMER
  return ICON_CLOCK
})

const tabs = [
  { value: 'clock', label: 'Ponche Digital' },
  { value: 'schedules', label: 'Horarios' },
  { value: 'reports', label: 'Reportes' },
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

async function doClockIn() { try { todayRecord.value = await AttendanceService.clockIn(getEmpId(), selectedMethod.value); toast.success('Entrada registrada (' + (methods.find(m => m.value === selectedMethod.value)?.label || '') + ')') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error al fichar') } }

async function onFacialVerify(success: boolean) {
  showCamera.value = false
  if (success) { await doClockIn() }
  else { toast.error('Rostro no verificado. Intentá de nuevo o usá otro método.') }
}
async function doClockOut() { try { todayRecord.value = await AttendanceService.clockOut(getEmpId()); toast.success('Salida registrada') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doStartBreak() { try { todayRecord.value = await AttendanceService.startBreak(getEmpId()); toast.info('Descanso iniciado') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doEndBreak() { try { todayRecord.value = await AttendanceService.endBreak(getEmpId()); toast.info('Descanso finalizado') } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Error') } }
async function doManualRecord() {
  if (!manualForm.value.employeeId || !manualForm.value.clockIn) { toast.warning('ID empleado y hora entrada requeridos'); return }
  try { await AttendanceService.manualRecord(manualForm.value); toast.success('Fichaje manual registrado'); manualForm.value = { employeeId: '', clockIn: '', clockOut: '', notes: '' } }
  catch { toast.error('Error') }
}

async function loadReport() {
  if (!reportFrom.value || !reportTo.value) { toast.warning('Seleccioná fechas'); return }
  try { report.value = await AttendanceService.getReport(reportFrom.value, reportTo.value) } catch { toast.error('Error') }
}

const newScheduleModal = ref(false)
const creatingSchedule = ref(false)
const newScheduleForm = ref({ name: '', startTime: '06:00', endTime: '14:00', breakMinutes: 30, graceMinutes: 10 })

function openNewScheduleModal() {
  newScheduleForm.value = { name: '', startTime: '06:00', endTime: '14:00', breakMinutes: 30, graceMinutes: 10 }
  newScheduleModal.value = true
}

async function submitNewSchedule() {
  if (!newScheduleForm.value.name.trim() || !newScheduleForm.value.startTime || !newScheduleForm.value.endTime) {
    toast.warning('Nombre, hora inicio y hora fin son obligatorios')
    return
  }
  creatingSchedule.value = true
  try {
    await AttendanceService.createSchedule(newScheduleForm.value)
    toast.success('Turno creado')
    newScheduleModal.value = false
    await loadData()
  } catch { toast.error('Error al crear turno') }
  finally { creatingSchedule.value = false }
}

function deleteSchedule(s: AttendanceSchedule) { AttendanceService.deleteSchedule(s.id).then(() => { toast.success('Turno eliminado'); loadData() }).catch(() => toast.error('Error')) }
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
