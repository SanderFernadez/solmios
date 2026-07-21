<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between gap-3 mb-6">
      <div class="flex items-center gap-2.5">
        <h2 class="text-xl font-black text-navy">Chats del equipo</h2>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
          </span>
          En vivo
        </span>
      </div>
      <button
        @click="load"
        :disabled="loading"
        class="flex items-center gap-1.5 bg-white text-text-secondary border border-border font-bold text-sm px-4 py-2 rounded-full hover:border-navy/30 hover:text-navy transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="w-4 h-4 shrink-0" :class="loading ? 'animate-spin' : ''" v-html="ICON_REFRESH"></span>
        Refrescar
      </button>
    </div>

    <!-- Layout dos columnas -->
    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <!-- Lista de conversaciones -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-220px)]">
        <div class="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <span class="text-[11px] font-bold text-text-muted uppercase tracking-wide">Conversaciones</span>
          <span class="bg-surface px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted border border-border">{{ conversations.length }}</span>
        </div>

        <!-- Loading -->
        <div v-if="loading && conversations.length === 0" class="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
          <span class="w-4 h-4 animate-spin" v-html="ICON_REFRESH"></span>
          Cargando...
        </div>

        <!-- Empty -->
        <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center py-16 px-6 text-center">
          <span class="w-10 h-10 mb-3 text-text-muted opacity-40" v-html="ICON_CHAT"></span>
          <p class="text-sm font-bold text-navy">Todavía no hay conversaciones</p>
          <p class="text-xs text-text-muted mt-1">Cuando el equipo se escriba, vas a verlo acá.</p>
        </div>

        <!-- Lista -->
        <div v-else class="overflow-y-auto flex-1">
          <button
            v-for="conv in conversations"
            :key="conv.key"
            @click="selectedKey = conv.key"
            class="w-full text-left px-4 py-3 border-b border-border last:border-0 flex items-start gap-3 transition-colors cursor-pointer"
            :class="selectedKey === conv.key ? 'bg-navy/5' : 'hover:bg-surface/60'"
          >
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
              :class="conv.isTeam ? 'bg-cyan' : avatarColor(conv.key)"
            >
              <span v-if="conv.isTeam" class="w-5 h-5" v-html="ICON_TEAM"></span>
              <span v-else>{{ conv.initials }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-bold text-navy truncate">{{ conv.title }}</span>
                <span class="text-[10px] text-text-muted shrink-0">{{ formatTime(conv.lastMessage.createdAt) }}</span>
              </div>
              <p class="text-xs text-text-secondary truncate mt-0.5">
                <span class="font-semibold text-text-muted">{{ senderName(conv.lastMessage.fromUserId) }}:</span>
                {{ preview(conv.lastMessage) }}
              </p>
            </div>
          </button>
          <!-- Sentinel: al entrar en viewport dispara la carga de la página anterior -->
          <div v-if="hasMore || loadingMore" ref="sentinel" class="py-3 flex items-center justify-center gap-2 text-[11px] text-text-muted">
            <span v-if="loadingMore" class="w-3 h-3 animate-spin" v-html="ICON_REFRESH"></span>
            {{ loadingMore ? 'Cargando más…' : 'Deslizá para ver mensajes anteriores' }}
          </div>
        </div>
      </div>

      <!-- Hilo -->
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-220px)] min-h-[400px]">
        <!-- Sin selección -->
        <div v-if="!selectedConversation" class="flex flex-col items-center justify-center flex-1 px-6 text-center">
          <span class="w-12 h-12 mb-3 text-text-muted opacity-30" v-html="ICON_CHAT"></span>
          <p class="text-sm font-bold text-navy">Elegí una conversación</p>
          <p class="text-xs text-text-muted mt-1">Seleccioná un chat de la izquierda para ver los mensajes.</p>
        </div>

        <template v-else>
          <!-- Header del hilo -->
          <div class="px-5 py-3.5 border-b border-border shrink-0 flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
              :class="selectedConversation.isTeam ? 'bg-cyan' : avatarColor(selectedConversation.key)"
            >
              <span v-if="selectedConversation.isTeam" class="w-[18px] h-[18px]" v-html="ICON_TEAM"></span>
              <span v-else>{{ selectedConversation.initials }}</span>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-black text-navy truncate">{{ selectedConversation.title }}</div>
              <div class="text-[11px] text-text-muted">{{ selectedConversation.messages.length }} mensaje{{ selectedConversation.messages.length === 1 ? '' : 's' }}</div>
            </div>
          </div>

          <!-- Mensajes -->
          <div class="overflow-y-auto flex-1 px-5 py-5 bg-surface/40 space-y-4">
            <div v-for="msg in selectedConversation.messages" :key="msg.id" class="flex items-start gap-2.5">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold mt-0.5"
                :class="avatarColor(msg.fromUserId)"
              >
                {{ initialsOf(senderName(msg.fromUserId)) }}
              </div>
              <div class="min-w-0 max-w-[80%]">
                <div class="flex items-baseline gap-2 mb-1">
                  <span class="text-xs font-bold text-navy">{{ senderName(msg.fromUserId) }}</span>
                  <span class="text-[10px] text-text-muted">{{ formatTime(msg.createdAt) }}</span>
                </div>
                <div class="bg-white border border-border rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-(--shadow-card)">
                  <img
                    v-if="msg.photoUrl"
                    :src="msg.photoUrl"
                    alt="Foto"
                    class="max-w-[220px] w-full rounded-xl border border-border mb-1.5 last:mb-0"
                  >
                  <p v-if="msg.message" class="text-sm text-text-secondary whitespace-pre-wrap break-words">{{ msg.message }}</p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { TeamChatService, type MessageDTO } from '@/services/TeamChat.service'
import { TeamService } from '@/services/Team.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>'
const ICON_TEAM = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.7"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4 0m8-4a3 3 0 11-2.5 1.34M7 8a3 3 0 10-2.5 1.34"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const PAGE_SIZE = 200
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const loadedCount = ref(0)
const messages = ref<MessageDTO[]>([])
const userNames = ref<Map<string, string>>(new Map())
const selectedKey = ref<string | null>(null)
// Sentinel al fondo de la lista: cuando entra en viewport, se autocarga la
// siguiente página de mensajes más viejos (scroll infinito).
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const TEAM_KEY = 'team'

interface Conversation {
  key: string
  isTeam: boolean
  title: string
  initials: string
  messages: MessageDTO[]
  lastMessage: MessageDTO
}

function senderName(userId: string): string {
  return userNames.value.get(userId) || 'Usuario'
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'
}

const AVATAR_COLORS = ['bg-navy', 'bg-purple', 'bg-teal', 'bg-coral', 'bg-gold', 'bg-blue']
function avatarColor(seed: string): string {
  const idx = (seed || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function preview(msg: MessageDTO): string {
  if (msg.message) return msg.message
  if (msg.photoUrl) return '📷 Foto'
  return ''
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hhmm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return hhmm
  return `${d.getDate()}/${d.getMonth() + 1} ${hhmm}`
}

const conversations = computed<Conversation[]>(() => {
  const groups = new Map<string, MessageDTO[]>()
  for (const msg of messages.value) {
    const key = (msg.toUserId || '').startsWith('team:')
      ? TEAM_KEY
      : [msg.fromUserId, msg.toUserId].sort().join('|')
    const list = groups.get(key)
    if (list) list.push(msg)
    else groups.set(key, [msg])
  }

  const result: Conversation[] = []
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const lastMessage = sorted[sorted.length - 1]
    const isTeam = key === TEAM_KEY
    let title: string
    let initials: string
    if (isTeam) {
      title = 'Equipo del hotel'
      initials = ''
    } else {
      const [a, b] = key.split('|')
      const nameA = senderName(a)
      const nameB = senderName(b)
      title = `${nameA} y ${nameB}`
      initials = initialsOf(nameA)
    }
    result.push({ key, isTeam, title, initials, messages: sorted, lastMessage })
  }

  result.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime())
  return result
})

const selectedConversation = computed<Conversation | null>(() =>
  conversations.value.find(c => c.key === selectedKey.value) ?? null,
)

async function loadNames() {
  try {
    // Los que chatean son USUARIOS del hotel (tabla users), no perfiles de RRHH:
    // `/usuarios` devuelve id → name y esos ids son los que traen los mensajes.
    // (employee-profiles es otra cosa y sus ids no coinciden con los del chat.)
    const res = await TeamService.list()
    const list = Array.isArray(res) ? res : (res?.data ?? [])
    const map = new Map<string, string>()
    for (const u of list) {
      if (u.id && u.name) map.set(u.id, u.name)
    }
    userNames.value = map
  } catch {
    /* silent — sin nombres, se muestra "Usuario" */
  }
}

async function load() {
  loading.value = true
  try {
    const [page] = await Promise.all([TeamChatService.listAll(0, PAGE_SIZE), loadNames()])
    messages.value = page.data
    loadedCount.value = page.data.length
    hasMore.value = page.hasMore
  } catch {
    toast.error('No se pudieron cargar los chats del equipo')
    messages.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

/** Trae la siguiente página de mensajes más viejos y los suma sin duplicar. */
async function loadMore() {
  if (loadingMore.value || loading.value || !hasMore.value) return
  loadingMore.value = true
  try {
    const page = await TeamChatService.listAll(loadedCount.value, PAGE_SIZE)
    const seen = new Set(messages.value.map((m) => m.id))
    const fresh = page.data.filter((m) => !seen.has(m.id))
    messages.value = [...messages.value, ...fresh]
    loadedCount.value += page.data.length
    hasMore.value = page.hasMore
  } catch {
    /* se reintenta al próximo scroll: hasMore queda como estaba */
  } finally {
    loadingMore.value = false
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => { if (entries[0]?.isIntersecting) loadMore() },
    { rootMargin: '150px' },
  )
  load()
})

// El sentinel aparece/desaparece con `hasMore`: re-observar cuando se monta.
watch(sentinel, (el) => {
  observer?.disconnect()
  if (el && observer) observer.observe(el)
})

onUnmounted(() => observer?.disconnect())
</script>
