<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Envíos Automáticos</h2>
        <p class="text-sm text-text-muted mt-0.5">Mensajes programados que se envían automáticamente según eventos de la reserva</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">+ Nuevo Mensaje</button>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <div v-for="msg in messages" :key="msg.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-5 cursor-pointer hover:shadow-lg transition-all" @click="openEdit(msg)">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: msg.color || '#3b82f6' }"></div>
          <h3 class="text-sm font-black text-navy flex-1 truncate">{{ msg.title }}</h3>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="msg.isActive ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-400'">{{ msg.isActive ? 'Activo' : 'Inactivo' }}</span>
        </div>
        <div class="space-y-1 text-xs text-text-secondary mb-3">
          <div class="flex justify-between"><span>Canal:</span><span class="font-bold text-navy">{{ channelLabel(msg.channel) }}</span></div>
          <div class="flex justify-between"><span>Evento:</span><span class="font-bold text-navy">{{ triggerLabel(msg.triggerEvent) }}</span></div>
          <div class="flex justify-between"><span>Plantilla:</span><span class="font-bold text-navy">{{ eventLabel(msg.event) }} · {{ langLabel(msg.language) }}</span></div>
          <div v-if="msg.triggerOffset" class="flex justify-between"><span>Offset:</span><span class="font-bold text-navy">{{ msg.triggerOffset }} días</span></div>
        </div>
        <div class="text-[10px] text-text-muted truncate">{{ msg.emailSubject || 'Sin asunto' }}</div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nuevo' }} Mensaje</h3>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.isActive" type="checkbox" class="w-4 h-4 rounded text-cyan" />
                  <span class="text-xs font-bold text-navy">Activo</span>
                </label>
                <button @click="modal.show=false" class="w-4 h-4 text-text-muted hover:text-navy transition-colors cursor-pointer" v-html="ICON_X"></button>
              </div>
            </div>
            <div class="overflow-y-auto flex-1 p-5 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2"><label class="block text-[11px] font-bold text-navy uppercase mb-2">Título</label><input v-model="form.title" type="text" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" /></div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Color</label><input v-model="form.color" type="color" class="w-full h-10 rounded-full border border-border cursor-pointer" /></div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Canal</label>
                  <select v-model="form.channel" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
                    <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Ambos</option>
                  </select>
                </div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Plantilla (evento)</label>
                  <select v-model="form.event" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
                    <option value="checkin_welcome">Bienvenida (check-in)</option><option value="reservation_confirmed">Confirmación de reserva</option><option value="reservation_presale">Reserva pendiente de pago</option><option value="reminder">Recordatorio</option>
                  </select>
                </div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Idioma</label>
                  <select v-model="form.language" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
                    <option value="es">Español</option><option value="en">English</option><option value="pt">Português</option>
                  </select>
                </div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Evento Disparador</label>
                  <select v-model="form.triggerEvent" class="w-full px-4 py-2.5 rounded-full border border-border text-sm cursor-pointer">
                    <option value="on_reservation">Al crear reserva</option><option value="pre_checkin">X días antes del check-in</option><option value="checkin_day">El día del check-in</option><option value="checkout_day">El día del check-out</option><option value="post_checkout">X días después del check-out</option>
                  </select>
                </div>
                <div v-if="form.triggerEvent==='pre_checkin'||form.triggerEvent==='post_checkout'">
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Días (offset)</label>
                  <input v-model.number="form.triggerOffset" type="number" min="0" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" />
                </div>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Asunto del Email</label><input v-model="form.emailSubject" type="text" placeholder="Confirmación de reserva - {hotel_name}" class="w-full px-4 py-2.5 rounded-full border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Cuerpo del Email</label><textarea v-model="form.emailBody" rows="5" placeholder="Hola {guest_name}, tu reserva en {hotel_name} está confirmada..." class="w-full px-4 py-2.5 rounded-2xl border border-border text-xs resize-none font-mono"></textarea></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Texto WhatsApp</label><textarea v-model="form.whatsappBody" rows="3" placeholder="Hola {guest_name}! Tu reserva en {hotel_name} está confirmada. Te esperamos el {checkin_date}." class="w-full px-4 py-2.5 rounded-2xl border border-border text-sm resize-none"></textarea></div>
              <div>
                <label class="block text-[11px] font-bold text-navy uppercase mb-2">Variables Disponibles</label>
                <div class="flex flex-wrap gap-1">
                  <span v-for="v in variables" :key="v" @click="insertVariable(v)" class="px-2.5 py-1 bg-navy/5 text-navy rounded-full text-[10px] font-bold cursor-pointer hover:bg-navy/10 transition-colors">{{ v }}</span>
                </div>
              </div>
            </div>
            <div class="shrink-0 p-5 border-t border-border flex items-center gap-4 justify-end">
              <button v-if="modal.edit" @click="deleteMsg" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer mr-auto">Eliminar</button>
              <button @click="modal.show=false" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="save" :disabled="saving" class="px-4 py-2 bg-navy text-white rounded-full text-[11px] font-bold hover:bg-navy-light transition-all cursor-pointer disabled:opacity-50">{{ saving?'Guardando...':'Guardar' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { AutoMessagesService } from '@/services/AutoMessages.service'

const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'

const auth = useAuthStore()
const toast = useToast()

const messages = ref<any[]>([])
const saving = ref(false)
const editId = ref('')
const modal = ref({ show: false, edit: false })

const form = ref({ title:'', color:'#3b82f6', emailSubject:'', emailBody:'', whatsappBody:'', channel:'email', triggerEvent:'checkin_day', triggerOffset:0, variables:[] as string[], isActive:true, event:'checkin_welcome', language:'es', triggerType:'cron' })

const variables = ['{hotel_name}','{hotel_address}','{hotel_phone}','{guest_name}','{checkin_date}','{checkout_date}','{room_number}','{room_type}','{nights}','{total_amount}','{pending_amount}','{locator}','{wifi_network}','{wifi_password}','{lock_codes}','{reservation_image}']

function channelLabel(c: string) { const m: any = { email:'Email', whatsapp:'WhatsApp', both:'Email + WhatsApp' }; return m[c]||c }
function triggerLabel(t: string) { const m: any = { on_reservation:'Al crear reserva', pre_checkin:'Antes del check-in', checkin_day:'Día del check-in', checkout_day:'Día del check-out', post_checkout:'Después del check-out' }; return m[t]||t }
function eventLabel(e?: string) { const m: any = { checkin_welcome:'Bienvenida', reservation_confirmed:'Confirmación', reservation_presale:'Pre-venta', reminder:'Recordatorio' }; return e ? (m[e]||e) : '—' }
function langLabel(l?: string) { const m: any = { es:'ES', en:'EN', pt:'PT' }; return l ? (m[l]||l) : '—' }

function insertVariable(v: string) {
  const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null
  if (!el || !('value' in el)) return
  const start = el.selectionStart || el.value.length
  el.value = el.value.slice(0, start) + v + el.value.slice(el.selectionEnd || start)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function load() {
  try { const r = await AutoMessagesService.list(); messages.value = r.data||[] } catch {}
}
function openNew() {
  editId.value=''; modal.value={ show:true, edit:false }
  form.value={ title:'', color:'#3b82f6', emailSubject:'', emailBody:'', whatsappBody:'', channel:'email', triggerEvent:'checkin_day', triggerOffset:0, variables:[], isActive:true, event:'checkin_welcome', language:'es', triggerType:'cron' }
}
function openEdit(m: any) {
  editId.value=m.id; modal.value={ show:true, edit:true }
  form.value={ title:m.title, color:m.color||'#3b82f6', emailSubject:m.emailSubject||'', emailBody:m.emailBody||'', whatsappBody:m.whatsappBody||'', channel:m.channel||'email', triggerEvent:m.triggerEvent||'checkin_day', triggerOffset:m.triggerOffset||0, variables:m.variables||[], isActive:m.isActive!==false, event:m.event||'checkin_welcome', language:m.language||'es', triggerType:m.triggerType||'cron' }
}
async function save() {
  if(!form.value.title){ toast.error('Falta título'); return }
  saving.value=true
  try {
    const data = { ...form.value }
    if(editId.value) { await AutoMessagesService.update(editId.value, data) }
    else { await AutoMessagesService.create(data) }
    toast.success(editId.value?'Actualizado':'Creado')
  } catch { toast.error('Error') }
  saving.value=false; modal.value.show=false; await load()
}
async function deleteMsg() {
  if(!confirm('¿Eliminar este mensaje?')) return
  try { await AutoMessagesService.remove(editId.value); toast.success('Eliminado'); modal.value.show=false; await load() } catch { toast.error('Error') }
}

onMounted(load)
</script>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel { opacity: 0; transform: translateY(8px) scale(0.98); }
</style>
