<template>
  <AppModal :open="!!roomId" size="xl" body-class="p-0" @close="$emit('close')">
    <template #header>
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-white">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="5" y="10" width="14" height="11" rx="2"/><path stroke-linecap="round" d="M8 10V7a4 4 0 0 1 8 0v3"/>
            <circle cx="9" cy="14.5" r="0.7" fill="currentColor"/><circle cx="12" cy="14.5" r="0.7" fill="currentColor"/><circle cx="15" cy="14.5" r="0.7" fill="currentColor"/>
            <circle cx="9" cy="17.5" r="0.7" fill="currentColor"/><circle cx="12" cy="17.5" r="0.7" fill="currentColor"/><circle cx="15" cy="17.5" r="0.7" fill="currentColor"/>
          </svg>
        </div>
        <div class="min-w-0">
          <h3 class="text-lg sm:text-xl font-black text-white truncate">Cerradura · Hab {{ roomNumber }}</h3>
          <p class="text-sm text-white/60 mt-0.5 truncate">{{ lock ? (lock.name || 'Cerradura TTLock') : 'Acceso de la habitación' }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-auto">
          <span v-if="lock" class="text-[11px] font-bold px-2 py-1 rounded-full" :class="lock.status === 'online' ? 'bg-teal/20 text-teal-light' : 'bg-white/10 text-white/60'">{{ lock.status === 'online' ? '● online' : 'offline' }}</span>
          <span v-if="lock" class="text-xs font-bold text-white/80">🔋 {{ lock.batteryLevel || 0 }}%</span>
        </div>
      </div>
    </template>

    <!-- Tabs -->
    <div v-if="lock" class="shrink-0 px-5 pt-4 flex gap-1 border-b border-border overflow-x-auto">
      <button v-for="t in tabs" :key="t.key" @click="selectTab(t.key)"
        class="px-3 py-2 text-sm font-bold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
        :class="tab === t.key ? 'border-navy text-navy' : 'border-transparent text-text-muted hover:text-navy'">
        {{ t.label }}
        <span v-if="t.key === 'errors' && errorCount > 0" class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-coral/10 text-coral">{{ errorCount }}</span>
      </button>
    </div>

    <!-- Body -->
    <div class="p-6">
      <div v-if="loading" class="flex items-center justify-center gap-2 text-sm text-text-muted py-8">
        <span class="inline-block w-3 h-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin"></span>
        Cargando…
      </div>

      <template v-else>
              <!-- Sin cerradura asignada: asignar una desde acá mismo -->
              <div v-if="!lock" class="py-6">
                <div class="text-center mb-4">
                  <div class="text-3xl mb-2">🔓</div>
                  <p class="text-sm font-bold text-navy">Sin cerradura asignada</p>
                  <p class="text-sm text-text-muted mt-1">Asigná una cerradura sincronizada a esta habitación.</p>
                </div>
                <div v-if="availableLocks.length" class="space-y-2">
                  <select v-model="assignLockId" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
                    <option value="">Elegí una cerradura…</option>
                    <option v-for="l in availableLocks" :key="l.id" :value="l.id">{{ l.name || l.id }}</option>
                  </select>
                  <button @click="assignLock" :disabled="!assignLockId || assigning" class="w-full py-2.5 bg-navy text-white text-sm font-bold rounded-full hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ assigning ? 'Asignando…' : 'Asignar cerradura' }}</button>
                </div>
                <p v-else class="text-sm text-text-muted text-center">No hay cerraduras sincronizadas sin asignar. Sincronizá tus cerraduras TTLock primero.</p>
              </div>

              <!-- Tab Cerradura -->
              <div v-else-if="tab === 'device'" class="space-y-3">
                <!-- 2 columnas en desktop: con el modal xl (max-w-5xl) la info deja de apilarse
                     en una columna angosta (queja real de recepción: "se ve super pequeño"). -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
                  <div class="flex justify-between text-sm"><span class="text-text-muted">Nombre</span><span class="font-bold text-navy">{{ lock.name || '—' }}</span></div>
                  <div class="flex justify-between text-sm"><span class="text-text-muted">Batería</span>
                    <span class="font-bold" :class="(lock.batteryLevel||0) > 50 ? 'text-teal' : (lock.batteryLevel||0) > 20 ? 'text-gold' : 'text-coral'">{{ lock.batteryLevel || 0 }}%</span>
                  </div>
                  <div class="flex justify-between text-sm"><span class="text-text-muted">MAC</span><span class="font-mono text-text-secondary">{{ lock.mac || '—' }}</span></div>
                  <div class="flex justify-between text-sm items-center"><span class="text-text-muted">Estado</span>
                    <span class="text-[11px] font-bold px-2 py-1 rounded-full" :class="lock.status === 'online' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ lock.status || 'offline' }}</span>
                  </div>
                </div>

                <!-- Toggle: auto-generar el código al pagarse la seña, por cerradura -->
                <div class="flex justify-between items-center text-sm pt-1">
                  <span class="text-text-muted">Códigos automáticos <span class="text-[11px]">(al pagar la seña)</span></span>
                  <button @click="toggleAutoCodes" :disabled="togglingAuto" class="relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:opacity-50 shrink-0" :class="autoOn ? 'bg-teal' : 'bg-gray-300'" :title="autoOn ? 'Activado' : 'Desactivado'">
                    <span class="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" :class="autoOn ? 'left-4' : 'left-0.5'"></span>
                  </button>
                </div>

                <!-- Gateway (dónde está conectada) -->
                <div class="pt-2 border-t border-border">
                  <div class="text-[11px] font-bold text-text-muted uppercase mb-1.5">Gateway</div>
                  <div v-if="gatewayLoading" class="text-sm text-text-muted">Buscando gateway…</div>
                  <div v-else-if="!gateways.length" class="text-sm text-coral">Sin gateway en rango. La cerradura no puede operarse en remoto.</div>
                  <div v-else v-for="g in gateways" :key="g.gatewayId" class="flex items-center justify-between text-sm">
                    <span class="font-bold text-navy">{{ g.gatewayName || ('Gateway ' + g.gatewayId) }}</span>
                    <span class="font-bold" :class="signalClass(g.rssi)">{{ signalLabel(g.rssi) }}<span class="text-text-muted font-normal"> ({{ g.rssi }} dBm)</span></span>
                  </div>
                </div>

                <button @click="unlockDoor" :disabled="unlocking || lock.status !== 'online'"
                  class="w-full mt-2 py-2.5 bg-navy text-white text-sm font-bold rounded-full hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path stroke-linecap="round" d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>
                  {{ unlocking ? 'Abriendo…' : 'Abrir puerta' }}
                </button>
                <p v-if="lock.status !== 'online'" class="text-[11px] text-text-muted text-center">La cerradura debe estar online para abrir en remoto.</p>

                <!-- Cambiar / desasignar la cerradura de esta habitación -->
                <div class="pt-2 border-t border-border">
                  <button v-if="!showReassign" @click="showReassign = true" class="text-xs font-bold text-text-muted hover:text-navy transition-colors cursor-pointer">Cambiar / desasignar cerradura</button>
                  <div v-else class="space-y-2">
                    <div class="flex gap-2">
                      <select v-model="assignLockId" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                        <option value="">Cambiar a…</option>
                        <option v-for="l in availableLocks" :key="l.id" :value="l.id">{{ l.name || l.id }}</option>
                      </select>
                      <button @click="assignLock" :disabled="!assignLockId || assigning" class="px-3 py-2 bg-navy text-white text-sm font-bold rounded-lg hover:bg-navy-light disabled:opacity-50 cursor-pointer">Cambiar</button>
                    </div>
                    <div class="flex items-center gap-2">
                      <button @click="unassignLock" :disabled="assigning" class="text-xs font-bold text-coral hover:text-navy transition-colors cursor-pointer disabled:opacity-50">Desasignar de esta habitación</button>
                      <button @click="showReassign = false" class="text-xs font-bold text-text-muted hover:text-navy transition-colors cursor-pointer ml-auto">Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab Códigos (BD / reservas) -->
              <div v-else-if="tab === 'codes'" class="space-y-3">
                <button v-if="reservationId" @click="generate" :disabled="generating"
                  class="w-full py-2.5 bg-teal text-white text-sm font-bold rounded-full hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">
                  {{ generating ? 'Generando…' : '+ Generar código para la reserva de hoy' }}
                </button>
                <p v-else class="text-xs text-text-muted text-center">Sin reserva activa hoy. Los códigos se generan desde la reserva o al pagarse la seña.</p>

                <div v-for="c in codes" :key="c.id" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5">
                  <code class="text-2xl font-black tracking-[0.25em] font-mono text-navy">{{ c.code }}</code>
                  <span class="text-xs text-text-muted shrink-0">{{ c.startDate || '?' }} → {{ c.endDate || '?' }}</span>
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-auto" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status }}</span>
                  <button v-if="c.status === 'active'" @click="revoke(c)" class="text-xs font-bold text-coral hover:text-navy transition-colors cursor-pointer shrink-0">Revocar</button>
                </div>
                <p v-if="!codes.length" class="text-sm text-text-muted text-center py-4">Sin códigos de reserva para esta cerradura.</p>
              </div>

              <!-- Tab Fijos (permanentes de staff) -->
              <div v-else-if="tab === 'fijos'">
                <div v-if="activeLoading" class="text-center text-sm text-text-muted py-6">Cargando…</div>
                <template v-else>
                  <div class="bg-surface rounded-xl p-3 mb-3 space-y-2">
                    <div class="text-[11px] font-bold text-text-muted uppercase">Nuevo código fijo</div>
                    <input v-model="fijoName" type="text" placeholder="Nombre (ej: Camarera, Mantenimiento)" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
                    <div class="flex gap-2">
                      <input v-model="fijoCode" type="text" inputmode="numeric" placeholder="Código (4-9 dígitos, opcional)" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm" />
                      <button @click="createFijo" :disabled="creatingFijo" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-lg hover:bg-navy-light disabled:opacity-50 cursor-pointer">{{ creatingFijo ? '…' : 'Crear' }}</button>
                    </div>
                  </div>
                  <div v-for="c in fijos" :key="c.keyboardPwdId" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5 mb-2">
                    <code class="text-sm font-mono font-bold text-navy">{{ c.keyboardPwd || '••••' }}</code>
                    <span class="text-xs text-text-secondary truncate">{{ c.keyboardPwdName || 'Fijo' }}</span>
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan/10 text-cyan shrink-0 ml-auto">permanente</span>
                    <button @click="deleteActive(c)" :disabled="deletingId === c.keyboardPwdId" class="text-xs font-bold text-coral hover:text-navy cursor-pointer shrink-0 disabled:opacity-50">{{ deletingId === c.keyboardPwdId ? '…' : 'Borrar' }}</button>
                  </div>
                  <p v-if="!fijos.length" class="text-sm text-text-muted text-center py-3">Sin códigos fijos. Creá uno para el staff.</p>
                </template>
              </div>

              <!-- Tab Activos (hardware) -->
              <div v-else-if="tab === 'active'">
                <div v-if="activeLoading" class="text-center text-sm text-text-muted py-6">Leyendo la cerradura…</div>
                <template v-else>
                  <p class="text-xs text-text-muted mb-3">PIN reales vivos en la cerradura (leídos del hardware).</p>
                  <div v-for="c in activeCodes" :key="c.keyboardPwdId" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5 mb-2">
                    <code class="text-sm font-mono font-bold text-navy">{{ c.keyboardPwd || '••••' }}</code>
                    <span class="text-xs text-text-secondary truncate">{{ c.keyboardPwdName || '—' }}</span>
                    <span class="text-xs text-text-muted shrink-0 ml-auto">{{ fmtMs(c.startDate) }} → {{ c.endDate ? fmtMs(c.endDate) : 'perm.' }}</span>
                    <button @click="deleteActive(c)" :disabled="deletingId === c.keyboardPwdId" class="text-xs font-bold text-coral hover:text-navy transition-colors cursor-pointer shrink-0 disabled:opacity-50">{{ deletingId === c.keyboardPwdId ? '…' : 'Borrar' }}</button>
                  </div>
                  <p v-if="!activeCodes.length" class="text-sm text-text-muted text-center py-4">La cerradura no tiene códigos activos ahora.</p>
                </template>
              </div>

              <!-- Tab Errores (fallos del hardware) -->
              <div v-else-if="tab === 'errors'">
                <div v-if="recordsLoading" class="text-center text-sm text-text-muted py-6">Revisando la cerradura…</div>
                <template v-else>
                  <p class="text-xs text-text-muted mb-3">Intentos fallidos y problemas de los últimos 30 días.</p>
                  <div v-for="r in errors" :key="r.recordId" class="flex items-center gap-2 border-b border-border py-2.5 last:border-0">
                    <span class="w-1.5 h-1.5 rounded-full bg-coral shrink-0"></span>
                    <span class="text-sm font-bold text-navy">{{ recordTypeLabel(r.recordType) }}</span>
                    <span v-if="r.keyboardPwd" class="text-sm font-mono text-text-secondary">{{ r.keyboardPwd }}</span>
                    <span class="text-[11px] font-bold text-coral shrink-0 ml-auto">Falló</span>
                    <span class="text-xs text-text-muted shrink-0">{{ fmtMs(r.lockDate) }}</span>
                  </div>
                  <div v-if="!errors.length" class="text-center py-6">
                    <div class="text-2xl mb-1">✅</div>
                    <p class="text-sm text-text-muted">Sin errores en los últimos 30 días.</p>
                  </div>
                </template>
              </div>
            </template>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import { TTLockService, type LockDevice, type LockCode, type LockActiveCode, type LockRecord, type LockGatewayLink } from '@/services/TTLock.service'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  roomId: string | null
  roomNumber: string
  reservationId: string | null
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'changed'): void }>()

const toast = useToast()
type LockTab = 'device' | 'codes' | 'fijos' | 'active' | 'errors'
const tabs: { key: LockTab; label: string }[] = [
  { key: 'device', label: 'Cerradura' },
  { key: 'codes', label: 'Códigos' },
  { key: 'fijos', label: 'Fijos' },
  { key: 'active', label: 'Activos' },
  { key: 'errors', label: 'Errores' },
]
const tab = ref<LockTab>('device')
const loading = ref(false)
const generating = ref(false)
const unlocking = ref(false)
const togglingAuto = ref(false)
const deletingId = ref<number | null>(null)
const lock = ref<LockDevice | null>(null)
const codes = ref<LockCode[]>([])

// Asignación de cerradura desde el propio modal (autosuficiente, sin ir a la página avanzada).
const allLocks = ref<LockDevice[]>([])
const assignLockId = ref('')
const assigning = ref(false)
const showReassign = ref(false)
// Cerraduras candidatas: las sincronizadas que no están asignadas a ninguna habitación.
const availableLocks = computed(() => allLocks.value.filter(l => !l.roomId))

const gateways = ref<LockGatewayLink[]>([])
const gatewayLoading = ref(false)

const activeCodes = ref<LockActiveCode[]>([])
const activeLoading = ref(false)
const activeLoaded = ref(false)
const records = ref<LockRecord[]>([])
const recordsLoading = ref(false)
const recordsLoaded = ref(false)

const fijoCode = ref('')
const fijoName = ref('')
const creatingFijo = ref(false)

// Auto-códigos: habilitado salvo que sea explícitamente false (filas viejas sin el campo = ON).
const autoOn = computed(() => lock.value?.autoCodesEnabled !== false)
const fijos = computed(() => activeCodes.value.filter(c => c.keyboardPwdType === 1))
const errors = computed(() => records.value.filter(r => r.success !== 1))
const errorCount = computed(() => errors.value.length)

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
function signalLabel(rssi?: number) {
  if (rssi == null) return '—'
  if (rssi >= -70) return 'Buena'
  if (rssi >= -85) return 'Media'
  return 'Débil'
}
function signalClass(rssi?: number) {
  if (rssi == null) return 'text-text-muted'
  if (rssi >= -70) return 'text-teal'
  if (rssi >= -85) return 'text-gold'
  return 'text-coral'
}

function selectTab(k: LockTab) {
  tab.value = k
  if ((k === 'active' || k === 'fijos') && !activeLoaded.value) loadActive()
  if (k === 'errors' && !recordsLoaded.value) loadRecords()
}

async function load() {
  if (!props.roomId) return
  loading.value = true
  activeLoaded.value = false; recordsLoaded.value = false
  activeCodes.value = []; records.value = []; gateways.value = []
  try {
    const [locksRes, codesRes] = await Promise.all([TTLockService.listLocks(), TTLockService.listCodes()])
    allLocks.value = locksRes.data || []
    lock.value = allLocks.value.find(l => l.roomId === props.roomId) || null
    codes.value = lock.value ? (codesRes.data || []).filter(c => c.lockId === lock.value!.id) : []
  } catch {
    toast.error('No se pudo cargar la cerradura')
  } finally {
    loading.value = false
  }
  if (lock.value?.id) loadGateways()
}

async function loadGateways() {
  if (!lock.value?.id) return
  gatewayLoading.value = true
  try {
    const r = await TTLockService.listLockGateways(lock.value.id)
    gateways.value = r.data || []
  } catch { /* el device sigue mostrándose sin gateway */ } finally {
    gatewayLoading.value = false
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

async function toggleAutoCodes() {
  if (!lock.value?.id || togglingAuto.value) return
  const next = !autoOn.value
  togglingAuto.value = true
  try {
    await TTLockService.updateLock(lock.value.id, { autoCodesEnabled: next })
    lock.value.autoCodesEnabled = next
    emit('changed')
    toast.success(next ? 'Auto-códigos activados' : 'Auto-códigos desactivados')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo cambiar el auto-código')
  } finally {
    togglingAuto.value = false
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

async function createFijo() {
  if (!lock.value?.id || creatingFijo.value) return
  const name = fijoName.value.trim()
  const code = fijoCode.value.trim()
  if (!name) { toast.error('Poné un nombre para el código fijo'); return }
  if (code && !/^\d{4,9}$/.test(code)) { toast.error('El código debe tener entre 4 y 9 dígitos'); return }
  creatingFijo.value = true
  try {
    const r = await TTLockService.createPermanentCode(lock.value.id, { code: code || undefined, name })
    await loadActive()
    emit('changed')
    fijoCode.value = ''; fijoName.value = ''
    toast.success(`Código fijo creado: ${r.code}`)
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo crear el código fijo')
  } finally {
    creatingFijo.value = false
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

async function assignLock() {
  if (!assignLockId.value || !props.roomId || assigning.value) return
  assigning.value = true
  try {
    await TTLockService.updateLock(assignLockId.value, { roomId: props.roomId })
    assignLockId.value = ''
    showReassign.value = false
    await load()
    emit('changed')
    toast.success('Cerradura asignada a la habitación')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo asignar la cerradura')
  } finally {
    assigning.value = false
  }
}

async function unassignLock() {
  if (!lock.value?.id || assigning.value) return
  assigning.value = true
  try {
    await TTLockService.updateLock(lock.value.id, { roomId: '' })
    showReassign.value = false
    await load()
    emit('changed')
    toast.success('Cerradura desasignada')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo desasignar la cerradura')
  } finally {
    assigning.value = false
  }
}

watch(() => props.roomId, (id) => {
  if (id) { tab.value = 'device'; fijoCode.value = ''; fijoName.value = ''; assignLockId.value = ''; showReassign.value = false; load() }
})
</script>
