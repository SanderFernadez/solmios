<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Historial de Envíos</h2>
        <p class="text-xs text-text-muted mt-0.5">Trazabilidad de emails, WhatsApp y SMS enviados a huéspedes</p>
      </div>
      <div class="flex gap-2">
        <button @click="load" :disabled="loading" class="px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-full text-sm font-bold transition-all cursor-pointer disabled:opacity-50">
          {{ loading ? 'Cargando...' : '↻ Refrescar' }}
        </button>
        <button @click="exportCsv" :disabled="logs.length === 0" class="px-4 py-2 bg-cyan text-navy font-bold text-sm rounded-full hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
          Exportar CSV
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-navy">{{ stats.total }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Total</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-teal">{{ stats.sent }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Enviados</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-gold">{{ stats.pending }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Pendientes</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-coral">{{ stats.failed }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Fallidos</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar destinatario..." class="px-4 py-2 rounded-full border border-border text-sm w-56 focus:outline-none focus:border-navy" />
      <select v-model="filterType" class="px-3 py-2 rounded-full border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los canales</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
      </select>
      <select v-model="filterStatus" class="px-3 py-2 rounded-full border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los estados</option>
        <option value="sent">Enviados</option>
        <option value="pending">Pendientes</option>
        <option value="failed">Fallidos</option>
        <option value="queued">En cola</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} resultados</span>
    </div>

    <!-- Lista -->
    <div v-if="loading && logs.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center text-sm text-text-muted">Cargando...</div>
    <div v-else-if="filtered.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 block text-navy/30" v-html="ICON_INBOX"></span>
      <h3 class="font-bold text-navy mb-1">Sin envíos registrados</h3>
      <p class="text-xs text-text-muted">Cuando se disparen auto-messages o envíos manuales, aparecerán aquí.</p>
    </div>
    <div v-else class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Destinatario</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Reserva</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Respuesta</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in filtered" :key="log.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30 cursor-pointer"
            @click="showDetail(log)">
            <td class="p-3">
              <div class="text-xs text-navy">{{ formatDate(log.sentAt || log.createdAt) }}</div>
              <div class="text-[10px] text-text-muted">{{ formatTime(log.sentAt || log.createdAt) }}</div>
            </td>
            <td class="p-3">
              <div class="flex items-center gap-1.5">
                <span class="w-3.5 h-3.5 text-text-muted" v-html="msgTypeMeta(log.messageType).icon"></span>
                <span class="text-[10px] text-text-muted">{{ msgTypeMeta(log.messageType).label }}</span>
              </div>
            </td>
            <td class="p-3">
              <div class="text-xs font-bold text-navy">{{ log.guestName || '—' }}</div>
              <div class="text-[10px] text-text-muted">{{ log.recipient || '—' }}</div>
            </td>
            <td class="p-3">
              <span v-if="log.reservationId" class="text-[10px] font-mono text-text-muted">{{ log.reservationId.slice(0, 8) }}</span>
              <span v-else class="text-[10px] text-text-muted">—</span>
            </td>
            <td class="p-3">
              <span class="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full" :class="msgStatusMeta(log.status).class">
                <span class="w-3 h-3" v-html="msgStatusMeta(log.status).icon"></span>
                {{ msgStatusMeta(log.status).label }}
              </span>
            </td>
            <td class="p-3 max-w-xs">
              <div class="text-[10px] text-text-muted truncate">{{ log.response || '—' }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal detalle -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="detailModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="detailModal.show=false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[85vh]">
            <div class="shrink-0 p-6 pb-4 flex items-start justify-between">
              <div>
                <h3 class="text-lg font-black text-navy">Detalle de envío</h3>
                <p class="text-xs text-text-muted flex items-center gap-1.5 mt-1">
                  <span class="w-3.5 h-3.5" v-html="msgTypeMeta(detailModal.log?.messageType || '').icon"></span>
                  {{ msgTypeMeta(detailModal.log?.messageType || '').label }} ·
                  <span :class="msgStatusMeta(detailModal.log?.status || '').class">{{ msgStatusMeta(detailModal.log?.status || '').label }}</span>
                </p>
              </div>
              <button @click="detailModal.show=false" class="w-4 h-4 text-text-muted hover:text-navy transition-colors cursor-pointer" v-html="ICON_X"></button>
            </div>
            <div v-if="detailModal.log" class="overflow-y-auto flex-1 px-6 pb-6 space-y-3 text-xs">
              <div class="grid grid-cols-2 gap-x-4 gap-y-3 py-4 border-t border-b border-border">
                <div>
                  <div class="text-[10px] font-bold text-text-muted uppercase">Destinatario</div>
                  <div class="text-navy font-bold">{{ detailModal.log.guestName || '—' }}</div>
                  <div class="text-text-muted">{{ detailModal.log.recipient || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] font-bold text-text-muted uppercase">Fecha</div>
                  <div class="text-navy font-bold">{{ formatDate(detailModal.log.sentAt || detailModal.log.createdAt) }}</div>
                  <div class="text-text-muted">{{ formatTime(detailModal.log.sentAt || detailModal.log.createdAt) }}</div>
                </div>
                <div v-if="detailModal.log.reservationId">
                  <div class="text-[10px] font-bold text-text-muted uppercase">Reserva</div>
                  <div class="text-navy font-mono">{{ detailModal.log.reservationId.slice(0, 12) }}</div>
                </div>
                <div v-if="detailModal.log.messageId">
                  <div class="text-[10px] font-bold text-text-muted uppercase">ID interno</div>
                  <div class="text-navy font-mono text-[10px]">{{ detailModal.log.messageId }}</div>
                </div>
              </div>
              <div v-if="detailModal.log.subject">
                <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Asunto</div>
                <div class="text-navy bg-surface rounded-xl p-2">{{ detailModal.log.subject }}</div>
              </div>
              <div v-if="detailModal.log.body">
                <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Cuerpo</div>
                <pre class="text-navy bg-surface rounded-xl p-2 whitespace-pre-wrap text-[11px] font-sans">{{ detailModal.log.body }}</pre>
              </div>
              <div v-if="detailModal.log.response">
                <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Respuesta del proveedor</div>
                <pre class="bg-coral/5 text-coral rounded-xl p-2 whitespace-pre-wrap text-[10px] font-mono">{{ detailModal.log.response }}</pre>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { MessageLogsService, msgStatusMeta, msgTypeMeta, ICON_INBOX } from '@/services/MessageLogs.service'
import type { MessageLog } from '@/services/MessageLogs.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

const auth = useAuthStore()
const toast = useToast()

const logs = ref<MessageLog[]>([])
const loading = ref(false)
const search = ref('')
const filterType = ref('')
const filterStatus = ref('')

const detailModal = ref<{ show: boolean; log: MessageLog | null }>({ show: false, log: null })

const stats = computed(() => ({
  total: logs.value.length,
  sent: logs.value.filter(l => l.status === 'sent').length,
  pending: logs.value.filter(l => l.status === 'pending' || l.status === 'queued').length,
  failed: logs.value.filter(l => l.status === 'failed').length,
}))

const filtered = computed(() => {
  let list = [...logs.value]
  if (filterType.value) list = list.filter(l => l.messageType === filterType.value)
  if (filterStatus.value) list = list.filter(l => l.status === filterStatus.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(l =>
      (l.recipient || '').toLowerCase().includes(q) ||
      (l.guestName || '').toLowerCase().includes(q) ||
      (l.reservationId || '').toLowerCase().includes(q)
    )
  }
  return list.sort((a, b) => (b.sentAt || b.createdAt || '').localeCompare(a.sentAt || a.createdAt || ''))
})

async function load() {
  loading.value = true
  try {
    const r = await MessageLogsService.list()
    logs.value = r.data || []
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar historial')
    logs.value = []
  } finally {
    loading.value = false
  }
}

function showDetail(log: MessageLog) {
  detailModal.value = { show: true, log }
}

function exportCsv() {
  const headers = ['Fecha', 'Tipo', 'Estado', 'Destinatario', 'Guest', 'Reserva', 'Respuesta']
  const rows = filtered.value.map(l => [
    l.sentAt || l.createdAt || '',
    l.messageType,
    l.status,
    l.recipient || '',
    l.guestName || '',
    l.reservationId || '',
    (l.response || '').replace(/[\n\r,]/g, ' '),
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `message-logs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`${rows.length} registros exportados`)
}

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(d?: string): string {
  if (!d) return ''
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
