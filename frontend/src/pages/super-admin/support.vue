<template>
  <div>
    <!-- Vista Principal: Lista de Tickets -->
    <div v-if="!selectedTicket">
      <!-- Métricas -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <div v-for="stat in supportMetrics" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
          <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
          <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div class="flex gap-2 flex-wrap">
          <button v-for="filter in statusFilters" :key="filter.value" @click="activeFilter = filter.value" class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer" :class="activeFilter === filter.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">{{ filter.label }}</button>
        </div>
        <div class="relative w-full sm:w-64">
          <input v-model="searchQuery" type="text" placeholder="Buscar ticket..." class="w-full h-9 pl-9 pr-4 rounded-lg border border-border text-sm bg-white focus:outline-none focus:border-cyan">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Tabla -->
      <SkeletonLoader v-if="loading" variant="table" :rows="6" />
      <SectionCard v-else title="Tickets de soporte" :subtitle="`${filteredTickets.length} ticket(s)`" body-class="p-0">
        <div class="overflow-x-auto">
        <table class="w-full tbl-head">
          <thead><tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">ID</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hotel</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Asunto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Prioridad</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Respuestas</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="ticket in filteredTickets" :key="ticket.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer" @click="selectTicket(ticket)">
              <td class="p-4 text-sm font-mono text-text-muted">#{{ ticket.id }}</td>
              <td class="p-4 text-sm font-bold text-navy">{{ ticket.hotel }}</td>
              <td class="p-4 text-sm">{{ ticket.subject }}</td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(ticket.category)">{{ ticket.category }}</span></td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(ticket.priority)">{{ ticket.priority }}</span></td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(ticket.status)">{{ ticket.status }}</span></td>
              <td class="p-4 text-sm">{{ ticket.replies.length }}</td>
              <td class="p-4 text-right">
                <button @click.stop="selectTicket(ticket)" class="px-3 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Abrir</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </SectionCard>
    </div>

    <!-- Vista Ticket: Chat -->
    <div v-else class="flex flex-col h-[calc(100vh-8rem)]">
      <!-- Header del Ticket (mismo look navy que SectionCard: no encaja el componente por el layout de 3 piezas header/mensajes/input, se replica el estilo a mano) -->
      <div class="bg-navy rounded-t-2xl px-4 sm:px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-4">
          <button @click="selectedTicket = null" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer">←</button>
          <div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white text-sm font-bold">{{ selectedTicket.hotel[0] }}</div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono text-white/60">#{{ selectedTicket.id }}</span>
              <span class="text-sm font-black text-white">{{ selectedTicket.subject }}</span>
            </div>
            <div class="text-[10px] text-white/60">{{ selectedTicket.hotel }} — {{ selectedTicket.category }}</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="priorityClass(selectedTicket.priority)">{{ selectedTicket.priority }}</span>
          <select v-model="selectedTicket.status" class="h-8 px-3 rounded-lg border border-white/15 bg-white/10 text-[10px] font-bold text-white focus:outline-none focus:border-cyan cursor-pointer">
            <option class="text-navy" value="Abierto">Abierto</option>
            <option class="text-navy" value="En Progreso">En Progreso</option>
            <option class="text-navy" value="Esperando Cliente">Esperando Cliente</option>
            <option class="text-navy" value="Resuelto">Resuelto</option>
            <option class="text-navy" value="Cerrado">Cerrado</option>
          </select>
        </div>
      </div>

      <!-- Mensajes -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/30 border-x border-border" ref="chatContainer">
        <!-- Descripción inicial -->
        <div class="flex gap-3">
          <div class="w-8 h-8 rounded-full bg-cyan/20 flex items-center justify-center text-[10px] font-bold text-cyan flex-shrink-0">{{ selectedTicket.hotel[0] }}</div>
          <div class="max-w-[70%]">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-bold text-navy">{{ selectedTicket.hotel }}</span>
              <span class="text-[9px] text-text-muted">{{ selectedTicket.createdAt }}</span>
            </div>
            <div class="p-4 rounded-2xl rounded-tl-sm bg-white border border-border shadow-sm text-sm text-text-secondary leading-relaxed">{{ selectedTicket.description }}</div>
            <div v-if="selectedTicket.attachments && selectedTicket.attachments.length" class="mt-2 flex flex-wrap gap-2">
              <div v-for="file in selectedTicket.attachments" :key="file" class="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-border text-[10px] font-bold cursor-pointer hover:bg-surface transition-colors">📎 {{ file }}</div>
            </div>
          </div>
        </div>

        <!-- Respuestas -->
        <div v-for="(reply, i) in selectedTicket.replies" :key="i" class="flex gap-3" :class="reply.author === 'Soporte Arckode' ? 'flex-row-reverse' : ''">
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" :class="reply.author === 'Soporte Arckode' ? 'bg-navy text-white' : 'bg-cyan/20 text-cyan'">
            {{ reply.author === 'Soporte Arckode' ? 'SA' : reply.author[0] }}
          </div>
          <div class="max-w-[70%]">
            <div class="flex items-center gap-2 mb-1" :class="reply.author === 'Soporte Arckode' ? 'justify-end' : ''">
              <span class="text-[10px] font-bold text-navy">{{ reply.author }}</span>
              <span class="text-[9px] text-text-muted">{{ reply.date }}</span>
            </div>
            <div class="p-4 rounded-2xl text-sm leading-relaxed" :class="reply.author === 'Soporte Arckode' ? 'bg-navy text-white rounded-tr-sm' : 'bg-white border border-border rounded-tl-sm'">{{ reply.message }}</div>
            <div v-if="reply.image" class="mt-2">
              <img :src="reply.image" class="max-w-xs rounded-xl border border-border cursor-pointer hover:shadow-lg transition-shadow" @click="openImageModal(reply.image)">
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div v-if="selectedTicket.status !== 'Cerrado'" class="bg-white rounded-b-2xl border border-border px-4 py-3">
        <!-- Preview de imagen -->
        <div v-if="imagePreview" class="mb-3 relative inline-block">
          <img :src="imagePreview" class="h-20 rounded-lg border border-border">
          <button @click="removeImage" class="absolute -top-2 -right-2 w-5 h-5 bg-red text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
        </div>
        <div class="flex items-center gap-2">
          <label class="w-9 h-9 rounded-xl bg-surface flex items-center justify-center text-text-muted hover:text-navy hover:bg-surface-dark transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <input type="file" class="hidden" accept="image/*" @change="handleImageUpload">
          </label>
          <input v-model="newMessage" @keyup.enter="sendMessage" type="text" placeholder="Escribir respuesta..." class="flex-1 h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy">
          <button @click="sendMessage" :disabled="!newMessage.trim() && !imagePreview" class="px-5 h-10 bg-navy text-white rounded-xl text-sm font-bold hover:shadow-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
        </div>
      </div>
      <div v-else class="bg-white rounded-b-2xl border border-border px-6 py-4 text-center">
        <span class="text-[10px] font-bold text-text-muted">Este ticket está cerrado</span>
      </div>
    </div>

    <!-- Modal: Ver Imagen -->
    <div v-if="showImageModal" class="fixed inset-0 bg-navy/80 flex items-center justify-center z-50">
      <div class="relative max-w-4xl max-h-[90vh]">
        <button @click="showImageModal = false" class="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center text-text-muted hover:text-navy shadow-lg cursor-pointer">✕</button>
        <img :src="imageModalSrc" class="max-h-[85vh] rounded-xl">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { OperationsService } from '@/services/Operations.service'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import SectionCard from '@/components/ui/SectionCard.vue'

const toast = useToast()
const loading = ref(true)
const activeFilter = ref('all')
const searchQuery = ref('')
const selectedTicket = ref<any>(null)
const newMessage = ref('')
const imagePreview = ref<string | null>(null)
const showImageModal = ref(false)
const imageModalSrc = ref('')
const chatContainer = ref<HTMLElement>()

const statusFilters = [
  { label: 'Todos', value: 'all' },
  { label: 'Abiertos', value: 'Abierto' },
  { label: 'En Progreso', value: 'En Progreso' },
  { label: 'Resueltos', value: 'Resuelto' },
  { label: 'Cerrados', value: 'Cerrado' }
]

const PRI_EN: Record<string, string> = { alta: 'Alta', urgente: 'Urgente', media: 'Normal', baja: 'Baja' }
const EST_EN: Record<string, string> = { abierto: 'Abierto', en_progreso: 'En Progreso', cerrado: 'Resuelto' }

const tickets = ref<any[]>([])

const supportMetrics = computed(() => {
  const t = tickets.value
  const en = (s: string) => t.filter((x: any) => x.status === s).length
  return [
    { label: 'Total Tickets', value: t.length, color: 'text-navy' },
    { label: 'Abiertos', value: en('Abierto'), color: 'text-orange' },
    { label: 'En Progreso', value: en('En Progreso'), color: 'text-cyan' },
    { label: 'Resueltos', value: en('Resuelto'), color: 'text-teal' },
    { label: 'Urgentes', value: t.filter((x: any) => x.priority === 'Urgente').length, color: 'text-red' },
  ]
})

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await OperationsService.tickets.list()
    tickets.value = data.map((t: any) => ({
      id: t.id, hotel: '', subject: t.subject, description: t.description ?? '',
      priority: PRI_EN[t.priority] ?? 'Normal', status: EST_EN[t.status] ?? 'Abierto',
      assignedTo: t.assignedTo ?? '', category: t.category,
      createdAt: t.createdAt ? String(t.createdAt).replace('T', ' ').slice(0, 16) : '',
      attachments: [], replies: (() => { try { return JSON.parse(t.mensajes || '[]') } catch { return [] } })(),
    }))
  } catch { toast.error('No se pudieron cargar los tickets de soporte') } finally { loading.value = false }
})

const filteredTickets = computed(() => {
  let result = tickets.value
  if (activeFilter.value !== 'all') result = result.filter(t => t.status === activeFilter.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t => t.subject.toLowerCase().includes(q) || t.hotel.toLowerCase().includes(q) || String(t.id).includes(q))
  }
  return result
})

const selectTicket = (ticket: any) => {
  selectedTicket.value = ticket
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  })
}

const handleImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]
    const reader = new FileReader()
    reader.onload = (ev) => { imagePreview.value = ev.target?.result as string }
    reader.readAsDataURL(file)
  }
}

const removeImage = () => { imagePreview.value = null }

const openImageModal = (src: string) => { imageModalSrc.value = src; showImageModal.value = true }

const sendMessage = () => {
  if ((!newMessage.value.trim() && !imagePreview.value) || !selectedTicket.value) return
  selectedTicket.value.replies.push({
    author: 'Soporte Arckode',
    date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    message: newMessage.value || 'Imagen adjunta',
    image: imagePreview.value || undefined
  })
  newMessage.value = ''
  imagePreview.value = null
  nextTick(() => {
    if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  })
}

const priorityClass = (p: string) => ({ 'Baja': 'bg-surface text-text-muted', 'Normal': 'bg-blue/10 text-blue', 'Alta': 'bg-orange/10 text-orange', 'Urgente': 'bg-red/10 text-red' }[p] || '')
const statusClass = (s: string) => ({ 'Abierto': 'bg-orange/10 text-orange', 'En Progreso': 'bg-cyan/10 text-cyan', 'Esperando Cliente': 'bg-purple/10 text-purple', 'Resuelto': 'bg-teal/10 text-teal', 'Cerrado': 'bg-surface text-text-muted' }[s] || '')
const categoryClass = (c: string) => ({ 'Técnico': 'bg-red/10 text-red', 'Integraciones': 'bg-cyan/10 text-cyan', 'Facturación': 'bg-navy/10 text-navy', 'Configuración': 'bg-purple/10 text-purple', 'Capacitación': 'bg-teal/10 text-teal', 'Sugerencia': 'bg-gold/10 text-gold' }[c] || '')
</script>
