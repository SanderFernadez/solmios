<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Opiniones</h2>
        <p class="text-xs text-text-muted mt-0.5">Gestión de reseñas de huéspedes</p>
      </div>
      <button @click="requestReviews" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_MAIL"></span>
        Solicitar Reseñas
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_CHAT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">{{ reviews.length }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total Reseñas</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_STAR"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-gold truncate">{{ avgRating }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Calificación Promedio</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_REPLY"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-cyan truncate">{{ respondedCount }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Con Respuesta</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_CHECK_CIRCLE"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal truncate">{{ responseRate }}%</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Tasa de Respuesta</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Config bar -->
    <div class="card p-4 mb-6 flex items-center flex-wrap gap-x-8 gap-y-3">
      <div class="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase shrink-0">
        <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_SETTINGS"></span>
        Configuración
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <span class="relative inline-flex items-center cursor-pointer">
          <input v-model="config.requestReviews" type="checkbox" class="sr-only peer" @change="saveConfig" />
          <span class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal"></span>
        </span>
        <span class="text-xs text-navy font-bold">Solicitar reseñas</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <span class="relative inline-flex items-center cursor-pointer">
          <input v-model="config.publishScore" type="checkbox" class="sr-only peer" @change="saveConfig" />
          <span class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal"></span>
        </span>
        <span class="text-xs text-navy font-bold">Publicar puntuación</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <span class="relative inline-flex items-center cursor-pointer">
          <input v-model="config.publishComments" type="checkbox" class="sr-only peer" @change="saveConfig" />
          <span class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal"></span>
        </span>
        <span class="text-xs text-navy font-bold">Publicar comentarios</span>
      </label>
    </div>

    <!-- Reviews List -->
    <div class="space-y-4">
      <div v-if="reviews.length === 0" class="card p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CHAT"></span>
        <h3 class="font-bold text-navy mb-1">Sin opiniones aún</h3>
        <p class="text-xs text-text-muted">Las reseñas de huéspedes aparecerán acá.</p>
      </div>
      <div v-for="r in reviews" :key="r.id" class="card p-5">
        <div class="flex items-start justify-between mb-2 flex-wrap gap-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg font-black text-gold">{{ '★'.repeat(r.rating || 0) }}{{ '☆'.repeat(5 - (r.rating || 0)) }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="channelBadge(r.channel)">{{ r.channel || 'Directa' }}</span>
            </div>
            <div class="text-sm font-bold text-navy mt-1">{{ r.guestName || 'Anónimo' }}</div>
            <div class="text-[10px] text-text-muted">{{ r.createdAt?.slice(0,10) || '' }}</div>
          </div>
          <button @click="openRespond(r)" class="flex items-center gap-1 px-3 py-1.5 bg-navy/5 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/10">
            <span class="w-3 h-3 shrink-0" v-html="ICON_REPLY"></span>
            {{ r.response ? 'Editar respuesta' : 'Responder' }}
          </button>
        </div>
        <p class="text-sm text-text-secondary mt-2">{{ r.comment || r.title || '' }}</p>
        <div v-if="r.response" class="mt-3 bg-cyan/5 rounded-xl p-3 text-sm italic text-navy border border-cyan/20">
          <span class="text-[10px] font-bold text-cyan block mb-1">Respuesta del hotel:</span>
          {{ r.response }}
        </div>
      </div>
    </div>

    <!-- Respond Modal -->
    <Teleport to="body">
      <div v-if="respondModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0" v-html="ICON_REPLY"></span>
              Responder a {{ respondModal.guest }}
            </h3>
            <button @click="respondModal.show=false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="bg-surface rounded-xl p-3 mb-4 text-sm text-text-secondary">"{{ respondModal.comment }}"</div>
          <textarea v-model="respondModal.text" rows="4" placeholder="Escribe tu respuesta..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm resize-none focus:outline-none focus:border-navy"></textarea>
          <div class="flex gap-3 mt-6">
            <button @click="respondModal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="saveResponse" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">Publicar Respuesta</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OpinionesService } from '@/services/Opiniones.service'
import { ConfigService } from '@/services/Platform.service'
import { useToast } from '@/composables/useToast'

const ICON_MAIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v10.5a1.5 1.5 0 0 1-1.5 1.5H3.75a1.5 1.5 0 0 1-1.5-1.5V6.75Zm0 0 9.75 6.75 9.75-6.75"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 21.44a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>'
const ICON_SETTINGS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.752.43.992l1.005.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.216.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.752-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_REPLY = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17 4 12m0 0 5-5m-5 5h11a4 4 0 0 1 4 4v1"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 1.5 1.5 3.75-3.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'

const toast = useToast()
const reviews = ref<any[]>([])
const config = ref({ requestReviews: true, publishScore: true, publishComments: true })

const avgRating = computed(() => {
  if (!reviews.value.length) return '0'
  return (reviews.value.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.value.length).toFixed(1)
})

const respondedCount = computed(() => reviews.value.filter((r: any) => r.response).length)
const responseRate = computed(() => (reviews.value.length ? Math.round((respondedCount.value / reviews.value.length) * 100) : 0))

const respondModal = ref({ show: false, id: '', guest: '', comment: '', text: '' })

function channelBadge(c: string) {
  const m: any = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral' }
  return m[c?.toLowerCase()] || 'bg-gray-100 text-gray-500'
}

async function load() {
  try {
    const r = await OpinionesService.list()
    reviews.value = Array.isArray(r) ? r : []
  } catch { reviews.value = [] }
  try {
    const c = await ConfigService.get('opiniones_config')
    if (c) config.value = typeof c === 'string' ? JSON.parse(c) : c
  } catch {}
}

function openRespond(r: any) {
  respondModal.value = { show: true, id: r.id, guest: r.guestName || 'Anónimo', comment: r.comment || '', text: r.response || '' }
}

async function saveResponse() {
  try {
    await OpinionesService.respond(respondModal.value.id, respondModal.value.text)
    const rev = reviews.value.find(r => r.id === respondModal.value.id)
    if (rev) rev.response = respondModal.value.text
    toast.success('Respuesta publicada')
    respondModal.value.show = false
  } catch { toast.error('Error') }
}

async function saveConfig() {
  try { await ConfigService.set('opiniones_config', JSON.stringify(config.value)) } catch {}
}

function requestReviews() {
  toast.info('Solicitud enviada — los huéspedes recibirán un email para dejar su opinión')
}

onMounted(load)
</script>
