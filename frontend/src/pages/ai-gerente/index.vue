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
      <SectionCard class="lg:col-span-2 flex flex-col" style="height: 70vh"
        title="Conversación"
        :subtitle="thread.length ? `${thread.length} consulta(s) en esta sesión` : 'Respuestas generadas con datos del hotel'"
        body-class="flex-1 min-h-0 flex flex-col p-0">
        <template #actions>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            <span class="block h-3.5 w-3.5" v-html="ICON_SPARKLES"></span>
            Gerente IA
          </span>
        </template>

        <div ref="scrollEl" class="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <EmptyState v-if="!thread.length && !asking" :icon="ICON_SPARKLES"
            title="Hacé tu primera pregunta"
            message="Ej: «¿Cuál fue la ocupación de esta semana?» o «¿Qué habitaciones se liberan mañana?»">
            <template #action>
              <div class="flex flex-wrap justify-center gap-2">
                <button v-for="s in suggestions" :key="s" @click="draft = s; send()"
                  class="rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-bold text-navy transition-colors hover:bg-navy hover:text-white cursor-pointer">
                  {{ s }}
                </button>
              </div>
            </template>
          </EmptyState>

          <template v-for="msg in thread" :key="msg.id">
            <!-- Pregunta del usuario -->
            <div class="flex justify-end">
              <div class="max-w-[80%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm text-white">
                {{ msg.query }}
              </div>
            </div>
            <!-- Respuesta -->
            <div class="flex justify-start">
              <div class="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
                <p class="whitespace-pre-wrap text-sm text-navy">{{ msg.response }}</p>
                <div class="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <span v-if="msg.confidence != null"
                    class="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide tabular-nums"
                    :class="confidenceClass(msg.confidence)">
                    Confianza {{ Math.round((msg.confidence || 0) * 100) }}%
                  </span>
                  <span v-if="msg.responseTimeMs != null"
                    class="rounded-full bg-navy/5 px-2 py-0.5 text-[10px] font-bold text-text-muted tabular-nums">
                    {{ msg.responseTimeMs }} ms
                  </span>
                  <span class="ml-auto flex items-center gap-1">
                    <button type="button" @click="rate(msg, 'helpful')" title="Útil"
                      class="grid h-8 w-8 place-items-center rounded-full text-sm transition-colors cursor-pointer"
                      :class="msg.feedback === 'helpful' ? 'bg-teal/10 text-teal' : 'hover:bg-navy/10'">👍</button>
                    <button type="button" @click="rate(msg, 'not_helpful')" title="No útil"
                      class="grid h-8 w-8 place-items-center rounded-full text-sm transition-colors cursor-pointer"
                      :class="msg.feedback === 'not_helpful' ? 'bg-coral/10 text-coral' : 'hover:bg-navy/10'">👎</button>
                    <button type="button" @click="rate(msg, 'inaccurate')" title="Impreciso"
                      class="grid h-8 w-8 place-items-center rounded-full text-sm transition-colors cursor-pointer"
                      :class="msg.feedback === 'inaccurate' ? 'bg-gold/10 text-gold' : 'hover:bg-navy/10'">⚠️</button>
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- Skeleton mientras el análisis carga -->
          <div v-if="asking" class="flex justify-start">
            <div class="w-[85%] space-y-2 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
              <div class="h-3 w-11/12 animate-pulse rounded bg-navy/10"></div>
              <div class="h-3 w-9/12 animate-pulse rounded bg-navy/10"></div>
              <div class="h-3 w-6/12 animate-pulse rounded bg-navy/10"></div>
              <p class="pt-1 text-[10px] font-bold uppercase tracking-wide text-text-muted">Analizando datos del hotel…</p>
            </div>
          </div>
        </div>

        <!-- Input -->
        <form @submit.prevent="send" class="flex items-end gap-2 border-t border-border bg-white p-3">
          <textarea v-model="draft" rows="1" placeholder="Escribí tu pregunta…"
            @keydown.enter.exact.prevent="send"
            class="flex-1 resize-none rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"></textarea>
          <button type="submit" :disabled="asking || !draft.trim()"
            class="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-navy-light disabled:opacity-40 cursor-pointer">
            Enviar
          </button>
        </form>
      </SectionCard>

      <!-- Historial -->
      <SectionCard class="flex flex-col" style="height: 70vh"
        title="Historial de consultas"
        :subtitle="history.length ? `${history.length} consulta(s) guardada(s)` : undefined"
        body-class="flex-1 min-h-0 overflow-y-auto p-3">
        <div v-if="loadingHistory" class="space-y-2">
          <div v-for="n in 5" :key="n" class="rounded-xl bg-surface px-3 py-2.5">
            <div class="h-3 w-10/12 animate-pulse rounded bg-navy/10"></div>
            <div class="mt-2 h-2.5 w-4/12 animate-pulse rounded bg-navy/10"></div>
          </div>
        </div>

        <EmptyState v-else-if="!history.length" :icon="ICON_CLOCK"
          title="Sin consultas todavía"
          message="Cuando le preguntes algo al gerente IA, la consulta queda acá para retomarla." />

        <div v-else class="space-y-2">
          <button v-for="h in history" :key="h.id" type="button" @click="restore(h)"
            class="w-full rounded-xl border border-transparent bg-surface px-3 py-2.5 text-left transition-colors hover:border-navy/20 hover:bg-surface-dark cursor-pointer">
            <p class="line-clamp-2 text-xs font-semibold text-navy">{{ h.query }}</p>
            <p v-if="formatDate(h.createdAt)" class="mt-1 text-[11px] text-text-muted tabular-nums">{{ formatDate(h.createdAt) }}</p>
          </button>
        </div>
      </SectionCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { AiGerenteService, type AiInteraction, type AiFeedback } from '@/services/AiGerente.service'
import { useToast } from '@/composables/useToast'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const toast = useToast()

const ICON_SPARKLES = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'

/** Badge de confianza: teal ok · gold atención · coral crítico */
function confidenceClass(confidence?: number | null): string {
  const pct = (confidence ?? 0) * 100
  if (pct >= 80) return 'bg-teal/10 text-teal'
  if (pct >= 50) return 'bg-gold/10 text-gold'
  return 'bg-coral/10 text-coral'
}

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
