<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-black text-navy">Cerraduras TTLock</h2>
        <p class="text-xs text-text-muted mt-0.5">Gestión de cerraduras electrónicas y códigos de acceso</p>
      </div>
      <div class="flex gap-2">
        <button @click="syncLocks" :disabled="syncing" class="px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 cursor-pointer disabled:opacity-50">{{ syncing ? 'Sincronizando...' : '🔄 Sincronizar' }}</button>
      </div>
    </div>

    <!-- TTLock Config -->
    <div class="card p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-extrabold text-navy">Configuración TTLock</h3>
        <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="ttlockConfig.configured ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ ttlockConfig.configured ? 'Configurado' : 'Pendiente' }}</span>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Client ID</label><input v-model="ttlockConfig.clientId" type="text" placeholder="De open.ttlock.com" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Client Secret</label><input v-model="ttlockConfig.clientSecret" type="password" placeholder="••••••••" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Account ID / Email</label><input v-model="ttlockConfig.accountId" type="text" placeholder="email@ejemplo.com" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        <div class="flex items-end gap-2">
          <button @click="saveTtlockConfig" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-navy/80">💾 Guardar Config</button>
          <button @click="connectTtlock" class="px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-teal/80">🔗 Conectar</button>
        </div>
      </div>
      <p class="text-[10px] text-text-muted mt-3">Registrate en <a href="https://open.ttlock.com" target="_blank" class="text-cyan underline">open.ttlock.com</a> → Crea una App OAuth → Copia Client ID y Secret aquí</p>
    </div>

    <!-- Locks Table -->
    <div class="card overflow-hidden mb-6">
      <div class="p-4 border-b border-border"><h3 class="font-extrabold text-navy">Dispositivos</h3></div>
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
              <select @change="mapLock(lock, ($event.target as HTMLSelectElement).value)" class="px-3 py-1.5 rounded-lg border border-border text-xs cursor-pointer">
                <option value="">Sin asignar</option>
                <option v-for="r in rooms" :key="r.id" :value="r.id" :selected="lock.roomId===r.id">{{ r.number }} - {{ r.type }}</option>
              </select>
            </td>
            <td class="p-4 text-xs font-mono text-text-secondary">{{ lock.mac || '—' }}</td>
            <td class="p-4 text-center">
              <span class="text-xs font-bold" :class="lock.batteryLevel > 50 ? 'text-teal' : lock.batteryLevel > 20 ? 'text-gold' : 'text-coral'">{{ lock.batteryLevel || 0 }}%</span>
            </td>
            <td class="p-4 text-center">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lock.status==='online'?'bg-teal/10 text-teal':'bg-gray-100 text-gray-500'">{{ lock.status || 'offline' }}</span>
            </td>
            <td class="p-4 text-right">
              <button v-if="lock.roomId" @click="viewCodes(lock)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20">Códigos</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Codes Table -->
    <div class="card overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between">
        <h3 class="font-extrabold text-navy">Códigos de Acceso</h3>
        <span class="text-xs text-text-muted">{{ lockCodes.length }} códigos</span>
      </div>
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
              <button v-if="code.status==='active'" @click="revokeCode(code)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">Revocar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { TTLockService } from '@/services/TTLock.service'

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const syncing = ref(false)
const locks = ref<any[]>([])
const rooms = ref<any[]>([])
const lockCodes = ref<any[]>([])
const ttlockConfig = ref({ clientId: '', clientSecret: '', accountId: '', accessToken: '', configured: false })

async function load() {
  try { const cfg = await TTLockService.getConfig(); ttlockConfig.value = { ...ttlockConfig.value, ...cfg } } catch {}
  try { const r = await TTLockService.listLocks(); locks.value = r.data||[] } catch {}
  try { const { RoomService } = await import('@/services/Room.service'); const res = await RoomService.list({ hotelId: hid.value }).catch(()=>({rooms:[],total:0})); rooms.value = res.rooms||[] } catch {}
  // Lock codes: filtramos localmente desde locks (no hay endpoint dedicado todavía)
  lockCodes.value = []
}

async function saveTtlockConfig() {
  try { await TTLockService.saveConfig(ttlockConfig.value); toast.success('Config guardada') } catch { toast.error('Error') }
}
async function connectTtlock() {
  await saveTtlockConfig()
  toast.info('OAuth flow simulado — conecta con TTLock real para completar')
}
async function syncLocks() {
  syncing.value = true
  try { await TTLockService.sync(); toast.success('Sincronización solicitada'); await load() } catch { toast.error('Error') }
  syncing.value = false
}
async function mapLock(lock: any, roomId: string) {
  try { await TTLockService.updateLock(lock.id, { roomId: roomId || undefined }); lock.roomId = roomId || null; toast.success('Mapeado') } catch { toast.error('Error') }
}
async function revokeCode(code: any) {
  try { await TTLockService.revokeCode(code.id); code.status = 'revoked'; toast.success('Código revocado') } catch { toast.error('Error') }
}

function getLockName(lockId: string) {
  const lock = locks.value.find(l => l.id === lockId)
  return lock?.name || lock?.ttlockLockId || lockId.slice(0, 8)
}

/** Muestra los códigos asociados a una cerradura */
function viewCodes(lock: any) {
  const codes = lockCodes.value.filter((c: any) => c.lockId === lock.id)
  if (codes.length === 0) {
    toast.info(`Sin códigos para ${lock.name || lock.id}`)
    return
  }
  const msg = codes.map((c: any) => `• ${c.code} (${c.status || 'active'}) ${c.startDate || ''} → ${c.endDate || ''}`).join('\n')
  alert(`Códigos de ${lock.name || lock.id}:\n\n${msg}`)
}

onMounted(load)
</script>
