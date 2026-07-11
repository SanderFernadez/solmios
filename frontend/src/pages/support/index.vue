<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Soporte</h2>
        <p class="text-sm text-text-muted mt-0.5">Centro de ayuda y tickets de soporte</p>
      </div>
      <button @click="showNewTicketModal = true" class="flex items-center gap-1.5 px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Nuevo Ticket
      </button>
    </div>

    <!-- Métricas -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div v-for="stat in metrics" :key="stat.label" class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="stat.bg"><span class="w-5 h-5" :class="stat.color" v-html="stat.icon"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none truncate" :class="stat.color">{{ stat.value }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">{{ stat.label }}</div></div>
        </div>
      </div>
    </div>

    <!-- Quick Links -->
    <div class="card p-6 mb-6">
      <div class="text-[10px] font-bold text-text-muted uppercase mb-4">Recursos Rápidos</div>
      <div class="grid grid-cols-4 gap-3">
        <div v-for="link in quickLinks" :key="link.title" class="p-4 bg-surface rounded-xl hover:bg-cyan/10 hover:border-cyan/30 border border-transparent transition-all cursor-pointer">
          <span class="w-5 h-5 text-cyan mb-2 block" v-html="link.icon"></span>
          <div class="text-sm font-bold text-navy">{{ link.title }}</div>
          <div class="text-[10px] text-text-muted mt-1">{{ link.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-2">
        <button v-for="f in statusFilters" :key="f.value" @click="activeFilter = f.value" class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer" :class="activeFilter === f.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">{{ f.label }}</button>
      </div>
      <div class="relative">
        <input v-model="searchQuery" type="text" placeholder="Buscar tickets..." class="w-64 h-9 pl-9 pr-4 rounded-lg border border-border text-sm bg-white focus:outline-none focus:border-cyan">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
    </div>

    <!-- Mis Tickets -->
    <div class="card overflow-hidden">
      <div class="p-4 border-b border-border"><div class="text-sm font-extrabold text-navy">Mis Tickets ({{ filteredTickets.length }})</div></div>
      <div v-if="filteredTickets.length === 0" class="p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_TICKET"></span>
        <div class="text-sm font-bold text-text-muted">No hay tickets</div>
        <div class="text-[10px] text-text-muted">Crea un ticket si necesitas ayuda</div>
      </div>
      <div v-else class="divide-y divide-border">
        <div v-for="ticket in filteredTickets" :key="ticket.id" @click="openTicket(ticket)" class="p-4 hover:bg-surface/50 transition-colors cursor-pointer">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-mono text-text-muted">#{{ ticket.id }}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="priorityClass(ticket.priority)">{{ ticket.priority }}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(ticket.status)">{{ ticket.status }}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(ticket.category)">{{ ticket.category }}</span>
              </div>
              <div class="text-sm font-bold text-navy mb-1">{{ ticket.subject }}</div>
              <div class="text-xs text-text-muted line-clamp-2">{{ ticket.description }}</div>
            </div>
            <div class="text-right ml-4 flex-shrink-0">
              <div class="text-[10px] text-text-muted">{{ ticket.createdAt }}</div>
              <div class="text-[10px] text-text-muted mt-1">{{ ticket.replies.length }} respuesta{{ ticket.replies.length !== 1 ? 's' : '' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Ver Ticket -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-black text-navy">Ticket #{{ selectedTicket.id }}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="priorityClass(selectedTicket.priority)">{{ selectedTicket.priority }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(selectedTicket.status)">{{ selectedTicket.status }}</span>
            </div>
            <div class="text-sm text-text-muted mt-1">{{ selectedTicket.createdAt }}</div>
          </div>
          <button @click="showViewModal = false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
          </button>
        </div>
        <div class="p-6">
          <div class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Asunto</div>
            <div class="text-sm font-bold">{{ selectedTicket.subject }}</div>
          </div>
          <div class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Descripción</div>
            <div class="text-sm text-text-secondary whitespace-pre-wrap">{{ selectedTicket.description }}</div>
          </div>
          <div v-if="selectedTicket.assignedTo" class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Asignado a</div>
            <div class="text-sm font-bold">{{ selectedTicket.assignedTo }}</div>
          </div>
          <div v-if="selectedTicket.replies && selectedTicket.replies.length">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-3">Conversación ({{ selectedTicket.replies.length }})</div>
            <div class="space-y-3">
              <div v-for="(reply, i) in selectedTicket.replies" :key="i" class="flex gap-3" :class="reply.author === 'Soporte Arckode' ? 'flex-row-reverse' : ''">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" :class="reply.author === 'Soporte Arckode' ? 'bg-red/20 text-red' : 'bg-cyan/20 text-cyan'">
                  {{ reply.author === 'Soporte Arckode' ? 'SA' : reply.author[0] }}
                </div>
                <div class="max-w-[70%]">
                  <div class="flex items-center gap-2 mb-1" :class="reply.author === 'Soporte Arckode' ? 'justify-end' : ''">
                    <span class="text-[10px] font-bold text-navy">{{ reply.author }}</span>
                    <span class="text-[9px] text-text-muted">{{ reply.date }}</span>
                  </div>
                  <div class="p-3 rounded-xl text-sm" :class="reply.author === 'Soporte Arckode' ? 'bg-navy text-white' : 'bg-surface text-text-secondary'">{{ reply.message }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button v-if="selectedTicket.status !== 'Cerrado'" @click="closeTicket" class="px-4 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar Ticket</button>
          <div class="flex-1"></div>
          <button @click="showViewModal = false" class="px-6 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button v-if="selectedTicket.status !== 'Cerrado'" @click="showViewModal = false; openReplyTicket(selectedTicket)" class="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Responder</button>
        </div>
      </div>
    </div>

    <!-- Modal: Responder -->
    <div v-if="showReplyModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Responder Ticket #{{ selectedTicket.id }}</h3>
          <button @click="showReplyModal = false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
          </button>
        </div>
        <div class="p-6">
          <div class="bg-surface rounded-xl p-3 mb-4"><div class="text-sm font-bold text-navy">{{ selectedTicket.subject }}</div></div>
          <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Tu Respuesta *</label><textarea v-model="replyMessage" rows="4" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Escriba su respuesta..."></textarea></div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showReplyModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="sendReply" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Enviar</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nuevo Ticket -->
    <div v-if="showNewTicketModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Nuevo Ticket de Soporte</h3>
          <button @click="showNewTicketModal = false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
          </button>
        </div>
        <div class="p-6">
          <div class="mb-4"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Categoría *</label>
            <select v-model="newTicket.category" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="">Seleccionar categoría</option>
              <option value="technical">Técnico</option>
              <option value="technical">Integraciones (Channex, OTAs)</option>
              <option value="billing">Facturación Electrónica</option>
              <option value="technical">Configuración del Sistema</option>
              <option value="general">Capacitación / Ayuda</option>
              <option value="general">Sugerencia de Mejora</option>
              <option value="general">Otro</option>
            </select>
          </div>
          <div class="mb-4"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Prioridad *</label>
            <select v-model="newTicket.priority" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="low">Baja — Sugerencia o mejora</option>
              <option value="medium">Normal — Duda o configuración</option>
              <option value="high">Alta — Funcionalidad bloqueada</option>
              <option value="urgent">Urgente — Sistema caído o overbooking</option>
            </select>
          </div>
          <div class="mb-4"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Asunto *</label><input v-model="newTicket.subject" type="text" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Descripción corta del problema"></div>
          <div class="mb-4"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Descripción Detallada *</label><textarea v-model="newTicket.description" rows="5" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Explique con detalle el problema o solicitud..."></textarea></div>
          <div class="bg-surface rounded-xl p-3 mb-4"><div class="text-[10px] font-bold text-text-muted uppercase mb-2">Archivos Adjuntos (opcional)</div><div class="flex items-center gap-3"><label class="flex items-center gap-1.5 px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold hover:border-navy/30 transition-colors cursor-pointer"><span class="w-4 h-4 shrink-0" v-html="ICON_PAPERCLIP"></span>Adjuntar archivo<input type="file" class="hidden" @change="handleFileUpload" multiple></label><span class="text-[10px] text-text-muted">PNG, JPG, PDF, LOG (máx 5MB)</span></div><div v-if="newTicket.files.length" class="mt-2 flex flex-wrap gap-2"><span v-for="(f, i) in newTicket.files" :key="i" class="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-border text-[10px] font-bold">{{ f }} <button @click="removeFile(i)" class="w-3 h-3 text-red cursor-pointer" v-html="ICON_X"></button></span></div></div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showNewTicketModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="createTicket" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Crear Ticket</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_TICKET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h3m-8.25 4.5h13.5A2.25 2.25 0 0 0 21 18.25V15a2.25 2.25 0 0 1 0-4.5V7.75A2.25 2.25 0 0 0 18.75 5.5H5.25A2.25 2.25 0 0 0 3 7.75v2.75a2.25 2.25 0 0 1 0 4.5v3.25A2.25 2.25 0 0 0 5.25 20.5Z"/></svg>'
const ICON_PAPERCLIP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"/></svg>'
const ICON_CLOCK_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'
const ICON_LOADER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_BOOK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>'
const ICON_PLAY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>'
const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const loading = ref(false)

const activeFilter = ref('all')
const searchQuery = ref('')
const showViewModal = ref(false)
const showReplyModal = ref(false)
const showNewTicketModal = ref(false)
const selectedTicket = ref<any>({})
const replyMessage = ref('')

const newTicket = ref({
  category: '',
  priority: 'medium',
  subject: '',
  description: '',
  files: [] as string[]
})

const statusFilters = [
  { label: 'Todos', value: 'all' },
  { label: 'Abiertos', value: 'open' },
  { label: 'En Progreso', value: 'in_progress' },
  { label: 'Resueltos', value: 'resolved' },
  { label: 'Cerrados', value: 'closed' }
]

const metrics = computed(() => {
  const t = tickets.value
  const en = (s: string) => t.filter((x: any) => x.rawStatus === s).length
  return [
    { label: 'Abiertos', value: en('open'), color: 'text-orange', bg: 'bg-orange/10', icon: ICON_CLOCK_ALERT },
    { label: 'En Progreso', value: en('in_progress'), color: 'text-cyan', bg: 'bg-cyan/10', icon: ICON_LOADER },
    { label: 'Resueltos', value: en('resolved'), color: 'text-teal', bg: 'bg-teal/10', icon: ICON_CHECK_CIRCLE },
    { label: 'Total', value: t.length, color: 'text-navy', bg: 'bg-navy/10', icon: ICON_TICKET },
  ]
})

const quickLinks = [
  { icon: ICON_BOOK, title: 'Guía Rápida', desc: 'Aprende lo básico del sistema' },
  { icon: ICON_PLAY, title: 'Video Tutoriales', desc: 'Paso a paso en video' },
  { icon: ICON_CHAT, title: 'Chat en Vivo', desc: 'Habla con soporte ahora' },
  { icon: ICON_MAIL, title: 'Email Directo', desc: 'soporte@arckode.com' }
]

const tickets = ref<any[]>([])

const PRI_EN: Record<string, string> = { low: 'Baja', medium: 'Normal', high: 'Alta', urgent: 'Urgente' }
const EST_EN: Record<string, string> = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado' }

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    const { data } = await OperationsService.tickets.list(hotelId.value)
    tickets.value = data.map((t: any) => {
      const raw = t.messages ?? t.mensajes
      const msgs = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(raw || '[]') } catch { return [] } })()
      return {
        id: t.id,
        subject: t.subject,
        description: t.description ?? '',
        priority: PRI_EN[t.priority] ?? 'Normal',
        status: EST_EN[t.status] ?? 'Abierto',
        rawStatus: t.status,
        category: t.category,
        createdAt: t.createdAt ? String(t.createdAt).replace('T', ' ').slice(0, 16) : '',
        assignedTo: t.assignedTo ?? '',
        replies: msgs,
      }
    })
  } catch { toast.error('Error al cargar tickets') }
  loading.value = false
}

const filteredTickets = computed(() => {
  let result = tickets.value
  if (activeFilter.value !== 'all') result = result.filter(t => t.rawStatus === activeFilter.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t => t.subject.toLowerCase().includes(q) || String(t.id).includes(q))
  }
  return result
})

const priorityClass = (p: string) => ({ 'Baja': 'bg-surface text-text-muted', 'Normal': 'bg-blue/10 text-blue', 'Alta': 'bg-orange/10 text-orange', 'Urgente': 'bg-red/10 text-red' }[p] || '')
const statusClass = (s: string) => ({ 'Abierto': 'bg-orange/10 text-orange', 'En Progreso': 'bg-cyan/10 text-cyan', 'Resuelto': 'bg-teal/10 text-teal', 'Cerrado': 'bg-surface text-text-muted' }[s] || '')
const categoryClass = (c: string) => ({ 'Técnico': 'bg-red/10 text-red', 'Integraciones': 'bg-cyan/10 text-cyan', 'Facturación': 'bg-navy/10 text-navy', 'Configuración': 'bg-purple/10 text-purple', 'Capacitación': 'bg-teal/10 text-teal', 'Sugerencia': 'bg-gold/10 text-gold' }[c] || '')

const openTicket = (ticket: any) => { selectedTicket.value = { ...ticket }; showViewModal.value = true }
const openReplyTicket = (ticket: any) => { selectedTicket.value = { ...ticket }; replyMessage.value = ''; showReplyModal.value = true }

const sendReply = async () => {
  if (!replyMessage.value.trim()) return
  const idx = tickets.value.findIndex(t => t.id === selectedTicket.value.id)
  if (idx !== -1) {
    const newReply = { author: 'Hotel Admin', date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), message: replyMessage.value }
    const updatedReplies = [...tickets.value[idx].replies, newReply]
    try {
      await OperationsService.tickets.update(selectedTicket.value.id, { messages: updatedReplies })
      tickets.value[idx].replies = updatedReplies
      toast.success('Respuesta enviada')
    } catch { toast.error('Error al enviar respuesta') }
    replyMessage.value = ''
  }
  showReplyModal.value = false
}

const closeTicket = async () => {
  try {
    await OperationsService.tickets.update(selectedTicket.value.id, { status: 'closed' })
    showViewModal.value = false
    toast.success('Ticket cerrado')
    await loadData()
  } catch { toast.error('Error al cerrar ticket') }
}

const handleFileUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files) {
    for (const file of input.files) {
      newTicket.value.files.push(file.name)
    }
  }
}

const removeFile = (index: number) => {
  newTicket.value.files.splice(index, 1)
}

const createTicket = async () => {
  if (!newTicket.value.subject) return
  try {
    await OperationsService.tickets.create({
      subject: newTicket.value.subject,
      description: newTicket.value.description || '',
      category: newTicket.value.category || 'general',
      priority: newTicket.value.priority || 'medium',
      status: 'open',
      hotelId: hotelId.value,
      userId: auth.user?.id || 'guest',
    })
    newTicket.value = { category: '', priority: 'medium', subject: '', description: '', files: [] }
    showNewTicketModal.value = false
    toast.success('Ticket creado')
    await loadData()
  } catch { toast.error('Error al crear ticket') }
}
</script>
