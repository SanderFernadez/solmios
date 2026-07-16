<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="roomId" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="$emit('close')"></div>
        <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[88vh]">
          <!-- Header -->
          <div class="shrink-0 p-5 pb-3 flex items-start justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center shrink-0 text-navy">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                  <rect x="5" y="10" width="14" height="11" rx="2"/><path stroke-linecap="round" d="M8 10V7a4 4 0 0 1 8 0v3"/>
                  <circle cx="9" cy="14.5" r="0.7" fill="currentColor"/><circle cx="12" cy="14.5" r="0.7" fill="currentColor"/><circle cx="15" cy="14.5" r="0.7" fill="currentColor"/>
                  <circle cx="9" cy="17.5" r="0.7" fill="currentColor"/><circle cx="12" cy="17.5" r="0.7" fill="currentColor"/><circle cx="15" cy="17.5" r="0.7" fill="currentColor"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-lg font-black text-navy leading-tight">Cerradura · Hab {{ roomNumber }}</h3>
                <p class="text-xs text-text-muted truncate">{{ lock ? (lock.name || 'Cerradura TTLock') : 'Acceso de la habitación' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="lock" class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lock.status === 'online' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ lock.status === 'online' ? '● online' : 'offline' }}</span>
              <span v-if="lock" class="text-[10px] font-bold" :class="(lock.batteryLevel||0) > 50 ? 'text-teal' : (lock.batteryLevel||0) > 20 ? 'text-gold' : 'text-coral'">🔋 {{ lock.batteryLevel || 0 }}%</span>
              <button @click="$emit('close')" class="text-text-muted hover:text-navy transition-colors cursor-pointer text-lg leading-none">✕</button>
            </div>
          </div>

          <!-- Tabs -->
          <div v-if="lock" class="shrink-0 px-5 flex gap-1 border-b border-border overflow-x-auto">
            <button v-for="t in tabs" :key="t.key" @click="selectTab(t.key)"
              class="px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap"
              :class="tab === t.key ? 'border-navy text-navy' : 'border-transparent text-text-muted hover:text-navy'">
              {{ t.label }}
            </button>
          </div>

          <!-- Body -->
          <div class="overflow-y-auto flex-1 p-5">
            <div v-if="loading" class="flex items-center justify-center gap-2 text-xs text-text-muted py-8">
              <span class="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin"></span>
              Cargando…
            </div>

            <template v-else>
              <!-- Sin cerradura asignada -->
              <div v-if="!lock" class="text-center py-8">
                <div class="text-3xl mb-2">🔓</div>
                <p class="text-sm font-bold text-navy">Sin cerradura asignada</p>
                <p class="text-xs text-text-muted mt-1">Asigná una cerradura a esta habitación desde <router-link to="/panel/cerraduras" class="text-cyan underline">Cerraduras</router-link>.</p>
              </div>

              <!-- Tab Cerradura -->
              <div v-else-if="tab === 'device'" class="space-y-3">
                <div class="flex justify-between text-xs"><span class="text-text-muted">Nombre</span><span class="font-bold text-navy">{{ lock.name || '—' }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-text-muted">ID TTLock</span><span class="font-mono text-text-secondary">{{ lock.ttlockLockId || '—' }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-text-muted">MAC</span><span class="font-mono text-text-secondary">{{ lock.mac || '—' }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-text-muted">Batería</span>
                  <span class="font-bold" :class="(lock.batteryLevel||0) > 50 ? 'text-teal' : (lock.batteryLevel||0) > 20 ? 'text-gold' : 'text-coral'">{{ lock.batteryLevel || 0 }}%</span>
                </div>
                <div class="flex justify-between text-xs items-center"><span class="text-text-muted">Estado</span>
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lock.status === 'online' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ lock.status || 'offline' }}</span>
                </div>
                <button @click="unlockDoor" :disabled="unlocking || lock.status !== 'online'"
                  class="w-full mt-2 py-2.5 bg-navy text-white text-xs font-bold rounded-full hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>
                  {{ unlocking ? 'Abriendo…' : 'Abrir puerta' }}
                </button>
                <p v-if="lock.status !== 'online'" class="text-[10px] text-text-muted text-center">La cerradura debe estar online para abrir en remoto.</p>
              </div>

              <!-- Tab Códigos (BD / reservas) -->
              <div v-else-if="tab === 'codes'" class="space-y-3">
                <button v-if="reservationId" @click="generate" :disabled="generating"
                  class="w-full py-2.5 bg-teal text-white text-xs font-bold rounded-full hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">
                  {{ generating ? 'Generando…' : '+ Generar código para la reserva de hoy' }}
                </button>
                <p v-else class="text-[11px] text-text-muted text-center">Sin reserva activa hoy. Los códigos se generan desde la reserva o al pagarse la seña.</p>

                <div v-for="c in codes" :key="c.id" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
                  <code class="text-sm font-mono font-bold text-navy">{{ c.code }}</code>
                  <span class="text-[10px] text-text-muted shrink-0">{{ c.startDate || '?' }} → {{ c.endDate || '?' }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-auto" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status }}</span>
                  <button v-if="c.status === 'active'" @click="revoke(c)" class="text-[10px] font-bold text-coral hover:text-navy transition-colors cursor-pointer shrink-0">Revocar</button>
                </div>
                <p v-if="!codes.length" class="text-xs text-text-muted text-center py-4">Sin códigos de reserva para esta cerradura.</p>
              </div>

              <!-- Tab Códigos activos (hardware) -->
              <div v-else-if="tab === 'active'">
                <div v-if="activeLoading" class="text-center text-xs text-text-muted py-6">Leyendo la cerradura…</div>
                <template v-else>
                  <p class="text-[11px] text-text-muted mb-3">PIN reales vivos en la cerradura (leídos del hardware).</p>
                  <div v-for="c in activeCodes" :key="c.keyboardPwdId" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2 mb-2">
                    <code class="text-sm font-mono font-bold text-navy">{{ c.keyboardPwd || '••••' }}</code>
                    <span class="text-[10px] text-text-secondary truncate">{{ c.keyboardPwdName || '—' }}</span>
                    <span class="text-[10px] text-text-muted shrink-0 ml-auto">{{ fmtMs(c.startDate) }} → {{ fmtMs(c.endDate) }}</span>
                    <button @click="deleteActive(c)" :disabled="deletingId === c.keyboardPwdId" class="text-[10px] font-bold text-coral hover:text-navy transition-colors cursor-pointer shrink-0 disabled:opacity-50">{{ deletingId === c.keyboardPwdId ? '…' : 'Borrar' }}</button>
                  </div>
                  <p v-if="!activeCodes.length" class="text-xs text-text-muted text-center py-4">La cerradura no tiene códigos activos ahora.</p>
                </template>
              </div>

              <!-- Tab Registros (actividad) -->
              <div v-else-if="tab === 'records'">
                <div v-if="recordsLoading" class="text-center text-xs text-text-muted py-6">Cargando historial…</div>
                <template v-else>
                  <p class="text-[11px] text-text-muted mb-3">Actividad de los últimos 30 días.</p>
                  <div v-for="r in records" :key="r.recordId" class="flex items-center gap-2 border-b border-border py-2 last:border-0">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="r.success === 1 ? 'bg-teal' : 'bg-coral'"></span>
                    <span class="text-xs font-bold text-navy">{{ recordTypeLabel(r.recordType) }}</span>
                    <span v-if="r.keyboardPwd" class="text-[11px] font-mono text-text-secondary">{{ r.keyboardPwd }}</span>
                    <span class="text-[10px] text-text-muted shrink-0 ml-auto">{{ fmtMs(r.lockDate) }}</span>
                  </div>
                  <p v-if="!records.length" class="text-xs text-text-muted text-center py-4">Sin registros en los últimos 30 días.</p>
                </template>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { TTLockService, type LockDevice, type LockCode, type LockActiveCode, type LockRecord } from '@/services/TTLock.service'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  roomId: string | null
  roomNumber: string
  reservationId: string | null
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'changed'): void }>()

const toast = useToast()
type LockTab = 'device' | 'codes' | 'active' | 'records'
const tabs: { key: LockTab; label: string }[] = [
  { key: 'device', label: 'Cerradura' },
  { key: 'codes', label: 'Códigos' },
  { key: 'active', label: 'Activos' },
  { key: 'records', label: 'Registros' },
]
const tab = ref<LockTab>('device')
const loading = ref(false)
const generating = ref(false)
const unlocking = ref(false)
const deletingId = ref<number | null>(null)
const lock = ref<LockDevice | null>(null)
const codes = ref<LockCode[]>([])

const activeCodes = ref<LockActiveCode[]>([])
const activeLoading = ref(false)
const activeLoaded = ref(false)
const records = ref<LockRecord[]>([])
const recordsLoading = ref(false)
const recordsLoaded = ref(false)

function fmtMs(ms?: number) {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const RECORD_TYPE: Record<number, string> = {
  1: 'Apertura app', 4: 'Apertura código', 7: 'Tarjeta', 8: 'Huella',
  11: 'Bloqueo', 12: 'Operación gateway', 46: 'Apertura remota', 47: 'Apertura remota',
}
function recordTypeLabel(t?: number) { return t != null ? (RECORD_TYPE[t] || `Evento ${t}`) : '—' }

function selectTab(k: LockTab) {
  tab.value = k
  if (k === 'active' && !activeLoaded.value) loadActive()
  if (k === 'records' && !recordsLoaded.value) loadRecords()
}

async function load() {
  if (!props.roomId) return
  loading.value = true
  activeLoaded.value = false; recordsLoaded.value = false
  activeCodes.value = []; records.value = []
  try {
    const [locksRes, codesRes] = await Promise.all([TTLockService.listLocks(), TTLockService.listCodes()])
    lock.value = (locksRes.data || []).find(l => l.roomId === props.roomId) || null
    codes.value = lock.value ? (codesRes.data || []).filter(c => c.lockId === lock.value!.id) : []
  } catch {
    toast.error('No se pudo cargar la cerradura')
  } finally {
    loading.value = false
  }
}

async function loadActive() {
  if (!lock.value?.id) return
  activeLoading.value = true
  try {
    const r = await TTLockService.listActiveCodes(lock.value.id)
    activeCodes.value = r.data || []
    activeLoaded.value = true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudieron leer los códigos del hardware')
  } finally {
    activeLoading.value = false
  }
}

async function loadRecords() {
  if (!lock.value?.id) return
  recordsLoading.value = true
  try {
    const r = await TTLockService.listLockRecords(lock.value.id)
    records.value = (r.data || []).sort((a, b) => (b.lockDate || 0) - (a.lockDate || 0))
    recordsLoaded.value = true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo leer el historial')
  } finally {
    recordsLoading.value = false
  }
}

async function unlockDoor() {
  if (!lock.value?.id || unlocking.value) return
  unlocking.value = true
  try {
    await TTLockService.unlockLock(lock.value.id)
    toast.success('Puerta abierta')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo abrir la puerta')
  } finally {
    unlocking.value = false
  }
}

async function deleteActive(c: LockActiveCode) {
  if (!lock.value?.id || deletingId.value != null) return
  deletingId.value = c.keyboardPwdId
  try {
    await TTLockService.deletePasscode(lock.value.id, c.keyboardPwdId)
    await loadActive()
    emit('changed')
    toast.success('Código borrado de la cerradura')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo borrar el código')
  } finally {
    deletingId.value = null
  }
}

async function generate() {
  if (!props.reservationId || generating.value) return
  generating.value = true
  try {
    await TTLockService.generateCode(props.reservationId)
    await load()
    activeLoaded.value = false
    emit('changed')
    toast.success('Código generado en la cerradura')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo generar el código')
  } finally {
    generating.value = false
  }
}

async function revoke(code: LockCode) {
  if (!code.id) return
  try {
    await TTLockService.revokeCode(code.id)
    await load()
    activeLoaded.value = false
    emit('changed')
    toast.success('Código revocado y borrado de la cerradura')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo revocar el código')
  }
}

watch(() => props.roomId, (id) => {
  if (id) { tab.value = 'device'; load() }
})
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
