<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="roomId" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="$emit('close')"></div>
        <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[85vh]">
          <!-- Header -->
          <div class="shrink-0 p-5 pb-3 flex items-start justify-between">
            <div>
              <h3 class="text-lg font-black text-navy">Cerradura · Hab {{ roomNumber }}</h3>
              <p class="text-xs text-text-muted mt-0.5">{{ lock ? (lock.name || 'Cerradura TTLock') : 'Acceso de la habitación' }}</p>
            </div>
            <button @click="$emit('close')" class="text-text-muted hover:text-navy transition-colors cursor-pointer text-lg leading-none">✕</button>
          </div>

          <!-- Tabs -->
          <div class="shrink-0 px-5 flex gap-1 border-b border-border">
            <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
              class="px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors cursor-pointer"
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
                <div class="flex justify-between text-xs"><span class="text-text-muted">MAC</span><span class="font-mono text-text-secondary">{{ lock.mac || '—' }}</span></div>
                <div class="flex justify-between text-xs"><span class="text-text-muted">Batería</span>
                  <span class="font-bold" :class="(lock.batteryLevel || 0) > 50 ? 'text-teal' : (lock.batteryLevel || 0) > 20 ? 'text-gold' : 'text-coral'">{{ lock.batteryLevel || 0 }}%</span>
                </div>
                <div class="flex justify-between text-xs items-center"><span class="text-text-muted">Estado</span>
                  <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="lock.status === 'online' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ lock.status || 'offline' }}</span>
                </div>
              </div>

              <!-- Tab Códigos -->
              <div v-else-if="tab === 'codes'" class="space-y-3">
                <button v-if="reservationId" @click="generate" :disabled="generating"
                  class="w-full py-2.5 bg-teal text-white text-xs font-bold rounded-full hover:bg-teal-light transition-all cursor-pointer disabled:opacity-50">
                  {{ generating ? 'Generando…' : '+ Generar código para la reserva actual' }}
                </button>
                <p v-else class="text-[11px] text-text-muted text-center">Sin reserva activa hoy en esta habitación. Los códigos se generan desde la reserva o al pagarse la seña.</p>

                <div v-for="c in codes" :key="c.id" class="flex items-center gap-2 bg-surface rounded-xl px-3 py-2">
                  <code class="text-sm font-mono font-bold text-navy">{{ c.code }}</code>
                  <span class="text-[10px] text-text-muted shrink-0">{{ c.startDate || '?' }} → {{ c.endDate || '?' }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-auto" :class="c.status === 'active' ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-500'">{{ c.status }}</span>
                  <button v-if="c.status === 'active'" @click="revoke(c)" class="text-[10px] font-bold text-coral hover:text-navy transition-colors cursor-pointer shrink-0">Revocar</button>
                </div>
                <p v-if="!codes.length" class="text-xs text-text-muted text-center py-4">Todavía no hay códigos para esta cerradura.</p>
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
import { TTLockService, type LockDevice, type LockCode } from '@/services/TTLock.service'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  roomId: string | null
  roomNumber: string
  reservationId: string | null
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'changed'): void }>()

const toast = useToast()
type LockTab = 'device' | 'codes'
const tabs: { key: LockTab; label: string }[] = [
  { key: 'device', label: 'Cerradura' },
  { key: 'codes', label: 'Códigos' },
]
const tab = ref<LockTab>('device')
const loading = ref(false)
const generating = ref(false)
const lock = ref<LockDevice | null>(null)
const codes = ref<LockCode[]>([])

async function load() {
  if (!props.roomId) return
  loading.value = true
  try {
    const [locksRes, codesRes] = await Promise.all([TTLockService.listLocks(), TTLockService.listCodes()])
    lock.value = (locksRes.data || []).find(l => l.roomId === props.roomId) || null
    codes.value = lock.value
      ? (codesRes.data || []).filter(c => c.lockId === lock.value!.id)
      : []
  } catch {
    toast.error('No se pudo cargar la cerradura')
  } finally {
    loading.value = false
  }
}

async function generate() {
  if (!props.reservationId || generating.value) return
  generating.value = true
  try {
    await TTLockService.generateCode(props.reservationId)
    await load()
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
    emit('changed')
    toast.success('Código revocado y borrado de la cerradura')
  } catch (e) {
    toast.error((e as Error).message || 'No se pudo revocar el código')
  }
}

// Al abrir el modal (roomId pasa de null a un id) recargamos y volvemos al primer tab.
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
