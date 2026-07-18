<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { AiReceptionistService } from '@/services/AiReceptionist.service'
import type { AiConversation, AiMessage } from '@/services/AiReceptionist.service'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const ICON_ROBOT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5.5v2M5 10.5h14a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a1 1 0 0 1 1-1Z"/><circle cx="9" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>'
const ICON_HAND = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.67c-.503 0-.917.4-.917.899v6.14a.916.916 0 0 1-1.833 0V5.914a.916.916 0 0 0-1.833 0v6.503a7.75 7.75 0 0 0 7.75 7.75h1.036a6.5 6.5 0 0 0 6.5-6.5V9.25a.917.917 0 0 0-1.833 0v1.542a.917.917 0 0 1-1.834 0V6.898a.917.917 0 0 0-1.833 0v3.895a.917.917 0 0 1-1.834 0V2.4c0-.498-.41-.899-.917-.899Z"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_SEARCH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"/></svg>'
const ICON_SEND = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/></svg>'

// Seguridad (SC-06): msg.content puede venir del huésped. Se escapa el HTML ANTES de aplicar
// el formato (**bold**, saltos), si no un mensaje con `<img onerror=...>` ejecutaría en el
// navegador del staff (XSS almacenado). El formato intencional sigue funcionando sobre el texto escapado.
function formatMessage(content: string): string {
  const escaped = String(content ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
}

const conversations = ref<AiConversation[]>([])
const selectedId = ref<string | null>(null)
const messages = ref<AiMessage[]>([])
const newMessage = ref('')
const loading = ref(true)
const filter = ref<'all' | 'active' | 'transferred' | 'waiting'>('all')
const searchQuery = ref('')
let pollInterval: ReturnType<typeof setInterval> | null = null
let msgPollInterval: ReturnType<typeof setInterval> | null = null
const CONV_POLL_MS = 5000
const MSG_POLL_MS = 3000
const lastMsgCount = ref(0)
const unreadCounts = ref<Record<string, number>>({})

const currentConv = computed(() => conversations.value.find(c => c.id === selectedId.value))
const isAutoMode = computed(() => currentConv.value?.status === 'active')
const isHumanMode = computed(() => currentConv.value?.status === 'transferred')
const isWaiting = computed(() => currentConv.value?.status === 'waiting')
const isResolved = computed(() => currentConv.value?.status === 'resolved')

function playNotification() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.value = 0.1
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch {}
}

async function loadConversations() {
  try {
    const params: Record<string, any> = {}
    if (filter.value !== 'all') params.status = filter.value
    const res = await AiReceptionistService.listConversations(params)
    const oldConvs = conversations.value
    conversations.value = res.data || []

    for (const conv of conversations.value) {
      const old = oldConvs.find(c => c.id === conv.id)
      if (old && conv.lastMessageAt && conv.lastMessageAt !== old.lastMessageAt && conv.id !== selectedId.value) {
        unreadCounts.value[conv.id] = (unreadCounts.value[conv.id] || 0) + 1
        playNotification()
      }
    }

    if (selectedId.value && !conversations.value.find(c => c.id === selectedId.value)) {
      selectedId.value = null; messages.value = []
    }
  } catch {} finally {
    loading.value = false
  }
}

async function loadMessages() {
  if (!selectedId.value) return
  try {
    const res = await AiReceptionistService.getConversation(selectedId.value)
    const newMsgs = res.messages || []
    if (newMsgs.length > messages.value.length) {
      messages.value = newMsgs
      await nextTick()
      scrollToBottom()
      if (newMsgs.length > lastMsgCount.value && newMsgs[newMsgs.length - 1]?.sender === 'guest') {
        playNotification()
      }
      lastMsgCount.value = newMsgs.length
    }
  } catch {}
}

async function selectConversation(id: string) {
  selectedId.value = id; newMessage.value = ''
  unreadCounts.value[id] = 0
  try {
    const res = await AiReceptionistService.getConversation(id)
    messages.value = res.messages || []
    lastMsgCount.value = messages.value.length
    await nextTick()
    scrollToBottom()
    startMsgPolling()
  } catch {}
}

function startMsgPolling() {
  if (msgPollInterval) clearInterval(msgPollInterval)
  msgPollInterval = setInterval(loadMessages, MSG_POLL_MS)
}

async function sendMessage() {
  if (!newMessage.value.trim() || !selectedId.value) return
  const msg = await AiReceptionistService.sendMessage(selectedId.value, newMessage.value.trim())
  messages.value.push(msg); newMessage.value = ''; await nextTick(); scrollToBottom()
  lastMsgCount.value = messages.value.length
}

async function takeConversation() {
  if (!selectedId.value) return
  await AiReceptionistService.transferConversation(selectedId.value, 'me')
  const conv = conversations.value.find(c => c.id === selectedId.value)
  if (conv) conv.status = 'transferred'
}

async function returnToBot() {
  if (!selectedId.value) return
  await AiReceptionistService.transferConversation(selectedId.value, null)
  const conv = conversations.value.find(c => c.id === selectedId.value)
  if (conv) conv.status = 'active'
}

async function closeConversation() {
  if (!selectedId.value) return
  await AiReceptionistService.closeConversation(selectedId.value)
  const conv = conversations.value.find(c => c.id === selectedId.value)
  if (conv) conv.status = 'resolved'
}

function scrollToBottom() {
  const el = document.getElementById('chat-messages')
  if (el) el.scrollTop = el.scrollHeight
}

const filteredConvs = computed(() => {
  if (!searchQuery.value) return conversations.value
  const q = searchQuery.value.toLowerCase()
  return conversations.value.filter(c => c.guestName?.toLowerCase().includes(q) || c.guestPhone?.includes(q))
})

const activeCount = computed(() => conversations.value.filter(c => c.status === 'active').length)
const agentCount = computed(() => conversations.value.filter(c => c.status === 'transferred').length)
const waitingCount = computed(() => conversations.value.filter(c => c.status === 'waiting').length)
const totalCount = computed(() => conversations.value.length)
const botShare = computed(() => (totalCount.value ? Math.round((activeCount.value / totalCount.value) * 100) : 0))

const hasListFilters = computed(() => !!searchQuery.value || filter.value !== 'all')

// Línea de contexto del huésped: solo los datos que existen (nada de "—" sueltos).
const currentConvMeta = computed(() => {
  const conv = currentConv.value
  if (!conv) return ''
  const parts: string[] = []
  if (conv.guestPhone) parts.push(conv.guestPhone)
  if (conv.channel) parts.push(conv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat')
  return parts.join(' · ')
})

const STATUS_LABEL: Record<string, string> = {
  active: 'IA respondiendo', transferred: 'Modo manual', waiting: 'En espera', resolved: 'Resuelta',
}

function clearListFilters() {
  searchQuery.value = ''
  filter.value = 'all'
}

watch(selectedId, () => {
  if (selectedId.value) startMsgPolling()
  else if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null }
})

onMounted(() => { loadConversations(); pollInterval = setInterval(loadConversations, CONV_POLL_MS) })
onUnmounted(() => { if (pollInterval) clearInterval(pollInterval); if (msgPollInterval) clearInterval(msgPollInterval) })
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 mb-6 flex-wrap">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Recepcionista IA</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-sm text-text-muted mt-0.5">Conversaciones con huéspedes atendidas por la IA o por un agente</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <KpiHeroCard label="Conversaciones" :value="totalCount" icon="bookings" accent="blue"
        unit="Total en el periodo" />
      <KpiHeroCard label="Atendidas por IA" :value="activeCount" icon="checkin" accent="teal"
        unit="La IA responde sola" :progress="botShare" />
      <KpiHeroCard label="Con agente" :value="agentCount" icon="users" accent="purple"
        unit="Tomadas por el equipo" />
      <KpiHeroCard label="En espera" :value="waitingCount" icon="checkout" accent="amber"
        unit="Esperan que alguien las tome" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
      <!-- Listado de conversaciones -->
      <SectionCard title="Conversaciones" :subtitle="`${filteredConvs.length} de ${totalCount} conversación(es)`" body-class="p-0">
        <template #actions>
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" v-html="ICON_SEARCH"></span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar huésped o teléfono..."
              class="w-full sm:w-56 pl-9 pr-3 py-2 rounded-lg border border-white/15 bg-white/10 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-cyan focus:bg-white/15 transition-colors"
            />
          </div>
        </template>

        <!-- Filtros de estado (barra clara: el navy ya lo pone el header) -->
        <nav class="flex gap-1 border-b border-border px-3 py-2.5 overflow-x-auto">
          <button v-for="f in [{k:'all',l:'Todas'},{k:'active',l:'Bot'},{k:'transferred',l:'Agente'},{k:'waiting',l:'Espera'}]" :key="f.k"
            @click="filter = f.k as any"
            :class="['shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer', filter === f.k ? 'bg-navy text-white shadow-sm' : 'text-text-secondary hover:bg-surface hover:text-navy']">
            {{ f.l }}
          </button>
        </nav>

        <!-- Skeletons -->
        <div v-if="loading" class="divide-y divide-border">
          <div v-for="n in 5" :key="n" class="flex items-start gap-3 px-4 py-3.5">
            <div class="h-9 w-9 shrink-0 animate-pulse rounded-full bg-surface"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3 w-2/3 animate-pulse rounded bg-surface"></div>
              <div class="h-2.5 w-1/3 animate-pulse rounded bg-surface"></div>
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="!filteredConvs.length"
          :icon="ICON_CHAT"
          :title="hasListFilters ? 'Sin resultados' : 'Todavía no hay conversaciones'"
          :message="hasListFilters ? 'Probá con otro término de búsqueda o quitá el filtro de estado.' : 'Cuando un huésped escriba por WhatsApp o por el chat web, la conversación aparecerá acá.'"
        >
          <template v-if="hasListFilters" #action>
            <button @click="clearListFilters" class="rounded-full border border-border px-5 py-2.5 text-sm font-bold text-navy hover:bg-surface transition-colors cursor-pointer">
              Limpiar filtros
            </button>
          </template>
        </EmptyState>

        <div v-else class="max-h-[62vh] divide-y divide-border overflow-y-auto">
          <button v-for="conv in filteredConvs" :key="conv.id" @click="selectConversation(conv.id)"
            :class="['w-full cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-surface/70', selectedId === conv.id ? 'bg-cyan/5 border-l-[3px] border-l-cyan pl-[13px]' : '']">
            <div class="flex items-start gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy/5 text-[11px] font-black text-navy">
                {{ conv.guestName?.charAt(0)?.toUpperCase() || 'H' }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <span class="truncate text-sm font-extrabold text-navy">{{ conv.guestName || 'Huésped' }}</span>
                  <span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    :class="conv.channel === 'whatsapp' ? 'bg-teal/10 text-teal' : 'bg-cyan/10 text-cyan'">
                    {{ conv.channel === 'webchat' ? 'Web' : 'WA' }}
                  </span>
                </div>
                <p v-if="conv.guestPhone" class="mt-0.5 truncate text-[11px] tabular-nums text-text-muted">{{ conv.guestPhone }}</p>
                <div class="mt-1.5 flex items-center gap-1.5">
                  <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    :class="conv.status === 'active' ? 'bg-teal/10 text-teal' : conv.status === 'transferred' ? 'bg-purple/10 text-purple' : conv.status === 'waiting' ? 'bg-gold/10 text-gold' : 'bg-surface text-text-muted'">
                    <span class="h-2.5 w-2.5 shrink-0" v-html="conv.status === 'active' ? ICON_ROBOT : conv.status === 'transferred' ? ICON_USER : conv.status === 'waiting' ? ICON_CLOCK : ICON_CHECK"></span>
                    {{ conv.status === 'active' ? 'IA' : conv.status === 'transferred' ? 'Agente' : conv.status === 'waiting' ? 'Espera' : 'Listo' }}
                  </span>
                  <span v-if="unreadCounts[conv.id]" class="ml-auto grid h-5 w-5 place-items-center rounded-full bg-coral text-[10px] font-black tabular-nums text-white animate-pulse">
                    {{ unreadCounts[conv.id] > 9 ? '9+' : unreadCounts[conv.id] }}
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>
      </SectionCard>

      <!-- Conversación -->
      <SectionCard body-class="p-0">
        <template #header>
          <div v-if="currentConv" class="flex min-w-0 items-center gap-3">
            <div class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black text-white">
              {{ currentConv.guestName?.charAt(0)?.toUpperCase() || 'H' }}
            </div>
            <div class="min-w-0">
              <h2 class="truncate text-base sm:text-lg font-black text-white">{{ currentConv.guestName || 'Huésped' }}</h2>
              <p v-if="currentConvMeta" class="mt-0.5 truncate text-[11px] text-white/60">{{ currentConvMeta }}</p>
            </div>
          </div>
          <div v-else class="min-w-0">
            <h2 class="truncate text-base sm:text-lg font-black text-white">Conversación</h2>
            <p class="mt-0.5 truncate text-[11px] text-white/60">Elegí una conversación de la lista</p>
          </div>
        </template>

        <template #actions>
          <template v-if="currentConv">
            <div class="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white">
              <span :class="['h-2 w-2 rounded-full',
                isAutoMode ? 'bg-teal-light animate-pulse' : isHumanMode ? 'bg-purple-light' : isWaiting ? 'bg-gold-light' : 'bg-white/50']" />
              {{ STATUS_LABEL[currentConv.status] || currentConv.status }}
            </div>

            <button v-if="isAutoMode" @click="takeConversation"
              class="flex cursor-pointer items-center gap-1.5 rounded-full bg-cyan px-4 py-2 text-xs font-extrabold text-navy transition-all hover:shadow-lg">
              <span class="h-3.5 w-3.5 shrink-0" v-html="ICON_HAND"></span>
              Tomar yo
            </button>
            <button v-if="isHumanMode" @click="returnToBot"
              class="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-white/20">
              <span class="h-3.5 w-3.5 shrink-0" v-html="ICON_ROBOT"></span>
              Devolver IA
            </button>
            <button v-if="!isResolved" @click="closeConversation"
              class="cursor-pointer rounded-full px-3 py-2 text-xs font-bold text-white/70 transition-colors hover:text-white">
              Cerrar
            </button>
          </template>
        </template>

        <!-- Sin conversación seleccionada -->
        <EmptyState v-if="!selectedId || !currentConv"
          :icon="ICON_ROBOT"
          title="Seleccioná una conversación"
          message="La IA responde sola hasta que un agente decida tomar el control de la charla.">
          <template #action>
            <div class="flex flex-wrap justify-center gap-4 text-[11px] font-semibold text-text-muted">
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-teal" /> Bot activo</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-purple" /> Con agente</span>
              <span class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-gold" /> En espera</span>
            </div>
          </template>
        </EmptyState>

        <div v-else class="flex h-[62vh] min-h-[420px] flex-col">
          <!-- Mensajes -->
          <div id="chat-messages" class="flex-1 space-y-4 overflow-y-auto bg-surface/50 px-4 py-5 sm:px-5">
            <EmptyState v-if="messages.length === 0"
              :icon="ICON_CHAT"
              title="Sin mensajes aún"
              message="Esperando el primer mensaje del huésped." />

            <div v-for="msg in messages" :key="msg.id"
              :class="['flex gap-2.5', msg.sender === 'guest' ? 'justify-end' : '']">
              <div v-if="msg.sender !== 'guest'"
                :class="['grid h-7 w-7 shrink-0 place-items-center rounded-lg p-1.5',
                  msg.sender === 'bot' ? 'bg-teal/10 text-teal' : 'bg-purple/10 text-purple']">
                <span class="h-full w-full" v-html="msg.sender === 'bot' ? ICON_ROBOT : ICON_USER"></span>
              </div>

              <div class="max-w-[78%] sm:max-w-[70%]">
                <div class="mb-1 flex items-center gap-2" :class="msg.sender === 'guest' ? 'justify-end' : ''">
                  <span class="text-[10px] font-extrabold uppercase tracking-wide"
                    :class="msg.sender === 'guest' ? 'text-text-muted' : msg.sender === 'bot' ? 'text-teal' : 'text-purple'">
                    {{ msg.sender === 'guest' ? currentConv?.guestName || 'Huésped' : msg.sender === 'bot' ? 'Sofía · IA' : 'Agente' }}
                  </span>
                  <span v-if="msg.intentDetected" class="rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-bold text-text-muted">{{ msg.intentDetected }}</span>
                  <span v-if="msg.confidence !== undefined && msg.sender === 'bot'"
                    class="text-[9px] font-bold tabular-nums" :class="msg.confidence >= 0.65 ? 'text-teal' : 'text-text-muted'">
                    {{ (msg.confidence * 100).toFixed(0) }}%
                  </span>
                </div>
                <div :class="['rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.sender === 'guest'
                    ? 'rounded-br-md border border-border bg-white text-navy shadow-(--shadow-card)'
                    : 'rounded-bl-md bg-navy text-white']"
                  v-html="formatMessage(msg.content)" />
              </div>

              <div v-if="msg.sender === 'guest'"
                class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-navy/5 text-[11px] font-black text-text-secondary">
                {{ currentConv?.guestName?.charAt(0)?.toUpperCase() || 'H' }}
              </div>
            </div>
          </div>

          <!-- Composer -->
          <footer class="shrink-0 border-t border-border bg-white px-4 py-3.5 sm:px-5">
            <div class="flex gap-2">
              <div class="relative flex-1">
                <input v-model="newMessage" @keyup.enter="sendMessage"
                  :placeholder="isAutoMode ? 'La IA está respondiendo automáticamente...' : isWaiting ? 'Esperando que un agente disponible tome la conversación...' : 'Escribí un mensaje...'"
                  :disabled="isAutoMode || isWaiting"
                  class="w-full rounded-full border px-4 py-2.5 text-sm font-medium transition-all"
                  :class="isAutoMode
                    ? 'cursor-not-allowed border-teal/30 bg-surface text-text-muted'
                    : isHumanMode
                      ? 'border-purple/30 bg-white text-navy placeholder-text-muted focus:border-purple focus:outline-none focus:ring-1 focus:ring-purple/20'
                      : 'border-border bg-white text-navy placeholder-text-muted focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan/20'" />
                <div v-if="isAutoMode" class="absolute right-4 top-1/2 flex -translate-y-1/2 gap-0.5">
                  <span class="h-1 w-1 animate-bounce rounded-full bg-teal opacity-60 [animation-delay:0ms]" />
                  <span class="h-1 w-1 animate-bounce rounded-full bg-teal opacity-60 [animation-delay:150ms]" />
                  <span class="h-1 w-1 animate-bounce rounded-full bg-teal opacity-60 [animation-delay:300ms]" />
                </div>
              </div>
              <button @click="sendMessage" :disabled="isAutoMode || isWaiting || !newMessage.trim()"
                class="flex cursor-pointer items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-30"
                :class="isHumanMode ? 'bg-purple hover:bg-purple-light' : 'bg-navy hover:bg-navy-light'">
                <span class="h-3.5 w-3.5 shrink-0" v-html="ICON_SEND"></span>
                Enviar
              </button>
            </div>
            <p v-if="isAutoMode" class="mt-2 text-center text-[10px] font-medium text-text-muted">
              Tocá <span class="font-bold text-navy">«Tomar yo»</span> para responder manualmente
            </p>
          </footer>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<style scoped>
/* Sin estilos propios: los SVG inyectados por v-html ya traen `class="w-full h-full"`
   y heredan el tamaño del span contenedor. */
</style>
