<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Historial de Envíos</h2>
        <p class="text-sm text-text-muted mt-0.5">Trazabilidad de emails, WhatsApp y SMS enviados a huéspedes</p>
      </div>
      <div class="flex gap-2">
        <button @click="load" :disabled="loading" class="flex items-center gap-1.5 px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_REFRESH"></span>{{ loading ? 'Cargando...' : 'Refrescar' }}
        </button>
        <button @click="exportCsv" :disabled="logs.length === 0" class="flex items-center gap-1.5 px-4 py-2 bg-cyan text-navy font-bold text-sm rounded-xl hover:shadow-lg cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_DOWNLOAD"></span>Exportar CSV
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10"><span class="w-5 h-5 text-navy" v-html="ICON_MAIL"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-navy truncate">{{ stats.total }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10"><span class="w-5 h-5 text-teal" v-html="ICON_CHECK_CIRCLE"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-teal truncate">{{ stats.sent }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Enviados</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10"><span class="w-5 h-5 text-gold" v-html="ICON_CLOCK"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-gold truncate">{{ stats.pending }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Pendientes</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10"><span class="w-5 h-5 text-coral" v-html="ICON_XCIRCLE"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-coral truncate">{{ stats.failed }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Fallidos</div></div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar destinatario..." class="px-4 py-2 rounded-xl border border-border text-sm w-56 focus:outline-none focus:border-navy" />
      <select v-model="filterType" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los canales</option>
        <option value="email">Email</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
      </select>
      <select v-model="filterStatus" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los estados</option>
        <option value="sent">Enviados</option>
        <option value="pending">Pendientes</option>
        <option value="failed">Fallidos</option>
        <option value="queued">En cola</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} resultados</span>
    </div>

    <!-- Lista -->
    <div v-if="loading && logs.length === 0" class="card p-12 text-center text-sm text-text-muted">Cargando...</div>
    <div v-else-if="filtered.length === 0" class="card p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_MAIL"></span>
      <h3 class="font-bold text-navy mb-1">Sin envíos registrados</h3>
      <p class="text-xs text-text-muted">Cuando se disparen auto-messages o envíos manuales, aparecerán aquí.</p>
    </div>
    <div v-else class="bg-white rounded-2xl border border-border overflow-hidden">
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
              <span class="text-xs text-text-secondary font-bold">{{ msgTypeMeta(log.messageType).label }}</span>
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
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="msgStatusMeta(log.status).class">
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
      <div v-if="detailModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-black text-navy">Detalle de envío</h3>
              <p class="text-xs text-text-muted">
                {{ msgTypeMeta(detailModal.log?.messageType || '').label }} ·
                <span :class="msgStatusMeta(detailModal.log?.status || '').class">{{ msgStatusMeta(detailModal.log?.status || '').label }}</span>
              </p>
            </div>
            <button @click="detailModal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-navy cursor-pointer">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div v-if="detailModal.log" class="space-y-3 text-xs">
            <div class="grid grid-cols-2 gap-3 bg-surface rounded-lg p-3">
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
              <div class="text-navy bg-surface rounded-lg p-2">{{ detailModal.log.subject }}</div>
            </div>
            <div v-if="detailModal.log.body">
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Cuerpo</div>
              <pre class="text-navy bg-surface rounded-lg p-2 whitespace-pre-wrap text-[11px] font-sans">{{ detailModal.log.body }}</pre>
            </div>
            <div v-if="detailModal.log.response">
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Respuesta del proveedor</div>
              <pre class="bg-coral/5 text-coral rounded-lg p-2 whitespace-pre-wrap text-[10px] font-mono">{{ detailModal.log.response }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { MessageLogsService, msgStatusMeta, msgTypeMeta } from '@/services/MessageLogs.service'
import type { MessageLog } from '@/services/MessageLogs.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>'
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12l4.5 4.5m0 0 4.5-4.5m-4.5 4.5V3"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_XCIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'

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
