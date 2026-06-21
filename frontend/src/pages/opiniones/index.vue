<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-black text-navy">Opiniones</h2>
        <p class="text-xs text-text-muted mt-0.5">Gestión de reseñas de huéspedes</p>
      </div>
      <button @click="requestReviews" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">📨 Solicitar Reseñas</button>
    </div>

    <!-- Stats & Config -->
    <div class="grid md:grid-cols-3 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ reviews.length }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Total Reseñas</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-gold">★ {{ avgRating }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Calificación Promedio</div>
      </div>
      <div class="card p-4">
        <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Configuración</div>
        <div class="space-y-2">
          <label class="flex items-center justify-between cursor-pointer text-xs">
            <span class="text-navy font-bold">Solicitar reseñas</span>
            <input v-model="config.requestReviews" type="checkbox" class="w-4 h-4 rounded text-cyan" @change="saveConfig" />
          </label>
          <label class="flex items-center justify-between cursor-pointer text-xs">
            <span class="text-navy font-bold">Publicar puntuación</span>
            <input v-model="config.publishScore" type="checkbox" class="w-4 h-4 rounded text-cyan" @change="saveConfig" />
          </label>
          <label class="flex items-center justify-between cursor-pointer text-xs">
            <span class="text-navy font-bold">Publicar comentarios</span>
            <input v-model="config.publishComments" type="checkbox" class="w-4 h-4 rounded text-cyan" @change="saveConfig" />
          </label>
        </div>
      </div>
    </div>

    <!-- Reviews List -->
    <div class="space-y-4">
      <div v-for="r in reviews" :key="r.id" class="card p-5">
        <div class="flex items-start justify-between mb-2">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg font-black text-gold">{{ '★'.repeat(r.rating || 0) }}{{ '☆'.repeat(5 - (r.rating || 0)) }}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="channelBadge(r.channel)">{{ r.channel || 'Directa' }}</span>
            </div>
            <div class="text-sm font-bold text-navy mt-1">{{ r.guestName || 'Anónimo' }}</div>
            <div class="text-[10px] text-text-muted">{{ r.createdAt?.slice(0,10) || '' }}</div>
          </div>
          <button @click="openRespond(r)" class="px-3 py-1.5 bg-navy/5 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/10">{{ r.response ? 'Editar respuesta' : 'Responder' }}</button>
        </div>
        <p class="text-sm text-text-secondary mt-2">{{ r.comment || r.title || '' }}</p>
        <div v-if="r.response" class="mt-3 bg-cyan/5 rounded-xl p-3 text-sm italic text-navy border border-cyan/20">
          <span class="text-[10px] font-bold text-cyan block mb-1">Respuesta del hotel:</span>
          {{ r.response }}
        </div>
      </div>
      <div v-if="reviews.length === 0" class="card p-8 text-center text-text-muted text-sm">No hay opiniones aún</div>
    </div>

    <!-- Respond Modal -->
    <Teleport to="body">
      <div v-if="respondModal.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="respondModal.show=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-4">Responder a {{ respondModal.guest }}</h3>
          <div class="bg-surface rounded-xl p-3 mb-4 text-sm text-text-secondary">"{{ respondModal.comment }}"</div>
          <textarea v-model="respondModal.text" rows="4" placeholder="Escribe tu respuesta..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm resize-none"></textarea>
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
import { http } from '@/services/http'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const reviews = ref<any[]>([])
const config = ref({ requestReviews: true, publishScore: true, publishComments: true })

const avgRating = computed(() => {
  if (!reviews.value.length) return '0'
  return (reviews.value.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.value.length).toFixed(1)
})

const respondModal = ref({ show: false, id: '', guest: '', comment: '', text: '' })

function channelBadge(c: string) {
  const m: any = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral' }
  return m[c?.toLowerCase()] || 'bg-gray-100 text-gray-500'
}

async function load() {
  try {
    const r = await http.get<any>('/opiniones')
    reviews.value = Array.isArray(r) ? r : (r?.data || [])
  } catch { reviews.value = [] }
  try {
    const c = await http.get<any>('/configuracion/opiniones_config')
    if (c?.valor) config.value = typeof c.valor === 'string' ? JSON.parse(c.valor) : c.valor
  } catch {}
}

function openRespond(r: any) {
  respondModal.value = { show: true, id: r.id, guest: r.guestName || 'Anónimo', comment: r.comment || '', text: r.response || '' }
}

async function saveResponse() {
  try {
    await http.put(`/opiniones/${respondModal.value.id}`, { response: respondModal.value.text })
    const rev = reviews.value.find(r => r.id === respondModal.value.id)
    if (rev) rev.response = respondModal.value.text
    toast.success('Respuesta publicada')
    respondModal.value.show = false
  } catch { toast.error('Error') }
}

async function saveConfig() {
  try { await http.post('/configuracion', { clave: 'opiniones_config', valor: JSON.stringify(config.value), hotelId: '' }) } catch {}
}

function requestReviews() {
  toast.info('Solicitud enviada — los huéspedes recibirán un email para dejar su opinión')
}

onMounted(load)
</script>
