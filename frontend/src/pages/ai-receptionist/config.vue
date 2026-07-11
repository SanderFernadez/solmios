<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AiReceptionistService } from '@/services/AiReceptionist.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import QrcodeVue from 'qrcode.vue'

const ICON_ROBOT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5.5v2M5 10.5h14a1 1 0 0 1 1 1v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a1 1 0 0 1 1-1Z"/><circle cx="9" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none"/></svg>'
const ICON_PHONE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a1.5 1.5 0 0 0 1.5-1.5v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5a2.25 2.25 0 0 0-2.25 2.25Z"/></svg>'
const ICON_SPARKLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>'
const ICON_TARGET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 1.5 1.5 3.75-3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_PAUSE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M6.75 5.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V5.25Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>'
const ICON_SAVE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C5.28 3 6.12 3 7.8 3h6.982c.478 0 .717 0 .942.055.2.049.39.129.564.237.197.122.367.292.706.632l2.082 2.082c.34.34.51.51.632.706.108.175.188.365.237.564.055.225.055.464.055.942V16.2c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C17.72 21 16.88 21 15.2 21H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 18.72 3 17.88 3 16.2V7.8Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21v-6.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 .75.75V21M7.5 3v3.75a.75.75 0 0 0 .75.75h6a.75.75 0 0 0 .75-.75V3"/></svg>'

const TAB_ICONS: Record<string, string> = { whatsapp: ICON_PHONE, llm: ICON_SPARKLE, intents: ICON_TARGET, templates: ICON_DOCUMENT }

const auth = useAuthStore()
const toast = useToast()
const hotelId = auth.user?.hotelId || JSON.parse(localStorage.getItem('user') || '{}').hotelId || ''

function getHotelId() {
  if (hotelId) return hotelId
  const u = JSON.parse(localStorage.getItem('user') || '{}')
  return u.hotelId || ''
}

const tab = ref<'whatsapp' | 'llm' | 'intents' | 'templates'>('whatsapp')

// WhatsApp
const wsConfig = ref<any>(null)
const wsStatus = ref({ status: 'disconnected', phone: null as string | null, mode: 'baileys' })
const wsQR = ref<string | null>(null)
const wsLoading = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

// LLM
const llmProvider = ref('deepseek')
const llmModel = ref('deepseek-chat')
const llmApiKey = ref('')
const botName = ref('Sofía')
const businessHoursStart = ref('08:00')
const businessHoursEnd = ref('22:00')

// Intents
const intents = ref<any[]>([])
const saving = ref(false)

function toDataURL(qr: string): string {
  if (qr.startsWith('data:')) return qr
  if (qr.startsWith('http')) return qr
  return qr
}

async function loadConfig() {
  const hid = getHotelId()
  try {
    const cfg = await AiReceptionistService.getWhatsappConfig(hid)
    if (cfg) {
      wsConfig.value = cfg
      llmProvider.value = cfg.llmProvider || 'deepseek'
      llmModel.value = cfg.llmModel || 'deepseek-chat'
      llmApiKey.value = cfg.accessToken || ''
      botName.value = cfg.botName || 'Sofía'
      businessHoursStart.value = cfg.businessHoursStart || '08:00'
      businessHoursEnd.value = cfg.businessHoursEnd || '22:00'
    }
  } catch {}
  try {
    if (!hid) return
    const status = await AiReceptionistService.getWhatsappStatus(hid)
    wsStatus.value = status
    // Fetch QR if session is in qr_pending state
    if (status.status === 'qr_pending') {
      const qrRes = await AiReceptionistService.getWhatsappQR(hid)
      if (qrRes?.qr) wsQR.value = qrRes.qr
    } else {
      wsQR.value = null
    }
  } catch {}
}

async function saveLLMConfig() {
  saving.value = true
  try {
    await AiReceptionistService.updateWhatsappConfig({
      llmProvider: llmProvider.value, llmModel: llmModel.value,
      botName: botName.value,
      businessHoursStart: businessHoursStart.value,
      businessHoursEnd: businessHoursEnd.value,
    } as any)
    toast.success('Configuración guardada')
  } finally { saving.value = false }
}

async function startWhatsapp() {
  const hid = getHotelId()
  if (!hid) { toast.error('No se detectó el hotel', 'Recargá la página'); return }
  wsLoading.value = true
  try {
    const res = await AiReceptionistService.startWhatsappSession(hid)
    if (res.qr) wsQR.value = toDataURL(res.qr)
    // Fetch status separately — don't let loadConfig errors block the flow
    try {
      const status = await AiReceptionistService.getWhatsappStatus(hid)
      wsStatus.value = status
      if (status.status === 'qr_pending') {
        const qrRes = await AiReceptionistService.getWhatsappQR(hid)
        if (qrRes?.qr) wsQR.value = qrRes.qr
      }
    } catch {}
    startPolling()
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message : 'Sin respuesta del servidor'
    const friendly = msg.includes('HTML') || msg.includes('<!')
      ? 'El backend no respondió JSON. Verificá que esté corriendo: cd backend && bun run dev'
      : msg
    toast.error('Error al conectar', friendly)
  } finally { wsLoading.value = false }
}

async function stopWhatsapp() {
  stopPolling()
  try { await AiReceptionistService.stopWhatsappSession(getHotelId()) } catch {}
  wsQR.value = null
  await loadConfig()
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    const hid = getHotelId()
    if (!hid) return
    try {
      const status = await AiReceptionistService.getWhatsappStatus(hid)
      wsStatus.value = status
      if (status.status === 'qr_pending') {
        const qrRes = await AiReceptionistService.getWhatsappQR(hid)
        if (qrRes?.qr) wsQR.value = toDataURL(qrRes.qr)
      } else if (status.status === 'connected') {
        wsQR.value = null
        stopPolling()
      }
    } catch {}
  }, 3000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function loadIntents() {
  try { const res = await AiReceptionistService.listIntents(); intents.value = res.data || [] } catch {}
}

async function toggleIntentActive(intent: any) {
  await AiReceptionistService.updateIntent(intent.id, { isActive: intent.isActive ? 0 : 1 })
  await loadIntents()
}

const providers = [
  { value: 'deepseek', label: 'DeepSeek (recomendado, más barato)' },
  { value: 'zai', label: 'Z.AI GLM' },
  { value: 'openai', label: 'OpenAI GPT-4o' },
  { value: 'ollama', label: 'Ollama (local, gratis)' },
]

onMounted(() => { loadConfig(); loadIntents(); startPolling() })
onBeforeUnmount(() => { stopPolling() })
</script>

<template>
  <div class="h-full bg-surface overflow-y-auto">
    <div class="max-w-4xl mx-auto p-6">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-cyan to-teal rounded-xl flex items-center justify-center shadow-sm text-white">
            <span class="w-5 h-5 shrink-0" v-html="ICON_ROBOT"></span>
          </div>
          <div>
            <h1 class="text-xl font-black text-navy">Configuración de la Recepcionista IA</h1>
            <p class="text-xs text-text-muted mt-0.5">Personalizá el comportamiento de tu recepcionista virtual</p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button v-for="t in [{k:'whatsapp',l:'WhatsApp'},{k:'llm',l:'Modelo IA'},{k:'intents',l:'Intenciones'},{k:'templates',l:'Plantillas'}]" :key="t.k"
          @click="tab = t.k as any"
          class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
          :class="tab === t.k ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
          <span class="w-4 h-4 shrink-0" v-html="TAB_ICONS[t.k]"></span> {{ t.l }}
        </button>
      </div>

      <!-- WhatsApp Tab -->
      <div v-if="tab === 'whatsapp'">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h2 class="text-lg font-black text-navy mb-1">Conectar WhatsApp</h2>
          <p class="text-sm text-text-muted mb-6">Escaneá el código QR con tu WhatsApp del celular. No perdés el número, ambos ven los mensajes.</p>

          <div class="flex items-center gap-3 pb-6 border-b border-border mb-6">
            <div :class="['w-10 h-10 rounded-full flex items-center justify-center p-2 shrink-0',
              wsStatus.status === 'connected' ? 'bg-success/10 text-success' : wsStatus.status === 'qr_pending' ? 'bg-warning/10 text-warning' : 'bg-surface text-text-muted']">
              <span class="w-full h-full" v-html="wsStatus.status === 'connected' ? ICON_CHECK_CIRCLE : wsStatus.status === 'qr_pending' ? ICON_PHONE : ICON_PAUSE"></span>
            </div>
            <div>
              <p class="text-sm font-bold text-navy">
                {{ wsStatus.status === 'connected' ? `Conectado como ${wsStatus.phone}` : wsStatus.status === 'qr_pending' ? 'Esperando escanear QR...' : 'Desconectado' }}
              </p>
              <p class="text-[11px] text-text-muted mt-0.5">{{ wsStatus.status === 'connected' ? 'El bot está respondiendo automáticamente' : 'Conectá para empezar' }}</p>
            </div>
          </div>

          <div v-if="wsQR && wsStatus.status === 'qr_pending'" class="mb-6">
            <div class="border border-border rounded-xl p-3 inline-block">
              <p class="text-xs font-bold text-navy text-center mb-2">Escaneá este código con WhatsApp</p>
              <QrcodeVue :value="wsQR" :size="192" level="M" render-as="svg" class="rounded-lg" />
            </div>
            <p class="text-[10px] text-text-muted mt-2">Abrí WhatsApp en tu celular → Ajustes → Dispositivos vinculados → Escanear código</p>
          </div>

          <div class="flex items-center gap-4">
            <button @click="startWhatsapp" :disabled="wsLoading"
              class="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-extrabold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              :class="wsStatus.status === 'connected' ? 'bg-navy hover:bg-navy-light text-white' : 'bg-teal hover:bg-teal-light text-white'">
              <span class="w-4 h-4 shrink-0" v-html="wsLoading ? ICON_CLOCK : wsStatus.status === 'disconnected' ? ICON_PHONE : ICON_REFRESH"></span>
              {{ wsLoading ? 'Conectando...' : wsStatus.status === 'disconnected' ? 'Conectar WhatsApp' : 'Reconectar' }}
            </button>
            <button v-if="wsStatus.status === 'connected'" @click="stopWhatsapp"
              class="text-sm font-bold text-coral hover:text-navy transition-colors cursor-pointer">
              Desconectar
            </button>
          </div>
        </div>
      </div>

      <!-- LLM Tab -->
      <div v-if="tab === 'llm'">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
          <h2 class="text-lg font-black text-navy mb-1">Cerebro de la IA</h2>
          <p class="text-sm text-text-muted mb-6">Elegí qué modelo de inteligencia artificial usa tu recepcionista. DeepSeek cuesta ~$1.60/mes por hotel.</p>

          <div class="grid grid-cols-2 gap-5">
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Proveedor</label>
              <select v-model="llmProvider"
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy bg-white cursor-pointer focus:outline-none focus:border-navy">
                <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Modelo</label>
              <input v-model="llmModel" placeholder="deepseek-chat"
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">API Key</label>
              <input v-model="llmApiKey" type="password" placeholder="sk-..."
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Nombre del Bot</label>
              <input v-model="botName" placeholder="Sofía"
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Horario Inicio</label>
              <input v-model="businessHoursStart" type="time"
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Horario Fin</label>
              <input v-model="businessHoursEnd" type="time"
                class="w-full px-4 py-2.5 border border-border rounded-xl text-sm text-navy focus:outline-none focus:border-navy" />
            </div>
          </div>
          <button @click="saveLLMConfig" :disabled="saving"
            class="flex items-center gap-1.5 mt-6 rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_SAVE"></span>
            {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
          </button>
        </div>
      </div>

      <!-- Intents Tab -->
      <div v-if="tab === 'intents'">
        <div class="mb-4">
          <h2 class="text-lg font-black text-navy">Intenciones ({{ intents.length }})</h2>
          <p class="text-[11px] text-text-muted mt-0.5">Activá o desactivá las respuestas automáticas que usa tu recepcionista IA.</p>
        </div>

        <!-- Intent List -->
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) px-5">
          <div v-for="intent in intents" :key="intent.id"
            class="py-4 border-b border-border last:border-0 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-purple/10 text-purple">Sistema</span>
                <span class="text-sm font-bold text-navy">{{ intent.name }}</span>
                <span class="text-[10px] text-text-muted">{{ intent.category }}</span>
              </div>
              <p class="text-[11px] text-text-muted truncate max-w-lg">{{ intent.responseTemplate?.substring(0, 80) }}...</p>
            </div>
            <button @click="toggleIntentActive(intent)"
              :class="['relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0', intent.isActive ? 'bg-success' : 'bg-border']">
              <span :class="['inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm', intent.isActive ? 'translate-x-6' : 'translate-x-1']" />
            </button>
          </div>
        </div>
      </div>

      <!-- Templates Tab (placeholder) -->
      <div v-if="tab === 'templates'">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
          <h3 class="text-lg font-black text-navy mb-1">Plantillas de Respuesta</h3>
          <p class="text-sm text-text-muted max-w-sm mx-auto">Mensajes predefinidos para check-in, check-out, bienvenida, fuera de horario y más. Próximamente.</p>
        </div>
      </div>
    </div>
  </div>
</template>
