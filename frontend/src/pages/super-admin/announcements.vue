<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Anuncios & Comunicados</h2>
        <p class="text-sm text-text-muted mt-0.5">Envía mensajes a todos los hoteles de la plataforma</p>
      </div>
      <button @click="showCreateModal = true" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nuevo Anuncio
      </button>
    </div>

    <!-- Sent Announcements -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden mb-6">
      <div class="p-4 border-b border-border bg-surface/50">
        <h3 class="font-extrabold text-navy text-sm">Anuncios Enviados</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Título</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Audiencia</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
              <th class="text-center py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Vistas</th>
              <th class="text-left py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
              <th class="text-right py-3 px-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ann in announcements" :key="ann.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
              <td class="py-3 px-4">
                <div class="text-sm font-bold text-navy">{{ ann.title }}</div>
                <div class="text-[10px] text-text-muted truncate max-w-[250px]">{{ ann.excerpt }}</div>
              </td>
              <td class="py-3 px-4">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="ann.typeClass">{{ ann.type }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-xs text-navy">{{ ann.audience }}</span>
              </td>
              <td class="py-3 px-4 text-xs text-text-muted">{{ ann.date }}</td>
              <td class="py-3 px-4 text-center">
                <div class="text-sm font-bold text-navy">{{ ann.views }}</div>
                <div class="text-[9px] text-text-muted">{{ ann.reads }} leídos</div>
              </td>
              <td class="py-3 px-4">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="ann.status === 'Enviado' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">{{ ann.status }}</span>
              </td>
              <td class="py-3 px-4 text-right">
                <button class="text-[10px] font-bold text-cyan hover:underline cursor-pointer mr-2">Ver</button>
                <button class="text-[10px] font-bold text-coral hover:underline cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Audience Stats -->
    <div class="grid md:grid-cols-3 gap-6">
      <div class="bg-white rounded-2xl border border-border p-6">
        <h3 class="font-extrabold text-navy mb-4">Alcance</h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-xs text-text-muted">Hoteles totales</span>
            <span class="text-xs font-bold text-navy">24</span>
          </div>
          <div class="flex justify-between">
            <span class="text-xs text-text-muted">Usuarios totales</span>
            <span class="text-xs font-bold text-navy">89</span>
          </div>
          <div class="flex justify-between">
            <span class="text-xs text-text-muted">Tasa apertura</span>
            <span class="text-xs font-bold text-teal">72%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-xs text-text-muted">Tasa click</span>
            <span class="text-xs font-bold text-cyan">18%</span>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border p-6">
        <h3 class="font-extrabold text-navy mb-4">Plantillas Guardadas</h3>
        <div class="space-y-2">
          <div v-for="tpl in templates" :key="tpl.name" class="p-2 bg-surface rounded-lg flex items-center gap-2 cursor-pointer hover:bg-surface-dark transition-colors">
            <span class="text-lg">{{ tpl.icon }}</span>
            <div>
              <div class="text-xs font-bold text-navy">{{ tpl.name }}</div>
              <div class="text-[9px] text-text-muted">{{ tpl.description }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-border p-6">
        <h3 class="font-extrabold text-navy mb-4">Programación</h3>
        <div class="space-y-3">
          <div v-for="sched in scheduled" :key="sched.id" class="bg-surface rounded-xl p-3">
            <div class="text-xs font-bold text-navy">{{ sched.title }}</div>
            <div class="flex justify-between text-[10px] mt-1">
              <span class="text-text-muted">{{ sched.date }}</span>
              <span class="text-teal font-bold">{{ sched.audience }}</span>
            </div>
          </div>
          <div v-if="scheduled.length === 0" class="text-center text-sm text-text-muted py-4">No hay anuncios programados</div>
        </div>
      </div>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showCreateModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg p-6">
        <h3 class="text-lg font-black text-navy mb-4">Nuevo Anuncio</h3>
        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Título</label>
            <input v-model="newAnnouncement.title" type="text" placeholder="Ej: ¡Nueva función disponible!" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tipo</label>
            <select v-model="newAnnouncement.type" class="w-full h-10 px-4 rounded-xl border border-border text-sm cursor-pointer">
              <option value="feature">Nueva función</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="promo">Promoción</option>
              <option value="info">Informativo</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Audiencia</label>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center gap-2 p-2 bg-surface rounded-lg cursor-pointer">
                <input type="checkbox" v-model="newAnnouncement.allHotels" class="w-4 h-4 text-cyan rounded" />
                <span class="text-xs font-bold text-navy">Todos los hoteles</span>
              </label>
              <label class="flex items-center gap-2 p-2 bg-surface rounded-lg cursor-pointer">
                <input type="checkbox" v-model="newAnnouncement.adminsOnly" class="w-4 h-4 text-cyan rounded" />
                <span class="text-xs font-bold text-navy">Solo admins</span>
              </label>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Mensaje</label>
            <textarea v-model="newAnnouncement.message" rows="4" class="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan resize-none" placeholder="Escribe el mensaje del anuncio..."></textarea>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button @click="showCreateModal = false" class="flex-1 py-2.5 bg-surface text-navy text-sm font-bold rounded-xl cursor-pointer">Cancelar</button>
          <button @click="sendAnnouncement" class="flex-1 py-2.5 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer">Enviar Ahora</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { PlatformService } from '@/services/Platform.service'

const showCreateModal = ref(false)

const newAnnouncement = ref({
  title: '', type: 'feature', allHotels: true, adminsOnly: false, message: ''
})

const TYPE_LABEL: Record<string, string> = { feature: 'Nueva función', warning: 'Mantenimiento', success: 'Informativo', info: 'Informativo' }
const TYPE_CLASS: Record<string, string> = { feature: 'bg-teal/10 text-teal', warning: 'bg-gold/10 text-gold', success: 'bg-cyan/10 text-cyan', info: 'bg-cyan/10 text-cyan' }

const announcements = ref<any[]>([])

const templates = [
  { name: 'Bienvenida', icon: '👋', description: 'Mensaje de bienvenida a nuevo hotel' },
  { name: 'Mantenimiento', icon: '🔧', description: 'Aviso de mantenimiento programado' },
  { name: 'Nueva función', icon: '🎉', description: 'Anuncio de funcionalidad nueva' },
  { name: 'Recordatorio pago', icon: '💰', description: 'Aviso de facturación pendiente' },
]

const scheduled = ref<any[]>([])

onMounted(async () => {
  try {
    const { data } = await PlatformService.announcements()
    announcements.value = data.map((a: any) => ({
      id: a.id,
      title: a.title,
      excerpt: (a.message ?? '').slice(0, 80),
      type: TYPE_LABEL[a.type] ?? 'Informativo',
      typeClass: TYPE_CLASS[a.type] ?? 'bg-cyan/10 text-cyan',
      audience: a.hotelId ? 'Hotel específico' : 'Todos los hoteles',
      date: a.fecha ? String(a.fecha).slice(0, 10) : '',
      views: 0, reads: 0,
      status: a.active === 1 ? 'Enviado' : 'Borrador',
    }))
  } catch { /* silent */ }
})

function sendAnnouncement() {
  announcements.value.unshift({
    id: Date.now(),
    title: newAnnouncement.value.title,
    excerpt: newAnnouncement.value.message.substring(0, 80) + '...',
    type: newAnnouncement.value.type === 'feature' ? 'Nueva función' : newAnnouncement.value.type === 'maintenance' ? 'Mantenimiento' : newAnnouncement.value.type === 'promo' ? 'Promoción' : 'Informativo',
    typeClass: newAnnouncement.value.type === 'feature' ? 'bg-teal/10 text-teal' : newAnnouncement.value.type === 'maintenance' ? 'bg-gold/10 text-gold' : newAnnouncement.value.type === 'promo' ? 'bg-purple/10 text-purple' : 'bg-cyan/10 text-cyan',
    audience: newAnnouncement.value.allHotels ? 'Todos los hoteles' : 'Admins',
    date: 'Ahora',
    views: 0, reads: 0, status: 'Enviado',
  })
  showCreateModal.value = false
  newAnnouncement.value = { title: '', type: 'feature', allHotels: true, adminsOnly: false, message: '' }
}
</script>
