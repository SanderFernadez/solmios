<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Cerraduras TTLock</h2>
        <p class="text-sm text-text-muted mt-0.5">Gestión de cerraduras electrónicas y códigos de acceso</p>
      </div>
      <div class="flex gap-2">
        <span class="text-[10px] font-bold px-2.5 py-1.5 rounded-full self-center" :class="ttlockConfig.connected ? 'bg-teal/10 text-teal' : ttlockConfig.configured ? 'bg-gold/10 text-gold' : 'bg-coral/10 text-coral'">{{ ttlockConfig.connected ? '● Conectado' : ttlockConfig.configured ? 'Falta conectar' : 'Pendiente' }}</span>
        <button @click="syncLocks" :disabled="syncing" class="px-4 py-2 border border-border rounded-full text-sm font-bold text-text-secondary hover:border-navy/30 transition-all cursor-pointer disabled:opacity-50">{{ syncing ? 'Sincronizando...' : 'Sincronizar' }}</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-border overflow-x-auto">
      <button v-for="t in tabs" :key="t.key" @click="selectTab(t.key)"
        class="px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
        :class="tab === t.key ? 'border-navy text-navy' : 'border-transparent text-text-muted hover:text-navy'">
        {{ t.label }}
        <span v-if="t.badge != null" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" :class="tab === t.key ? 'bg-navy/10 text-navy' : 'bg-surface text-text-muted'">{{ t.badge }}</span>
      </button>
    </div>

    <!-- ── TAB: Configuración ── -->
    <div v-show="tab === 'config'" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <h3 class="font-extrabold text-navy mb-4">Configuración TTLock</h3>
      <div class="grid md:grid-cols-2 gap-4">
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Client ID</label><input v-model="ttlockConfig.clientId" type="text" placeholder="De open.ttlock.com" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" /></div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Client Secret</label>
          <input v-model="ttlockConfig.clientSecret" type="password" :placeholder="ttlockConfig.hasSecret ? '•••••••• (guardado)' : 'Pegá el Client Secret'" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
          <p v-if="ttlockConfig.hasSecret" class="text-[10px] text-text-muted mt-1 ml-4">Guardado. Dejalo vacío para conservarlo.</p>
        </div>
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Usuario TTLock</label><input v-model="ttlockConfig.username" type="text" placeholder="Usuario de la cuenta TTLock del hotel" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" /></div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Contraseña TTLock</label>
          <input v-model="ttlockConfig.password" type="password" :placeholder="ttlockConfig.hasPassword ? '•••••••• (guardada)' : 'Contraseña de la cuenta TTLock'" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
          <p v-if="ttlockConfig.hasPassword" class="text-[10px] text-text-muted mt-1 ml-4">Guardada. Dejala vacía para conservarla.</p>
        </div>
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Región</label><select v-model="ttlockConfig.region" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer"><option value="eu">Europa (eu)</option><option value="us">EE.UU. (us)</option><option value="cn">China (cn)</option></select></div>
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Account ID / Email</label><input v-model="ttlockConfig.accountId" type="text" placeholder="email@ejemplo.com" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" /></div>
        <div>
          <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Entrega del código</label>
          <select v-model.number="ttlockConfig.addType" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
            <option :value="2">Gateway (remoto)</option>
            <option :value="1">Bluetooth (app en la puerta)</option>
            <option :value="3">NB-IoT</option>
          </select>
          <p class="text-[10px] text-text-muted mt-1 ml-4">Sin gateway, el PIN solo llega con un teléfono al lado de la cerradura.</p>
        </div>
        <div class="flex items-end gap-2">
          <button @click="saveTtlockConfig" :disabled="saving || connecting" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ saving ? 'Guardando...' : 'Guardar Config' }}</button>
          <button @click="connectTtlock" :disabled="saving || connecting" class="px-5 py-2.5 bg-teal text-white rounded-full text-sm font-bold hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">{{ connecting ? 'Conectando...' : 'Conectar' }}</button>
        </div>
      </div>
      <p class="text-[10px] text-text-muted mt-3">Registrate en <a href="https://open.ttlock.com" target="_blank" class="text-cyan underline">open.ttlock.com</a> → Crea una App OAuth → Copia Client ID y Secret aquí</p>
    </div>

    <!-- ── TAB: Cerraduras ── -->
    <div v-show="tab === 'locks'" class="space-y-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <div class="p-4 border-b border-border"><h3 class="font-extrabold text-navy">Dispositivos</h3></div>
        <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Nombre</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Habitación</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">MAC</th>
            <th class="text-center p-4 text-[10px] font-bold text-text-muted uppercase">Batería</th>
            <th class="text-center p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acción</th>
          </tr></thead>
          <tbody>
            <tr v-for="lock in locks" :key="lock.id" class="border-b border-border last:border-0 hover:bg-surface/50">
              <td class="p-4 text-sm font-bold text-navy">{{ lock.name || 'Sin nombre' }}</td>
              <td class="p-4">
                <select @change="mapLock(lock, ($event.target as HTMLSelectElement).value)" class="px-3 py-1.5 rounded-full border border-border text-xs cursor-pointer">
                  <option value="">Sin asignar</option>
                  <option v-for="r in rooms" :key="r.id" :value="r.id" :selected="lock.roomId===r.id">{{ r.number }} - {{ r.type }}</option>
                </select>
              </td>
              <td class="p-4 text-xs font-mono text-text-secondary">{{ lock.mac || '—' }}</td>
              <td class="p-4 text-center">
                <span class="text-xs font-bold" :class="(lock.batteryLevel||0) > 50 ? 'text-teal' : (lock.batteryLevel||0) > 20 ? 'text-gold' : 'text-coral'">{{ lock.batteryLevel || 0 }}%</span>
              </td>
              <td class="p-4 text-center">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lock.status==='online'?'bg-teal/10 text-teal':'bg-gray-100 text-gray-500'">{{ lock.status || 'offline' }}</span>
              </td>
              <td class="p-4 text-right whitespace-nowrap">
                <button v-if="lock.roomId" @click="viewCodes(lock)" class="text-[11px] font-bold text-navy/70 hover:text-navy transition-colors cursor-pointer mr-3">Códigos BD</button>
                <button @click="inspectLock(lock)" class="text-[11px] font-bold text-cyan hover:text-navy transition-colors cursor-pointer">Verificar hardware</button>
              </td>
            </tr>
            <tr v-if="!locks.length">
              <td colspan="6" class="p-8 text-center text-sm text-text-muted">No hay cerraduras. Conectá TTLock en Configuración y tocá Sincronizar.</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <div class="p-4 border-b border-border flex items-center justify-between">
          <h3 class="font-extrabold text-navy">Códigos de Acceso (base de datos)</h3>
          <span class="text-xs text-text-muted">{{ lockCodes.length }} códigos</span>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full">
          <thead><tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Cerradura</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Código</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Reserva</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Válido</th>
            <th class="text-center p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acción</th>
          </tr></thead>
          <tbody>
            <tr v-for="code in lockCodes" :key="code.id" class="border-b border-border last:border-0 hover:bg-surface/50">
              <td class="p-4 text-xs text-text-secondary">{{ getLockName(code.lockId) }}</td>
              <td class="p-4 text-sm font-black text-navy font-mono">{{ code.code }}</td>
              <td class="p-4 text-xs text-text-secondary">{{ code.reservationId ? code.reservationId.slice(0,8)+'...' : '—' }}</td>
              <td class="p-4 text-xs">{{ code.startDate }} → {{ code.endDate }}</td>
              <td class="p-4 text-center">
                <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="code.status==='active'?'bg-teal/10 text-teal':'bg-gray-100 text-gray-500'">{{ code.status }}</span>
              </td>
              <td class="p-4 text-right">
                <button v-if="code.status==='active'" @click="revokeCode(code)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Revocar</button>
              </td>
            </tr>
            <tr v-if="!lockCodes.length">
              <td colspan="6" class="p-8 text-center text-sm text-text-muted">Todavía no se generó ningún código. Se crean automáticamente al pagarse la seña de una reserva (habitación con cerradura asignada), o a mano desde la reserva.</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- ── TAB: Gateways ── -->
    <div v-show="tab === 'gateways'" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-navy">Gateways</h3>
        <button @click="loadGateways" :disabled="gatewaysLoading" class="text-xs font-bold text-cyan hover:underline cursor-pointer disabled:opacity-50">{{ gatewaysLoading ? 'Cargando...' : 'Actualizar' }}</button>
      </div>
      <div v-if="gatewaysLoading" class="text-center text-sm text-text-muted py-8">Cargando gateways...</div>
      <div v-else-if="!gateways.length" class="text-center text-sm text-text-muted py-8">No se detectaron gateways en la cuenta TTLock.</div>
      <div v-else class="grid sm:grid-cols-2 gap-3">
        <div v-for="g in gateways" :key="g.gatewayId" class="rounded-2xl border border-border p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-navy text-sm">{{ g.gatewayName || ('Gateway ' + g.gatewayId) }}</span>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="g.isOnline ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ g.isOnline ? 'Online' : 'Offline' }}</span>
          </div>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between"><span class="text-text-muted">Red WiFi</span><span class="text-text-secondary">{{ g.networkName || '—' }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">MAC</span><span class="font-mono text-text-secondary">{{ g.gatewayMac || '—' }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">Cerraduras</span><span class="font-bold text-navy">{{ g.lockNum ?? 0 }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── TAB: Códigos activos (hardware) ── -->
    <div v-show="tab === 'active'" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <h3 class="font-extrabold text-navy mb-1">Comprobar códigos activos</h3>
      <p class="text-xs text-text-muted mb-4">Lee los PIN que realmente tiene la cerradura en el hardware (distinto de la tabla de la base de datos).</p>
      <div class="flex flex-wrap gap-2 items-center mb-5">
        <select v-model="activeLockId" class="px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
          <option value="">Elegí una cerradura</option>
          <option v-for="l in locks" :key="l.id" :value="l.id">{{ l.name || l.id }}{{ l.roomNumber && l.roomNumber !== '—' ? ` · Hab ${l.roomNumber}` : '' }}</option>
        </select>
        <button @click="checkActiveCodes" :disabled="!activeLockId || activeLoading" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ activeLoading ? 'Comprobando...' : 'Comprobar' }}</button>
      </div>
      <div v-if="activeChecked && !activeLoading">
        <div v-if="!activeCodes.length" class="text-center text-sm text-text-muted py-8">La cerradura no tiene códigos activos en este momento.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead><tr class="border-b border-border bg-surface/50">
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Código</th>
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Nombre</th>
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Válido</th>
              <th class="text-center p-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            </tr></thead>
            <tbody>
              <tr v-for="c in activeCodes" :key="c.keyboardPwdId" class="border-b border-border last:border-0">
                <td class="p-3 text-sm font-black text-navy font-mono">{{ c.keyboardPwd || '••••' }}</td>
                <td class="p-3 text-xs text-text-secondary">{{ c.keyboardPwdName || '—' }}</td>
                <td class="p-3 text-xs text-text-secondary">{{ pwdTypeLabel(c.keyboardPwdType) }}</td>
                <td class="p-3 text-xs text-text-secondary">{{ fmtMs(c.startDate) }} → {{ fmtMs(c.endDate) }}</td>
                <td class="p-3 text-center">
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="c.status === 1 ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status === 1 ? 'Válido' : 'Inactivo' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── TAB: Registros (actividad del hardware) ── -->
    <div v-show="tab === 'records'" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <h3 class="font-extrabold text-navy mb-1">Registros de la cerradura</h3>
      <p class="text-xs text-text-muted mb-4">Historial de aperturas e intentos de los últimos 30 días, leído del hardware.</p>
      <div class="flex flex-wrap gap-2 items-center mb-5">
        <select v-model="recordsLockId" class="px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
          <option value="">Elegí una cerradura</option>
          <option v-for="l in locks" :key="l.id" :value="l.id">{{ l.name || l.id }}{{ l.roomNumber && l.roomNumber !== '—' ? ` · Hab ${l.roomNumber}` : '' }}</option>
        </select>
        <button @click="checkRecords" :disabled="!recordsLockId || recordsLoading" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ recordsLoading ? 'Cargando...' : 'Ver historial' }}</button>
      </div>
      <div v-if="recordsChecked && !recordsLoading">
        <div v-if="!records.length" class="text-center text-sm text-text-muted py-8">Sin registros en los últimos 30 días.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead><tr class="border-b border-border bg-surface/50">
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Evento</th>
              <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Código / Usuario</th>
              <th class="text-center p-3 text-[10px] font-bold text-text-muted uppercase">Resultado</th>
            </tr></thead>
            <tbody>
              <tr v-for="r in records" :key="r.recordId" class="border-b border-border last:border-0">
                <td class="p-3 text-xs text-text-secondary">{{ fmtMs(r.lockDate) }}</td>
                <td class="p-3 text-xs text-navy font-bold">{{ recordTypeLabel(r.recordType) }}</td>
                <td class="p-3 text-xs text-text-secondary"><span v-if="r.keyboardPwd" class="font-mono">{{ r.keyboardPwd }}</span><span v-else>{{ r.keyName || r.username || '—' }}</span></td>
                <td class="p-3 text-center">
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="r.success === 1 ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ r.success === 1 ? 'OK' : 'Falló' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal códigos BD por cerradura -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="codesModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="codesModal = null"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[80vh]">
            <div class="shrink-0 p-6 pb-4">
              <h3 class="text-lg font-black text-navy">Códigos de {{ codesModal.lockName }}</h3>
            </div>
            <div class="overflow-y-auto flex-1 px-6 space-y-2">
              <div v-for="(c, i) in codesModal.codes" :key="i" class="flex items-center gap-2 bg-surface rounded-full px-3 py-2">
                <code class="flex-1 text-sm font-mono font-bold text-navy">{{ c.code }}</code>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ c.status }}</span>
                <span class="text-[10px] text-text-muted shrink-0">{{ c.startDate || '?' }} → {{ c.endDate || '?' }}</span>
              </div>
            </div>
            <div class="shrink-0 p-6 pt-5">
              <button @click="codesModal = null" class="w-full py-2.5 bg-surface text-navy text-sm font-bold rounded-full hover:bg-navy/5 transition-all cursor-pointer">Cerrar</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { TTLockService, type TTLockConfig, type LockGateway, type LockActiveCode, type LockRecord } from '@/services/TTLock.service'

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

type Tab = 'config' | 'locks' | 'gateways' | 'active' | 'records'
const tab = ref<Tab>('locks')

const syncing = ref(false)
const saving = ref(false)
const locks = ref<any[]>([])
const rooms = ref<any[]>([])
const lockCodes = ref<any[]>([])
const ttlockConfig = ref({ clientId: '', clientSecret: '', username: '', password: '', region: 'eu', accountId: '', addType: 2, configured: false, connected: false, hasSecret: false, hasPassword: false })
const connecting = ref(false)

const codesModal = ref<{ lockName: string; codes: { code: string; status: string; startDate: string; endDate: string }[] } | null>(null)

// Gateways
const gateways = ref<LockGateway[]>([])
const gatewaysLoading = ref(false)
const gatewaysLoaded = ref(false)

// Códigos activos (hardware)
const activeLockId = ref('')
const activeCodes = ref<LockActiveCode[]>([])
const activeLoading = ref(false)
const activeChecked = ref(false)

// Registros de actividad (hardware)
const recordsLockId = ref('')
const records = ref<LockRecord[]>([])
const recordsLoading = ref(false)
const recordsChecked = ref(false)

const tabs = computed(() => [
  { key: 'config' as Tab, label: 'Configuración', badge: null as number | null },
  { key: 'locks' as Tab, label: 'Cerraduras', badge: locks.value.length },
  { key: 'gateways' as Tab, label: 'Gateways', badge: gatewaysLoaded.value ? gateways.value.length : null },
  { key: 'active' as Tab, label: 'Códigos activos', badge: null as number | null },
  { key: 'records' as Tab, label: 'Registros', badge: null as number | null },
])

function selectTab(k: Tab) {
  tab.value = k
  if (k === 'gateways' && !gatewaysLoaded.value) loadGateways()
}

async function load() {
  try { const cfg = await TTLockService.getConfig(); ttlockConfig.value = { ...ttlockConfig.value, ...cfg, clientSecret: '', password: '' } } catch {}
  try { const r = await TTLockService.listLocks(); locks.value = r.data||[] } catch {}
  try { const r = await TTLockService.listCodes(); lockCodes.value = r.data||[] } catch {}
  try { const { RoomService } = await import('@/services/Room.service'); const res = await RoomService.list({ hotelId: hid.value }).catch(()=>({rooms:[],total:0})); rooms.value = res.rooms||[] } catch {}
}

/** El secret/password vacíos significan "no lo toques": el backend conserva el guardado. */
function configPayload(): Partial<TTLockConfig> {
  const c = ttlockConfig.value
  const payload: Partial<TTLockConfig> = {
    clientId: c.clientId, username: c.username, region: c.region,
    accountId: c.accountId, addType: c.addType,
  }
  if (c.clientSecret) payload.clientSecret = c.clientSecret
  if (c.password) payload.password = c.password
  return payload
}

async function saveTtlockConfig(): Promise<boolean> {
  saving.value = true
  try {
    await TTLockService.saveConfig(configPayload())
    await load()
    toast.success('Configuración guardada')
    return true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo guardar la configuración')
    return false
  } finally {
    saving.value = false
  }
}

async function connectTtlock() {
  if (!(await saveTtlockConfig())) return
  connecting.value = true
  try {
    await TTLockService.connect(configPayload())
    toast.success('TTLock conectado — sincronizando cerraduras…')
    await syncLocks()
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo conectar con TTLock')
  } finally {
    connecting.value = false
    await load()
  }
}

async function syncLocks() {
  syncing.value = true
  try {
    const r = await TTLockService.sync()
    toast.success(r.message || 'Cerraduras sincronizadas')
    await load()
  } catch (e) {
    toast.error((e as Error).message || 'No se pudieron sincronizar las cerraduras')
  } finally {
    syncing.value = false
  }
}

async function mapLock(lock: any, roomId: string) {
  try {
    await TTLockService.updateLock(lock.id, { roomId })
    lock.roomId = roomId
    toast.success(roomId ? 'Cerradura asignada' : 'Cerradura desasignada')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo asignar la cerradura')
  }
}

async function revokeCode(code: any) {
  try {
    await TTLockService.revokeCode(code.id)
    code.status = 'revoked'
    toast.success('Código revocado y borrado de la cerradura')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo borrar el código de la cerradura')
  }
}

function getLockName(lockId: string) {
  const lock = locks.value.find(l => l.id === lockId)
  return lock?.name || lock?.ttlockLockId || lockId.slice(0, 8)
}

/** Muestra los códigos (de la BD) asociados a una cerradura */
function viewCodes(lock: any) {
  const codes = lockCodes.value.filter((c: any) => c.lockId === lock.id)
  if (codes.length === 0) {
    toast.info(`Sin códigos para ${lock.name || lock.id}`)
    return
  }
  codesModal.value = {
    lockName: lock.name || lock.id,
    codes: codes.map((c: any) => ({ code: String(c.code), status: c.status || 'active', startDate: c.startDate || '', endDate: c.endDate || '' })),
  }
}

async function loadGateways() {
  gatewaysLoading.value = true
  try {
    const r = await TTLockService.listGateways()
    gateways.value = r.data || []
    gatewaysLoaded.value = true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudieron cargar los gateways')
  } finally {
    gatewaysLoading.value = false
  }
}

const PWD_TYPE: Record<number, string> = { 1: 'Permanente', 2: 'Temporal', 3: 'Período', 4: 'Borrado' }
function pwdTypeLabel(t?: number) { return t != null ? (PWD_TYPE[t] || `Tipo ${t}`) : '—' }
function fmtMs(ms?: number) {
  if (!ms) return '—'
  const d = new Date(ms)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function checkActiveCodes() {
  if (!activeLockId.value) return
  activeLoading.value = true
  activeChecked.value = false
  try {
    const r = await TTLockService.listActiveCodes(activeLockId.value)
    activeCodes.value = r.data || []
    activeChecked.value = true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudieron leer los códigos de la cerradura')
  } finally {
    activeLoading.value = false
  }
}

/** Atajo desde la tabla de dispositivos: ir al tab de códigos activos con la cerradura elegida. */
function inspectLock(lock: any) {
  activeLockId.value = lock.id
  tab.value = 'active'
  checkActiveCodes()
}

const RECORD_TYPE: Record<number, string> = {
  1: 'Apertura app', 4: 'Apertura código', 7: 'Tarjeta', 8: 'Huella',
  11: 'Bloqueo', 12: 'Operación gateway', 46: 'Apertura remota', 47: 'Apertura remota',
}
function recordTypeLabel(t?: number) { return t != null ? (RECORD_TYPE[t] || `Evento ${t}`) : '—' }

async function checkRecords() {
  if (!recordsLockId.value) return
  recordsLoading.value = true
  recordsChecked.value = false
  try {
    const r = await TTLockService.listLockRecords(recordsLockId.value)
    records.value = (r.data || []).sort((a, b) => (b.lockDate || 0) - (a.lockDate || 0))
    recordsChecked.value = true
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo leer el historial de la cerradura')
  } finally {
    recordsLoading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
