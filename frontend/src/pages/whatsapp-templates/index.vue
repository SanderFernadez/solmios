<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Plantillas WhatsApp</h2>
        <p class="text-sm text-text-muted mt-0.5">Textos predefinidos reutilizables al comunicarte con huéspedes</p>
      </div>
      <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Nueva Plantilla
      </button>
    </div>

    <!-- Estadísticas rápidas -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10"><span class="w-5 h-5 text-navy" v-html="ICON_CHAT"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-navy truncate">{{ templates.length }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10"><span class="w-5 h-5 text-teal" v-html="ICON_CHECK_CIRCLE"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-teal truncate">{{ activeCount }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Activas</div></div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10"><span class="w-5 h-5 text-cyan" v-html="ICON_TAG"></span></div>
          <div class="min-w-0"><div class="text-xl font-black leading-none text-cyan truncate">{{ categoriesCount }}</div><div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Categorías</div></div>
        </div>
      </div>
    </div>

    <!-- Lista de plantillas -->
    <div v-if="loading" class="text-center py-12 text-text-muted text-sm">Cargando...</div>
    <div v-else-if="templates.length === 0" class="card p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CHAT"></span>
      <h3 class="font-bold text-navy mb-1">Sin plantillas</h3>
      <p class="text-xs text-text-muted mb-4">Crea tu primera plantilla para responder más rápido a tus huéspedes</p>
      <button @click="openNew" class="inline-flex items-center gap-1.5 px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold hover:shadow-lg cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>Crear plantilla
      </button>
    </div>
    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="t in templates" :key="t.id" class="card p-5 cursor-pointer hover:shadow-lg transition-all flex flex-col" @click="openEdit(t)">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-4 h-4 text-cyan shrink-0" v-html="categoryIcon(t.category)"></span>
            <h3 class="text-sm font-black text-navy flex-1 truncate">{{ t.name }}</h3>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="t.isActive ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'">{{ t.isActive ? 'Activa' : 'Inactiva' }}</span>
        </div>
        <p class="text-xs text-text-secondary mb-3 line-clamp-3 flex-1">{{ t.body }}</p>
        <div class="flex items-center justify-between text-[10px] text-text-muted">
          <span class="font-bold uppercase">{{ t.category || 'general' }}</span>
          <button v-if="t.body" @click.stop="testTemplate(t)" class="inline-flex items-center gap-1 text-teal hover:underline cursor-pointer font-bold">
            <span class="w-3 h-3 shrink-0" v-html="ICON_CHAT"></span>Probar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal crear/editar -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nueva' }} Plantilla</h3>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded text-cyan" />
                <span class="text-xs font-bold text-navy">Activa</span>
              </label>
              <button @click="modal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-navy cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-navy uppercase mb-2">Nombre *</label>
                <input v-model="form.name" type="text" placeholder="Bienvenida, Confirmación, etc." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase mb-2">Categoría</label>
                <select v-model="form.category" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="general">General</option>
                  <option value="reservation">Reserva</option>
                  <option value="checkin">Check-in</option>
                  <option value="checkout">Check-out</option>
                  <option value="payment">Pago</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-[11px] font-bold text-navy uppercase">Cuerpo del mensaje *</label>
                <span class="text-[10px] text-text-muted">{{ (form.body || '').length }} / 1024</span>
              </div>
              <textarea v-model="form.body" rows="6" placeholder="Hola {guest_name}! Gracias por reservar en {hotel_name}. Te esperamos el {checkin_date} en {room_number}." class="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none"></textarea>
              <p class="text-[10px] text-text-muted mt-1">Longitud máxima de WhatsApp: 1024 caracteres.</p>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-2">Variables disponibles (click para insertar)</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in variables" :key="v" @click="insertVariable(v)" type="button"
                  class="px-2 py-1 bg-navy/5 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/10">{{ v }}</button>
              </div>
            </div>
            <!-- Preview -->
            <div v-if="form.body" class="bg-teal/5 border border-teal/20 rounded-xl p-4">
              <div class="flex items-center gap-1.5 text-[10px] font-bold text-teal uppercase mb-2">
                <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_CHAT"></span>Vista previa
              </div>
              <p class="text-xs text-navy whitespace-pre-wrap">{{ preview }}</p>
            </div>
          </div>
          <div class="p-5 border-t border-border bg-surface/50 flex gap-3 justify-end sticky bottom-0">
            <button v-if="modal.edit" @click="deleteTemplate" class="flex items-center gap-1.5 px-5 py-2.5 border border-coral/30 text-coral rounded-xl text-sm font-bold cursor-pointer mr-auto">
              <span class="w-4 h-4 shrink-0" v-html="ICON_TRASH"></span>Eliminar
            </button>
            <button @click="modal.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { WhatsappService } from '@/services/Whatsapp.service'
import type { WhatsappTemplate } from '@/services/Whatsapp.service'
import { useToast } from '@/composables/useToast'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_CHECK_CIRCLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 2.25 2.25 4.5-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_TAG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>'
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg>'
const ICON_LOGIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H3"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'
const ICON_MEGAPHONE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0A23.74 23.74 0 0 0 18.795 3m.38 1.125a23.91 23.91 0 0 1 1.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 0 0 1.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 0 1 0 3.46"/></svg>'
const ICON_DOOR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-1.5m0 0v-3m0 3H12m1.5 0h1.5m-3-16.5-4.5 1.636A2.25 2.25 0 0 0 6 6.253v13.5A2.25 2.25 0 0 0 8.25 21h9.5a2.25 2.25 0 0 0 2.25-2.25V6.253a2.25 2.25 0 0 0-1.5-2.121L13.5 2.494a2.25 2.25 0 0 0-3 0Z"/></svg>'

const toast = useToast()
const templates = ref<WhatsappTemplate[]>([])
const loading = ref(true)
const saving = ref(false)
const editId = ref('')
const modal = ref({ show: false, edit: false })

const form = ref<{ name: string; body: string; category: string; isActive: boolean }>({
  name: '', body: '', category: 'general', isActive: true,
})

const variables = ['{guest_name}', '{hotel_name}', '{checkin_date}', '{checkout_date}', '{room_number}', '{nights}', '{total_amount}', '{pending_amount}', '{locator}', '{wifi_network}', '{wifi_password}', '{lock_codes}']

const activeCount = computed(() => templates.value.filter(t => t.isActive).length)
const categoriesCount = computed(() => new Set(templates.value.map(t => t.category || 'general')).size)

/** Preview con variables reemplazadas por valores demo */
const preview = computed(() => {
  return (form.value.body || '')
    .replace(/\{guest_name\}/g, 'María García')
    .replace(/\{hotel_name\}/g, 'Hotel Paraíso')
    .replace(/\{checkin_date\}/g, '15 Jul 2026')
    .replace(/\{checkout_date\}/g, '18 Jul 2026')
    .replace(/\{room_number\}/g, '204')
    .replace(/\{nights\}/g, '3')
    .replace(/\{total_amount\}/g, '$360')
    .replace(/\{pending_amount\}/g, '$120')
    .replace(/\{locator\}/g, 'HX-7842')
    .replace(/\{wifi_network\}/g, 'HotelParaiso-Guest')
    .replace(/\{wifi_password\}/g, 'paraiso2026')
    .replace(/\{lock_codes\}/g, '458219')
})

function categoryIcon(c?: string) {
  const icons: Record<string, string> = {
    general: ICON_CHAT, reservation: ICON_CALENDAR, checkin: ICON_LOGIN,
    checkout: ICON_DOOR, payment: ICON_WALLET, marketing: ICON_MEGAPHONE,
  }
  return icons[c || 'general'] || ICON_CHAT
}

function insertVariable(v: string) {
  form.value.body = (form.value.body || '') + v
}

async function load() {
  loading.value = true
  try {
    const r = await WhatsappService.list()
    templates.value = r.data || []
  } catch {
    templates.value = []
  } finally {
    loading.value = false
  }
}

function openNew() {
  editId.value = ''
  modal.value = { show: true, edit: false }
  form.value = { name: '', body: '', category: 'general', isActive: true }
}

function openEdit(t: WhatsappTemplate) {
  editId.value = t.id || ''
  modal.value = { show: true, edit: true }
  form.value = {
    name: t.name,
    body: t.body || '',
    category: t.category || 'general',
    isActive: t.isActive !== false,
  }
}

async function save() {
  if (!form.value.name || !form.value.body) {
    toast.error('Nombre y cuerpo son obligatorios')
    return
  }
  saving.value = true
  try {
    if (editId.value) {
      await WhatsappService.update(editId.value, form.value)
      toast.success('Plantilla actualizada')
    } else {
      await WhatsappService.create(form.value)
      toast.success('Plantilla creada')
    }
    modal.value.show = false
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error al guardar')
  } finally {
    saving.value = false
  }
}

async function deleteTemplate() {
  if (!editId.value) return
  if (!confirm('¿Eliminar esta plantilla?')) return
  try {
    await WhatsappService.remove(editId.value)
    toast.success('Eliminada')
    modal.value.show = false
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

/** Abre WhatsApp Web con datos demo */
function testTemplate(t: WhatsappTemplate) {
  const text = (t.body || '')
    .replace(/\{guest_name\}/g, 'Demo Huésped')
    .replace(/\{hotel_name\}/g, 'Demo Hotel')
    .replace(/\{checkin_date\}/g, '15 Jul 2026')
    .replace(/\{checkout_date\}/g, '18 Jul 2026')
    .replace(/\{room_number\}/g, '101')
    .replace(/\{nights\}/g, '3')
    .replace(/\{total_amount\}/g, '$300')
    .replace(/\{pending_amount\}/g, '$0')
    .replace(/\{locator\}/g, 'DEMO-001')
    .replace(/\{wifi_network\}/g, 'DemoWiFi')
    .replace(/\{wifi_password\}/g, 'demo1234')
    .replace(/\{lock_codes\}/g, '123456')
  const url = WhatsappService.link('18295551234', text)
  window.open(url, '_blank')
}

onMounted(load)
</script>
