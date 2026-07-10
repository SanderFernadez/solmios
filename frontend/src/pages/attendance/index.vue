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
        class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span class="w-4 h-4 shrink-0" v-html="tab.icon"></span>
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <!-- Ponche Digital -->
    <div v-if="activeTab === 'clock' && !loading">
      <!-- Herramientas de Supervisor (colapsable, arriba del widget personal) -->
      <div class="max-w-md mx-auto mb-4">
        <button @click="showSupervisorTools = !showSupervisorTools"
          class="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:border-navy/30 transition-colors cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
            <span class="w-4 h-4 text-navy" v-html="ICON_USERS"></span>
          </div>
          <div class="flex-1 text-left">
            <div class="text-sm font-extrabold text-navy leading-none">Herramientas de Supervisor</div>
            <div class="text-[10px] text-text-muted mt-1">Registrar fichaje manual</div>
          </div>
          <span class="w-4 h-4 text-text-muted shrink-0 transition-transform" :class="showSupervisorTools ? 'rotate-180' : ''" v-html="ICON_CHEVRON_DOWN"></span>
        </button>

        <div v-if="showSupervisorTools" class="card p-5 mt-2 border-l-4 border-l-navy/30">
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Empleado</label>
              <input v-model="manualForm.employeeId" placeholder="ID del empleado" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Hora de entrada</label>
                <input v-model="manualForm.clockIn" type="datetime-local" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Hora de salida <span class="normal-case font-normal text-text-muted/70">(opcional)</span></label>
                <input v-model="manualForm.clockOut" type="datetime-local" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-1.5">Motivo</label>
              <input v-model="manualForm.notes" placeholder="Ej: Olvidó marcar entrada, dispositivo sin conexión..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
            </div>
            <button @click="doManualRecord" class="w-full flex items-center justify-center gap-2 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_CHECK_CIRCLE"></span>Registrar Manualmente
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-md mx-auto">
        <div class="card p-8 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            :class="todayRecord?.clockIn && !todayRecord?.clockOut ? 'bg-cyan/10 text-cyan' : todayRecord?.clockOut ? 'bg-teal/10 text-teal' : 'bg-navy/5 text-navy/40'">
            <span class="w-9 h-9 shrink-0" :class="todayRecord?.clockIn && !todayRecord?.clockOut ? 'animate-pulse' : ''" v-html="todayRecord?.clockOut ? ICON_CHECK_CIRCLE : ICON_CLOCK"></span>
          </div>
          <div class="text-2xl font-black text-navy mb-2">{{ now }}</div>
          <div class="text-sm text-text-secondary mb-6">{{ today }}</div>

          <!-- Método selector -->
          <div v-if="!todayRecord?.clockIn" class="mb-6">
            <div class="text-[10px] font-bold text-navy uppercase tracking-wide mb-3">Método de fichaje</div>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="m in methods" :key="m.value" @click="selectedMethod = m.value"
                class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
                :class="selectedMethod === m.value ? 'border-navy bg-navy/5 shadow-md' : 'border-border hover:border-navy/30'">
                <span class="w-5 h-5 mx-auto mb-1 block" :class="selectedMethod === m.value ? 'text-navy' : 'text-text-muted'" v-html="m.icon"></span>
                <div class="text-[9px] font-bold" :class="selectedMethod === m.value ? 'text-navy' : 'text-text-muted'">{{ m.label }}</div>
              </button>
            </div>
          </div>

          <!-- Camera for facial -->
          <div v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && !showCamera" class="mb-4 p-4 bg-surface rounded-xl text-center cursor-pointer hover:bg-navy/5 transition-colors" @click="showCamera = true">
            <span class="w-8 h-8 mx-auto mb-2 text-navy block" v-html="ICON_CAMERA"></span>
            <div class="text-sm font-bold text-navy">Tocar para abrir cámara</div>
            <div class="text-[10px] text-text-muted mt-1">Se verificará tu rostro contra tu foto de perfil</div>
          </div>

          <CameraCapture v-if="!todayRecord?.clockIn && selectedMethod === 'facial' && showCamera" @verify="onFacialVerify" @close="showCamera = false" />

          <!-- Fingerprint info -->
          <div v-if="!todayRecord?.clockIn && selectedMethod === 'fingerprint'" class="mb-4 p-4 bg-surface rounded-xl text-center">
            <span class="w-8 h-8 mx-auto mb-2 text-navy block" v-html="ICON_FINGERPRINT"></span>
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
              <span class="w-4 h-4 text-navy shrink-0" v-html="methods.find(m => m.value === todayRecord?.method)?.icon || ICON_CLOCK"></span>
              <span class="text-[10px] font-bold text-text-muted">{{ methods.find(m => m.value === todayRecord?.method)?.label || todayRecord?.method }}</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-left">
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 text-teal shrink-0" v-html="ICON_LOGIN"></span>
                <div><span class="text-[10px] text-text-muted uppercase block">Entrada</span><span class="text-sm font-bold text-navy">{{ todayRecord.clockIn ? new Date(todayRecord.clockIn).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 text-coral shrink-0" v-html="ICON_LOGOUT"></span>
                <div><span class="text-[10px] text-text-muted uppercase block">Salida</span><span class="text-sm font-bold text-navy">{{ todayRecord.clockOut ? new Date(todayRecord.clockOut).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'}) : '—' }}</span></div>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 text-gold shrink-0" v-html="ICON_COFFEE"></span>
                <div><span class="text-[10px] text-text-muted uppercase block">Descanso</span><span class="text-sm font-bold">{{ todayRecord.breakStart && !todayRecord.breakEnd ? 'En curso' : (todayRecord.breakEnd ? 'Completado' : '—') }}</span></div>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-4 h-4 text-teal shrink-0" v-html="ICON_CLOCK"></span>
                <div><span class="text-[10px] text-text-muted uppercase block">Horas</span><span class="text-sm font-bold text-teal">{{ todayRecord.totalHours?.toFixed(1) ?? '—' }}h</span></div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button v-if="!todayRecord?.clockIn" @click="doClockIn"
              class="w-full flex items-center justify-center gap-2 py-4 bg-teal text-white rounded-2xl text-lg font-extrabold hover:bg-teal-light transition-all cursor-pointer shadow-lg">
              <span class="w-5 h-5 shrink-0" v-html="ICON_CLOCK"></span>Fichar Entrada
            </button>
            <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut && !todayRecord?.breakStart" @click="doStartBreak"
              class="w-full flex items-center justify-center gap-2 py-3 bg-gold/20 text-gold rounded-xl text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_COFFEE"></span>Iniciar Descanso
            </button>
            <button v-if="todayRecord?.breakStart && !todayRecord?.breakEnd" @click="doEndBreak"
              class="w-full flex items-center justify-center gap-2 py-3 bg-gold/20 text-gold rounded-xl text-sm font-bold hover:bg-gold/30 transition-all cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_COFFEE"></span>Terminar Descanso
            </button>
            <button v-if="todayRecord?.clockIn && !todayRecord?.clockOut" @click="doClockOut"
              class="w-full flex items-center justify-center gap-2 py-4 bg-coral text-white rounded-2xl text-lg font-extrabold hover:bg-coral/80 transition-all cursor-pointer shadow-lg">
              <span class="w-5 h-5 shrink-0" v-html="ICON_HOME"></span>Fichar Salida
            </button>
            <div v-if="todayRecord?.clockOut" class="flex items-center justify-center gap-2 py-4 bg-teal/5 border border-teal/20 rounded-xl">
              <span class="w-4 h-4 text-teal shrink-0" v-html="ICON_CHECK_CIRCLE"></span>
              <span class="text-teal font-bold text-sm">Jornada completada</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Horarios -->
    <div v-if="activeTab === 'schedules' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-extrabold text-navy text-sm">Horarios y Turnos</h3>
        <button @click="openNewSchedule" class="flex items-center gap-1 px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo Turno
        </button>
      </div>
      <div v-if="schedules.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CALENDAR"></span>
        <p class="text-text-muted text-sm">No hay turnos configurados</p>
      </div>
      <div v-else class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="s in schedules" :key="s.id" class="p-4 bg-surface rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <div class="font-extrabold text-navy text-sm">{{ s.name }}</div>
            <button @click="deleteSchedule(s)" class="text-coral hover:bg-coral/10 rounded-lg p-1 cursor-pointer">
              <span class="w-3.5 h-3.5 shrink-0 block" v-html="ICON_TRASH"></span>
            </button>
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3.5 h-3.5 text-navy shrink-0" v-html="ICON_CLOCK"></span>{{ s.startTime }} → {{ s.endTime }}</div>
            <div class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3.5 h-3.5 text-gold shrink-0" v-html="ICON_COFFEE"></span>{{ s.breakMinutes }}min descanso</div>
            <div class="flex items-center gap-1.5 text-xs text-text-secondary"><span class="w-3.5 h-3.5 text-cyan shrink-0" v-html="ICON_ALARM"></span>{{ s.graceMinutes }}min tolerancia</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reportes -->
    <div v-if="activeTab === 'reports' && !loading" class="space-y-4">
      <div class="card p-5">
        <h3 class="font-extrabold text-navy text-sm mb-4">Reporte de Asistencia</h3>
        <div class="flex flex-wrap gap-3">
          <input v-model="reportFrom" type="date" class="px-4 py-2 rounded-xl border border-border text-sm">
          <input v-model="reportTo" type="date" class="px-4 py-2 rounded-xl border border-border text-sm">
          <button @click="loadReport" class="flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_CHART"></span>Generar
          </button>
        </div>
      </div>

      <div v-if="report.length" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10"><span class="w-5 h-5 text-navy" v-html="ICON_CALENDAR"></span></div>
            <div class="min-w-0"><div class="text-xl font-black leading-none text-navy truncate">{{ reportTotals.days }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Días Trabajados</div></div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10"><span class="w-5 h-5 text-teal" v-html="ICON_CLOCK"></span></div>
            <div class="min-w-0"><div class="text-xl font-black leading-none text-teal truncate">{{ reportTotals.hours }}h</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Horas Totales</div></div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10"><span class="w-5 h-5 text-gold" v-html="ICON_CLOCK"></span></div>
            <div class="min-w-0"><div class="text-xl font-black leading-none text-gold truncate">{{ reportTotals.overtime }}h</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Horas Extra</div></div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10"><span class="w-5 h-5 text-coral" v-html="ICON_ALARM"></span></div>
            <div class="min-w-0"><div class="text-xl font-black leading-none text-coral truncate">{{ reportTotals.absences }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Faltas</div></div>
          </div>
        </div>
      </div>

      <div class="card overflow-hidden">
        <div v-if="report.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-surface/50">
                <th class="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Empleado</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Días</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Horas</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Extra</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Faltas</th>
                <th class="text-right px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tarde</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in report" :key="r.employeeId" class="border-b border-border/60 last:border-0 hover:bg-surface/50 transition-colors">
                <td class="px-4 py-2.5 font-bold text-navy whitespace-nowrap">{{ getEmployeeName(r.employeeId) }}</td>
                <td class="px-4 py-2.5 text-right text-text-secondary">{{ r.daysWorked }}</td>
                <td class="px-4 py-2.5 text-right text-text-secondary">{{ r.hoursWorked }}h</td>
                <td class="px-4 py-2.5 text-right text-gold font-bold">{{ r.overtimeHours }}h</td>
                <td class="px-4 py-2.5 text-right text-coral font-bold">{{ r.absences }}</td>
                <td class="px-4 py-2.5 text-right text-coral font-bold">{{ r.lateArrivals }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="p-12 text-center">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CHART"></span>
          <p class="text-text-muted text-sm">Seleccioná un rango de fechas y generá el reporte</p>
        </div>
      </div>
    </div>

    <FormModal
      v-if="scheduleModal"
      title="Nuevo Turno"
      :fields="scheduleFields"
      :loading="savingSchedule"
      submit-label="Crear Turno"
      @close="scheduleModal = false"
      @submit="createSchedule"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { AttendanceService, type AttendanceRecord, type AttendanceSchedule, type AttendanceReportRow } from '@/services/Attendance.service'
import { EmpleadosService, type EmployeeProfile } from '@/services/Empleados.service'
import { useToast } from '@/composables/useToast'
import CameraCapture from '@/components/features/CameraCapture.vue'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'

const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 1.5 1.5 3.75-3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CAMERA = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.114-1.132.183-.966.178-1.643 1.024-1.643 1.995v9.092c0 1.286 1.042 2.25 2.25 2.25h15.198c1.208 0 2.25-.964 2.25-2.25V9.408c0-.971-.677-1.817-1.643-1.995a48.108 48.108 0 0 0-1.132-.183 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"/></svg>'
const ICON_FINGERPRINT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.464 7.464 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993M12 3c1.313 0 2.548.317 3.638.879M12 21c1.83-1.128 3.202-2.812 4.03-4.744m-1.276-3.53a3 3 0 1 0-5.507 2.42c-.166.416-.348.826-.545 1.229M9 12a3.75 3.75 0 0 0-.723 2.212"/></svg>'
const ICON_HASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h13.5M5.25 15.75h13.5M9.75 3.75 6.75 20.25M17.25 3.75l-3 16.5"/></svg>'
const ICON_PHONE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75A2.25 2.25 0 0 0 15.75 1.5H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3"/></svg>'
const ICON_COFFEE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25h13.5v6.75a4.5 4.5 0 0 1-4.5 4.5h-4.5a4.5 4.5 0 0 1-4.5-4.5V8.25Zm13.5 1.5h1.5a2.25 2.25 0 0 1 0 4.5h-1.5M9 3v2.25M12 3v2.25M15 3v2.25"/></svg>'
const ICON_HOME = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955a1.5 1.5 0 0 1 2.122 0L22.25 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>'
const ICON_LOGIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V4.5A1.5 1.5 0 0 1 10.5 3h6A1.5 1.5 0 0 1 18 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 9 19.5v-2.25M12 12h9m0 0-3-3m3 3-3 3"/></svg>'
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15 6.75V4.5A1.5 1.5 0 0 0 13.5 3h-6A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h6a1.5 1.5 0 0 0 1.5-1.5v-2.25M21 12h-9m0 0 3-3m-3 3 3 3"/></svg>'
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_ALARM = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-1.5a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-9v1.5m-6.364.879.879.879M20.485 4.257l-.879.879"/></svg>'
const ICON_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>'

const toast = useToast()
const activeTab = ref('clock')
const loading = ref(true)
const now = ref(''); const today = ref('')

const todayRecord = ref<AttendanceRecord | null>(null)
const schedules = ref<AttendanceSchedule[]>([])
const report = ref<AttendanceReportRow[]>([])
const reportFrom = ref(''); const reportTo = ref('')
const manualForm = ref({ employeeId: '', clockIn: '', clockOut: '', notes: '' })
const selectedMethod = ref('pin')
const pinCode = ref('')
const showCamera = ref(false)
const showSupervisorTools = ref(false)
const profiles = ref<EmployeeProfile[]>([])

const methods = [
  { value: 'pin', label: 'PIN', icon: ICON_HASH },
  { value: 'facial', label: 'Facial', icon: ICON_CAMERA },
  { value: 'fingerprint', label: 'Huella', icon: ICON_FINGERPRINT },
  { value: 'mobile_gps', label: 'Móvil', icon: ICON_PHONE },
]

const tabs = [
  { value: 'clock', label: 'Ponche Digital', icon: ICON_CLOCK },
  { value: 'schedules', label: 'Horarios', icon: ICON_CALENDAR },
  { value: 'reports', label: 'Reportes', icon: ICON_CHART },
]

const reportTotals = computed(() => ({
  days: report.value.reduce((s, r) => s + (r.daysWorked || 0), 0),
  hours: report.value.reduce((s, r) => s + (r.hoursWorked || 0), 0),
  overtime: report.value.reduce((s, r) => s + (r.overtimeHours || 0), 0),
  absences: report.value.reduce((s, r) => s + (r.absences || 0), 0),
}))

function getEmployeeName(employeeId: string): string {
  if (!employeeId) return '—'
  const p = profiles.value.find(x => x.userId === employeeId || x.id === employeeId)
  return p?.userName || p?.position || employeeId.slice(0, 8)
}

function updateClock() { const d = new Date(); now.value = d.toLocaleTimeString('es'); today.value = d.toLocaleDateString('es', { weekday:'long', day:'numeric', month:'long' }) }

async function loadData() {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const empId = user.id || 'e1'
    const [rec, sch, profRes] = await Promise.allSettled([AttendanceService.getToday(empId), AttendanceService.listSchedules(), EmpleadosService.listProfiles()])
    todayRecord.value = rec.status === 'fulfilled' ? rec.value : null
    schedules.value = sch.status === 'fulfilled' ? sch.value : []
    profiles.value = profRes.status === 'fulfilled' ? (profRes.value.data ?? []) : []
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

const scheduleModal = ref(false)
const savingSchedule = ref(false)
const scheduleFields: FormField[] = [
  { key: 'name', label: 'Nombre del turno', required: true, placeholder: 'Mañana' },
  { key: 'startTime', label: 'Hora inicio', type: 'text', required: true, default: '06:00', placeholder: 'HH:MM' },
  { key: 'endTime', label: 'Hora fin', type: 'text', required: true, default: '14:00', placeholder: 'HH:MM' },
  { key: 'breakMinutes', label: 'Descanso (min)', type: 'number', min: 0, default: 30 },
  { key: 'graceMinutes', label: 'Tolerancia (min)', type: 'number', min: 0, default: 10 },
]

function openNewSchedule() { scheduleModal.value = true }

async function createSchedule(values: Record<string, string | number>) {
  savingSchedule.value = true
  try {
    await AttendanceService.createSchedule(values as unknown as Partial<AttendanceSchedule>)
    toast.success('Turno creado')
    scheduleModal.value = false
    loadData()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'Error al crear el turno')
  } finally {
    savingSchedule.value = false
  }
}

async function deleteSchedule(s: AttendanceSchedule) {
  if (!confirm(`¿Eliminar el turno "${s.name}"?`)) return
  try { await AttendanceService.deleteSchedule(s.id); toast.success('Turno eliminado'); loadData() }
  catch { toast.error('Error al eliminar el turno') }
}
</script>
