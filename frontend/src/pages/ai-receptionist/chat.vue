<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { AiReceptionistService } from '@/services/AiReceptionist.service'
import type { AiConversation, AiMessage } from '@/services/AiReceptionist.service'

const ICON_ROBOT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5.5v2M5 10.5h14a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a1 1 0 0 1 1-1Z"/><circle cx="9" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>'
const ICON_HAND = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.67c-.503 0-.917.4-.917.899v6.14a.916.916 0 0 1-1.833 0V5.914a.916.916 0 0 0-1.833 0v6.503a7.75 7.75 0 0 0 7.75 7.75h1.036a6.5 6.5 0 0 0 6.5-6.5V9.25a.917.917 0 0 0-1.833 0v1.542a.917.917 0 0 1-1.834 0V6.898a.917.917 0 0 0-1.833 0v3.895a.917.917 0 0 1-1.834 0V2.4c0-.498-.41-.899-.917-.899Z"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'

const conversations = ref<AiConversation[]>([])
const selectedId = ref<string | null>(null)
const messages = ref<AiMessage[]>([])
const newMessage = ref('')
const loading = ref(false)
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
  } catch {}
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

watch(selectedId, () => {
  if (selectedId.value) startMsgPolling()
  else if (msgPollInterval) { clearInterval(msgPollInterval); msgPollInterval = null }
})

onMounted(() => { loadConversations(); pollInterval = setInterval(loadConversations, CONV_POLL_MS) })
onUnmounted(() => { if (pollInterval) clearInterval(pollInterval); if (msgPollInterval) clearInterval(msgPollInterval) })
</script>

<template>
  <div class="flex h-full bg-surface">
    <!-- Sidebar -->
    <aside class="w-80 shrink-0 border-r border-border flex flex-col bg-white">
      <header class="p-4 border-b border-border">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 bg-gradient-to-br from-cyan to-teal rounded-xl flex items-center justify-center shadow-sm text-white">
            <span class="w-5 h-5 shrink-0" v-html="ICON_ROBOT"></span>
          </div>
          <div>
            <h1 class="font-extrabold text-navy">Recepcionista IA</h1>
            <p class="text-[10px] text-text-muted font-medium">{{ activeCount }} en bot · {{ agentCount }} con agente</p>
          </div>
        </div>
        <input v-model="searchQuery" placeholder="Buscar huésped o teléfono..."
          class="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm placeholder-text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20 text-navy" />
      </header>

      <nav class="px-3 py-2 border-b border-border flex gap-1">
        <button v-for="f in [{k:'all',l:'Todas'},{k:'active',l:'Bot'},{k:'transferred',l:'Agente'},{k:'waiting',l:'Espera'}]" :key="f.k"
          @click="filter = f.k as any"
          :class="['px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer', filter === f.k ? 'bg-navy text-white shadow-sm' : 'text-text-secondary hover:text-navy hover:bg-surface']">
          {{ f.l }}</button>
      </nav>

      <div class="flex-1 overflow-y-auto">
        <div v-if="filteredConvs.length === 0" class="p-8 text-center">
          <span class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_CHAT"></span>
          <p class="text-sm font-bold text-text-muted">Sin conversaciones</p>
          <p class="text-[10px] text-text-muted mt-1">Las conversaciones nuevas aparecerán aquí</p>
        </div>
        <button v-for="conv in filteredConvs" :key="conv.id" @click="selectConversation(conv.id)"
          :class="['w-full text-left p-3 border-b border-border/60 hover:bg-surface transition-colors cursor-pointer', selectedId === conv.id ? 'bg-cyan/5 border-l-[3px] border-l-cyan' : '']">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-extrabold text-navy truncate">{{ conv.guestName || 'Guest' }}</span>
              </div>
              <p class="text-[11px] text-text-muted truncate mt-0.5">{{ conv.guestPhone || 'Sin teléfono' }}</p>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
              :class="conv.channel === 'whatsapp' ? 'bg-success/10 text-success' : 'bg-cyan/10 text-cyan'">
              {{ conv.channel === 'webchat' ? 'Web' : 'WA' }}</span>
          </div>
          <div class="flex gap-1.5 mt-1.5 items-center">
            <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              :class="conv.status === 'active' ? 'bg-success/10 text-success' : conv.status === 'transferred' ? 'bg-purple/10 text-purple' : conv.status === 'waiting' ? 'bg-warning/10 text-warning' : 'bg-border text-text-muted'">
              <span class="w-2.5 h-2.5 shrink-0" v-html="conv.status === 'active' ? ICON_ROBOT : conv.status === 'transferred' ? ICON_USER : conv.status === 'waiting' ? ICON_CLOCK : ICON_CHECK"></span>
              {{ conv.status === 'active' ? 'IA' : conv.status === 'transferred' ? 'Agente' : conv.status === 'waiting' ? 'Espera' : 'Listo' }}
            </span>
            <span v-if="unreadCounts[conv.id]" class="ml-auto w-5 h-5 bg-coral text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
              {{ unreadCounts[conv.id] > 9 ? '9+' : unreadCounts[conv.id] }}
            </span>
          </div>
        </button>
      </div>
    </aside>

    <!-- Chat -->
    <main class="flex-1 flex flex-col bg-surface">
      <template v-if="selectedId && currentConv">
        <header class="shrink-0 px-5 py-3 border-b border-border bg-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold"
              :class="isAutoMode ? 'bg-success/10 text-success' : isHumanMode ? 'bg-purple/10 text-purple' : 'bg-warning/10 text-warning'">
              {{ currentConv.guestName?.charAt(0)?.toUpperCase() || 'G' }}
            </div>
            <div>
              <p class="text-sm font-extrabold text-navy">{{ currentConv.guestName || 'Guest' }}</p>
              <p class="text-[11px] text-text-muted">{{ currentConv.guestPhone }} · {{ currentConv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold',
              isAutoMode ? 'bg-success/5 text-success border border-success/20' :
              isHumanMode ? 'bg-purple/5 text-purple border border-purple/20' :
              isWaiting ? 'bg-warning/5 text-warning border border-warning/20' :
              'bg-surface text-text-muted border border-border']">
              <span :class="['w-2 h-2 rounded-full',
                isAutoMode ? 'bg-success animate-pulse' : isHumanMode ? 'bg-purple' : isWaiting ? 'bg-warning' : 'bg-text-muted']" />
              {{ isAutoMode ? 'IA respondiendo' : isHumanMode ? 'Modo manual' : isWaiting ? 'En espera' : 'Resuelta' }}
            </div>

            <button v-if="isAutoMode" @click="takeConversation"
              class="flex items-center gap-1.5 px-4 py-2 bg-purple hover:bg-purple-light text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer">
              <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_HAND"></span>
              Tomar yo
            </button>
            <button v-if="isHumanMode" @click="returnToBot"
              class="flex items-center gap-1.5 px-4 py-2 bg-teal hover:bg-teal-light text-white text-xs font-extrabold rounded-xl transition-all shadow-sm cursor-pointer">
              <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_ROBOT"></span>
              Devolver IA
            </button>
            <button v-if="!isResolved" @click="closeConversation"
              class="px-3 py-2 text-xs font-bold text-text-muted hover:text-coral hover:bg-coral/5 rounded-xl transition-colors cursor-pointer">
              Cerrar
            </button>
          </div>
        </header>

        <div id="chat-messages" class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
            <div class="text-center">
              <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CHAT"></span>
              <p class="text-sm font-bold text-text-muted">Sin mensajes aún</p>
              <p class="text-[10px] text-text-muted mt-1">Esperando primer mensaje del huésped...</p>
            </div>
          </div>
          <div v-for="msg in messages" :key="msg.id"
            :class="['flex gap-2.5', msg.sender === 'guest' ? 'justify-end' : '']">
            <div v-if="msg.sender !== 'guest'"
              :class="['w-7 h-7 rounded-lg shrink-0 flex items-center justify-center p-1.5',
                msg.sender === 'bot' ? 'bg-success/10 text-success' : 'bg-purple/10 text-purple']">
              <span class="w-full h-full" v-html="msg.sender === 'bot' ? ICON_ROBOT : ICON_USER"></span>
            </div>
            <div :class="['max-w-[70%]', msg.sender === 'guest' ? 'items-end' : '']">
              <div class="flex items-center gap-2 mb-0.5" :class="msg.sender === 'guest' ? 'justify-end' : ''">
                <span class="text-[10px] font-extrabold"
                  :class="msg.sender === 'guest' ? 'text-text-muted' : msg.sender === 'bot' ? 'text-success' : 'text-purple'">
                  {{ msg.sender === 'guest' ? currentConv?.guestName || 'Guest' : msg.sender === 'bot' ? 'Sofía · IA' : 'Agente' }}
                </span>
                <span v-if="msg.intentDetected" class="text-[9px] bg-surface px-1.5 py-0.5 rounded-full text-text-muted font-bold">{{ msg.intentDetected }}</span>
                <span v-if="msg.confidence !== undefined && msg.sender === 'bot'" class="text-[9px] font-bold" :class="msg.confidence >= 0.65 ? 'text-success' : 'text-text-muted'">
                  {{ (msg.confidence * 100).toFixed(0) }}%
                </span>
              </div>
              <div :class="['px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                msg.sender === 'guest' ? 'bg-white border border-border text-navy rounded-br-sm shadow-sm' :
                msg.sender === 'bot' ? 'bg-success/5 text-navy rounded-bl-sm border border-success/15' :
                'bg-purple/5 text-navy rounded-bl-sm border border-purple/15']" v-html="msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')" />
            </div>
            <div v-if="msg.sender === 'guest'"
              class="w-7 h-7 rounded-lg shrink-0 bg-navy/5 flex items-center justify-center text-[11px] text-text-secondary font-extrabold">
              {{ currentConv?.guestName?.charAt(0)?.toUpperCase() || 'G' }}
            </div>
          </div>
        </div>

        <footer class="shrink-0 p-4 border-t border-border bg-white">
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input v-model="newMessage" @keyup.enter="sendMessage"
                :placeholder="isAutoMode ? 'La IA está respondiendo automáticamente...' : isWaiting ? 'Esperando que un agente disponible tome la conversación...' : 'Escribe un mensaje...'"
                :disabled="isAutoMode || isWaiting"
                class="w-full px-4 py-2.5 border rounded-xl text-sm font-medium transition-all"
                :class="isAutoMode ? 'bg-surface border-success/30 text-text-muted cursor-not-allowed' : isHumanMode ? 'bg-white border-purple/30 text-navy placeholder-text-muted focus:outline-none focus:border-purple focus:ring-1 focus:ring-purple/20' : 'bg-white border-border text-navy placeholder-text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20'" />
              <div v-if="isAutoMode" class="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5">
                <span class="w-1 h-1 bg-success rounded-full animate-bounce [animation-delay:0ms] opacity-60" />
                <span class="w-1 h-1 bg-success rounded-full animate-bounce [animation-delay:150ms] opacity-60" />
                <span class="w-1 h-1 bg-success rounded-full animate-bounce [animation-delay:300ms] opacity-60" />
              </div>
            </div>
            <button @click="sendMessage" :disabled="isAutoMode || isWaiting || !newMessage.trim()"
              class="px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              :class="isHumanMode ? 'bg-purple hover:bg-purple-light text-white' : 'bg-navy hover:bg-navy-light text-white'">
              Enviar
            </button>
          </div>
          <p v-if="isAutoMode" class="text-[10px] text-text-muted text-center mt-2 font-medium">Click en <span class="text-purple font-bold">"Tomar yo"</span> para responder manualmente</p>
        </footer>
      </template>

      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="w-20 h-20 bg-gradient-to-br from-cyan/10 to-teal/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <span class="w-10 h-10 text-cyan" v-html="ICON_ROBOT"></span>
          </div>
          <h2 class="text-xl font-extrabold text-navy mb-2">Recepcionista IA</h2>
          <p class="text-sm text-text-secondary max-w-xs mx-auto leading-relaxed">
            Selecciona una conversación de la lista.<br/>
            <span class="text-success font-bold">Verde</span> = La IA responde ·
            <span class="text-purple font-bold">Púrpura</span> = Agente humano
          </p>
          <div class="mt-6 flex justify-center gap-4 text-[11px] text-text-muted">
            <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-success" /> Bot activo</div>
            <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple" /> Con agente</div>
            <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-warning" /> En espera</div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
