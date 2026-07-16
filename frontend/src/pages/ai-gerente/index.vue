<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Gerente IA</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-sm text-text-muted mt-0.5">Preguntá sobre ocupación, ingresos y operación; el gerente IA responde con datos del hotel</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Chat -->
      <div class="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-border overflow-hidden" style="height: 70vh">
        <div ref="scrollEl" class="flex-1 overflow-y-auto p-5 space-y-4">
          <div v-if="!thread.length" class="h-full flex flex-col items-center justify-center text-center text-text-muted">
            <span class="w-10 h-10 mb-3" v-html="ICON_SPARKLES"></span>
            <p class="text-sm font-semibold text-navy mb-1">Hacé tu primera pregunta</p>
            <p class="text-xs max-w-xs">Ej: «¿Cuál fue la ocupación de esta semana?» o «¿Qué habitaciones se liberan mañana?»</p>
            <div class="flex flex-wrap gap-2 justify-center mt-4">
              <button v-for="s in suggestions" :key="s" @click="draft = s; send()"
                class="text-xs px-3 py-1.5 rounded-full bg-surface hover:bg-navy hover:text-white transition-colors font-semibold">
                {{ s }}
              </button>
            </div>
          </div>

          <template v-for="msg in thread" :key="msg.id">
            <!-- Pregunta del usuario -->
            <div class="flex justify-end">
              <div class="max-w-[80%] rounded-2xl rounded-br-sm bg-navy text-white px-4 py-2.5 text-sm">
                {{ msg.query }}
              </div>
            </div>
            <!-- Respuesta -->
            <div class="flex justify-start">
              <div class="max-w-[85%] rounded-2xl rounded-bl-sm bg-surface px-4 py-2.5">
                <p class="text-sm text-navy whitespace-pre-wrap">{{ msg.response }}</p>
                <div class="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
                  <span v-if="msg.confidence != null">Confianza: {{ Math.round((msg.confidence || 0) * 100) }}%</span>
                  <span v-if="msg.responseTimeMs != null">· {{ msg.responseTimeMs }} ms</span>
                  <span class="ml-auto flex items-center gap-1.5">
                    <button @click="rate(msg, 'helpful')" :class="msg.feedback === 'helpful' ? 'text-[#16A34A]' : 'hover:text-navy'" title="Útil">👍</button>
                    <button @click="rate(msg, 'not_helpful')" :class="msg.feedback === 'not_helpful' ? 'text-[#DC2626]' : 'hover:text-navy'" title="No útil">👎</button>
                    <button @click="rate(msg, 'inaccurate')" :class="msg.feedback === 'inaccurate' ? 'text-[#D97706]' : 'hover:text-navy'" title="Impreciso">⚠️</button>
                  </span>
                </div>
              </div>
            </div>
          </template>

          <div v-if="asking" class="flex justify-start">
            <div class="rounded-2xl rounded-bl-sm bg-surface px-4 py-3">
              <div class="flex gap-1">
                <span class="w-2 h-2 rounded-full bg-navy/40 animate-bounce" style="animation-delay:0ms"></span>
                <span class="w-2 h-2 rounded-full bg-navy/40 animate-bounce" style="animation-delay:150ms"></span>
                <span class="w-2 h-2 rounded-full bg-navy/40 animate-bounce" style="animation-delay:300ms"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Input -->
        <form @submit.prevent="send" class="border-t border-border p-3 flex items-end gap-2">
          <textarea v-model="draft" rows="1" placeholder="Escribí tu pregunta…"
            @keydown.enter.exact.prevent="send"
            class="flex-1 resize-none rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"></textarea>
          <button type="submit" :disabled="asking || !draft.trim()"
            class="rounded-xl bg-navy text-white px-4 py-2.5 text-sm font-bold disabled:opacity-40">
            Enviar
          </button>
        </form>
      </div>

      <!-- Historial -->
      <div class="bg-white rounded-2xl border border-border overflow-hidden flex flex-col" style="height: 70vh">
        <div class="px-4 py-3 border-b border-border">
          <h3 class="font-extrabold text-navy text-sm">Historial de consultas</h3>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div v-if="loadingHistory" class="flex items-center justify-center py-10">
            <div class="w-6 h-6 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
          </div>
          <p v-else-if="!history.length" class="text-xs text-text-muted text-center py-10">Sin consultas todavía</p>
          <button v-for="h in history" :key="h.id" @click="restore(h)"
            class="w-full text-left rounded-xl bg-surface hover:bg-surface/70 px-3 py-2.5 transition-colors">
            <p class="text-xs font-semibold text-navy line-clamp-2">{{ h.query }}</p>
            <p class="text-[11px] text-text-muted mt-1">{{ formatDate(h.createdAt) }}</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { AiGerenteService, type AiInteraction, type AiFeedback } from '@/services/AiGerente.service'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const ICON_SPARKLES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>'

const suggestions = [
  '¿Cuál fue la ocupación de esta semana?',
  '¿Cuánto facturamos este mes?',
  '¿Qué habitaciones se liberan mañana?',
]

const draft = ref('')
const asking = ref(false)
const thread = ref<AiInteraction[]>([])
const history = ref<AiInteraction[]>([])
const loadingHistory = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

async function scrollToBottom() {
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

async function send() {
  const q = draft.value.trim()
  if (!q || asking.value) return
  draft.value = ''
  asking.value = true
  await scrollToBottom()
  try {
    const interaction = await AiGerenteService.ask(q)
    thread.value.push(interaction)
    history.value.unshift(interaction)
    await scrollToBottom()
  } catch {
    toast.error('No se pudo obtener respuesta del gerente IA')
    draft.value = q
  } finally {
    asking.value = false
  }
}

async function rate(msg: AiInteraction, feedback: AiFeedback) {
  const prev = msg.feedback
  msg.feedback = feedback
  try {
    await AiGerenteService.sendFeedback(msg.id, feedback)
    toast.success('Gracias por tu feedback')
  } catch {
    msg.feedback = prev
    toast.error('No se pudo registrar el feedback')
  }
}

function restore(h: AiInteraction) {
  if (!thread.value.some((m) => m.id === h.id)) thread.value.push(h)
  scrollToBottom()
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function loadHistory() {
  loadingHistory.value = true
  try {
    const page = await AiGerenteService.listInteractions({ limit: 30 })
    history.value = page.data
  } catch {
    /* silencioso: el historial es secundario */
  } finally {
    loadingHistory.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
