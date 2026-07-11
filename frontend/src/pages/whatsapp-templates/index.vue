<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-black text-navy">Plantillas WhatsApp</h2>
        <p class="text-xs text-text-muted mt-0.5">Textos predefinidos reutilizables al comunicarte con huéspedes</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">+ Nueva Plantilla</button>
    </div>

    <!-- Estadísticas rápidas -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-navy">{{ templates.length }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Total</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-teal">{{ activeCount }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Activas</div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-4 text-center transition-transform duration-300 hover:-translate-y-0.5">
        <div class="text-2xl font-black text-cyan">{{ categoriesCount }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Categorías</div>
      </div>
    </div>

    <!-- Lista de plantillas -->
    <div v-if="loading" class="text-center py-12 text-text-muted text-sm">Cargando...</div>
    <div v-else-if="templates.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 block text-navy/30" v-html="ICON_MESSAGE"></span>
      <h3 class="font-bold text-navy mb-1">Sin plantillas</h3>
      <p class="text-xs text-text-muted mb-4">Crea tu primera plantilla para responder más rápido a tus huéspedes</p>
      <button @click="openNew" class="px-5 py-2.5 bg-cyan text-navy rounded-full text-sm font-bold hover:shadow-lg transition-all cursor-pointer">+ Crear plantilla</button>
    </div>
    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="t in templates" :key="t.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5 cursor-pointer hover:shadow-lg transition-all flex flex-col" @click="openEdit(t)">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="w-4 h-4 text-navy/50 shrink-0" v-html="categoryIcon(t.category)"></span>
            <h3 class="text-sm font-black text-navy flex-1 truncate">{{ t.name }}</h3>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="t.isActive ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'">{{ t.isActive ? 'Activa' : 'Inactiva' }}</span>
        </div>
        <p class="text-xs text-text-secondary mb-3 line-clamp-3 flex-1">{{ t.body }}</p>
        <div class="flex items-center justify-between text-[10px] text-text-muted">
          <span class="font-bold uppercase">{{ t.category || 'general' }}</span>
          <button v-if="t.body" @click.stop="testTemplate(t)" class="text-emerald-600 hover:underline cursor-pointer font-bold">Probar</button>
        </div>
      </div>
    </div>

    <!-- Modal crear/editar -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="modal.show=false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nueva' }} Plantilla</h3>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded text-cyan" />
                  <span class="text-xs font-bold text-navy">Activa</span>
                </label>
                <button @click="modal.show=false" class="w-4 h-4 text-text-muted hover:text-navy transition-colors cursor-pointer" v-html="ICON_X"></button>
              </div>
            </div>
            <div class="overflow-y-auto flex-1 p-5 space-y-4">
              <div class="grid grid-cols-3 gap-4">
                <div class="col-span-2">
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Nombre *</label>
                  <input v-model="form.name" type="text" placeholder="Bienvenida, Confirmación, etc." class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Categoría</label>
                  <select v-model="form.category" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
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
                <textarea v-model="form.body" rows="6" placeholder="Hola {guest_name}! Gracias por reservar en {hotel_name}. Te esperamos el {checkin_date} en {room_number}." class="w-full px-4 py-3 rounded-2xl border border-border text-sm resize-none"></textarea>
                <p class="text-[10px] text-text-muted mt-1">Longitud máxima de WhatsApp: 1024 caracteres.</p>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase mb-2">Variables disponibles (click para insertar)</label>
                <div class="flex flex-wrap gap-1">
                  <button v-for="v in variables" :key="v" @click="insertVariable(v)" type="button"
                    class="px-2.5 py-1 bg-navy/5 text-navy rounded-full text-[10px] font-bold cursor-pointer hover:bg-navy/10 transition-colors">{{ v }}</button>
                </div>
              </div>
              <!-- Preview -->
              <div v-if="form.body" class="py-4 border-t border-border">
                <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Vista previa</div>
                <p class="text-xs text-navy whitespace-pre-wrap">{{ preview }}</p>
              </div>
            </div>
            <div class="shrink-0 p-5 border-t border-border flex items-center gap-4 justify-end">
              <button v-if="modal.edit" @click="deleteTemplate" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer mr-auto">Eliminar</button>
              <button @click="modal.show=false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="save" :disabled="saving" class="px-4 py-2 bg-navy text-white rounded-full text-[11px] font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { WhatsappService } from '@/services/Whatsapp.service'
import type { WhatsappTemplate } from '@/services/Whatsapp.service'
import { useToast } from '@/composables/useToast'

const SVG_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
const ICON_X = `${SVG_OPEN}<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
const ICON_MESSAGE = `${SVG_OPEN}<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`
const ICON_CALENDAR = `${SVG_OPEN}<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`
const ICON_BELL = `${SVG_OPEN}<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M20 16a8 8 0 0 0-16 0"/><path d="M12 4v4"/><path d="M10 4h4"/></svg>`
const ICON_LOGOUT = `${SVG_OPEN}<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`
const ICON_CARD = `${SVG_OPEN}<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
const ICON_MEGAPHONE = `${SVG_OPEN}<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`

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
  const icons: Record<string, string> = { general: ICON_MESSAGE, reservation: ICON_CALENDAR, checkin: ICON_BELL, checkout: ICON_LOGOUT, payment: ICON_CARD, marketing: ICON_MEGAPHONE }
  return icons[c || 'general'] || ICON_MESSAGE
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

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
