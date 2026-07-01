<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AiReceptionistService } from '@/services/AiReceptionist.service'
import { useAuthStore } from '@/stores/auth.store'
import QrcodeVue from 'qrcode.vue'

const auth = useAuthStore()
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
    alert('Configuración guardada correctamente')
  } finally { saving.value = false }
}

async function startWhatsapp() {
  const hid = getHotelId()
  if (!hid) { alert('Error: No se detectó el hotel. Recargá la página.'); return }
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
    alert('Error al conectar: ' + friendly)
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
        <div class="flex items-center gap-3 mb-1">
          <div class="w-9 h-9 bg-gradient-to-br from-cyan to-teal rounded-xl flex items-center justify-center text-lg shadow-sm">🤖</div>
          <div>
            <h1 class="text-xl font-extrabold text-navy">Configuración de la Recepcionista IA</h1>
            <p class="text-xs text-text-muted font-medium">Personalizá el comportamiento de tu recepcionista virtual</p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mb-6 border-b border-border">
        <button v-for="t in [{k:'whatsapp',l:'WhatsApp',icon:'💬'},{k:'llm',l:'Modelo IA',icon:'🧠'},{k:'intents',l:'Intenciones',icon:'🎯'},{k:'templates',l:'Plantillas',icon:'📝'}]" :key="t.k"
          @click="tab = t.k as any"
          :class="['flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold transition-all -mb-px border-b-2 cursor-pointer', tab === t.k ? 'border-cyan text-cyan' : 'border-transparent text-text-muted hover:text-navy']">
          <span>{{ t.icon }}</span> {{ t.l }}
        </button>
      </div>

      <!-- WhatsApp Tab -->
      <div v-if="tab === 'whatsapp'">
        <div class="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 class="text-lg font-extrabold text-navy mb-1">Conectar WhatsApp</h2>
          <p class="text-sm text-text-muted mb-6">Escaneá el código QR con tu WhatsApp del celular. No perdés el número, ambos ven los mensajes.</p>

          <div class="flex items-center gap-3 mb-6">
            <div :class="['w-10 h-10 rounded-xl flex items-center justify-center text-sm', 
              wsStatus.status === 'connected' ? 'bg-success/10 text-success' : wsStatus.status === 'qr_pending' ? 'bg-warning/10 text-warning' : 'bg-surface text-text-muted']">
              {{ wsStatus.status === 'connected' ? '✅' : wsStatus.status === 'qr_pending' ? '📱' : '⏸️' }}
            </div>
            <div>
              <p class="text-sm font-extrabold text-navy">
                {{ wsStatus.status === 'connected' ? `Conectado como ${wsStatus.phone}` : wsStatus.status === 'qr_pending' ? 'Esperando escanear QR...' : 'Desconectado' }}
              </p>
              <p class="text-[11px] text-text-muted font-medium">{{ wsStatus.status === 'connected' ? 'El bot está respondiendo automáticamente' : 'Conectá para empezar' }}</p>
            </div>
          </div>

          <div v-if="wsQR && wsStatus.status === 'qr_pending'" class="mb-6">
            <div class="bg-white border-2 border-warning/30 rounded-xl p-3 inline-block">
              <p class="text-xs font-bold text-navy text-center mb-2">Escaneá este código con WhatsApp</p>
              <QrcodeVue :value="wsQR" :size="192" level="M" render-as="svg" class="rounded-lg" />
            </div>
            <p class="text-[10px] text-text-muted mt-2 font-medium">Abrí WhatsApp en tu celular → Ajustes → Dispositivos vinculados → Escanear código</p>
          </div>

          <div class="flex gap-2">
            <button @click="startWhatsapp" :disabled="wsLoading"
              class="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              :class="wsStatus.status === 'connected' ? 'bg-navy hover:bg-navy-light text-white' : 'bg-teal hover:bg-teal-light text-white'">
              {{ wsLoading ? '⏳ Conectando...' : wsStatus.status === 'disconnected' ? '📱 Conectar WhatsApp' : '🔄 Reconectar' }}
            </button>
            <button v-if="wsStatus.status === 'connected'" @click="stopWhatsapp"
              class="px-5 py-2.5 rounded-xl text-sm font-extrabold bg-coral/10 text-coral hover:bg-coral/20 transition-all cursor-pointer">
              Desconectar
            </button>
          </div>
        </div>
      </div>

      <!-- LLM Tab -->
      <div v-if="tab === 'llm'">
        <div class="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h2 class="text-lg font-extrabold text-navy mb-1">Cerebro de la IA</h2>
          <p class="text-sm text-text-muted mb-6">Elegí qué modelo de inteligencia artificial usa tu recepcionista. DeepSeek cuesta ~$1.60/mes por hotel.</p>

          <div class="grid grid-cols-2 gap-5">
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">Proveedor</label>
              <select v-model="llmProvider"
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy bg-white focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20">
                <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">Modelo</label>
              <input v-model="llmModel" placeholder="deepseek-chat"
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20" />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">API Key</label>
              <input v-model="llmApiKey" type="password" placeholder="sk-..."
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20" />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">Nombre del Bot</label>
              <input v-model="botName" placeholder="Sofía"
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20" />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">Horario Inicio</label>
              <input v-model="businessHoursStart" type="time"
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20" />
            </div>
            <div>
              <label class="block text-[11px] font-extrabold text-navy mb-1.5 uppercase">Horario Fin</label>
              <input v-model="businessHoursEnd" type="time"
                class="w-full px-3 py-2.5 border border-border rounded-xl text-sm font-medium text-navy focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/20" />
            </div>
          </div>
          <button @click="saveLLMConfig" :disabled="saving"
            class="mt-6 px-5 py-2.5 bg-navy hover:bg-navy-light text-white rounded-xl text-sm font-extrabold transition-all shadow-sm disabled:opacity-50 cursor-pointer">
            {{ saving ? 'Guardando...' : '💾 Guardar Configuración' }}
          </button>
        </div>
      </div>

      <!-- Intents Tab -->
      <div v-if="tab === 'intents'">
        <div class="mb-4">
          <h2 class="text-lg font-extrabold text-navy">Intenciones ({{ intents.length }})</h2>
          <p class="text-[11px] text-text-muted font-medium">Activá o desactivá las respuestas automáticas que usa tu recepcionista IA.</p>
        </div>

        <!-- Intent List -->
        <div class="space-y-2">
          <div v-for="intent in intents" :key="intent.id"
            class="bg-white rounded-xl border border-border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-purple/10 text-purple">Sistema</span>
                <span class="text-sm font-extrabold text-navy">{{ intent.name }}</span>
                <span class="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded-full font-bold">{{ intent.category }}</span>
              </div>
              <p class="text-[11px] text-text-muted font-medium truncate max-w-lg">{{ intent.responseTemplate?.substring(0, 80) }}...</p>
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
        <div class="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
          <div class="text-4xl mb-3">📝</div>
          <h3 class="text-lg font-extrabold text-navy mb-1">Plantillas de Respuesta</h3>
          <p class="text-sm text-text-muted max-w-sm mx-auto">Mensajes predefinidos para check-in, check-out, bienvenida, fuera de horario y más. Próximamente.</p>
        </div>
      </div>
    </div>
  </div>
</template>
