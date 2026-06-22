<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-black text-navy">Reservas</h2>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Nueva Reserva</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div v-for="s in statsCards" :key="s.label" class="card p-4 text-center">
        <div class="text-2xl font-black" :class="s.color">{{ s.value }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">{{ s.label }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar huésped..." class="px-4 py-2 rounded-xl border border-border text-sm w-48 focus:outline-none focus:border-navy" />
      <select v-model="filterStatus" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos</option>
        <option value="confirmed">Confirmadas</option><option value="pending">Pendientes</option>
        <option value="checked_in">Check-in</option><option value="checked_out">Check-out</option><option value="cancelled">Canceladas</option>
      </select>
      <select v-model="filterChannel" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos canales</option>
        <option value="direct">Directa</option><option value="booking">Booking</option><option value="expedia">Expedia</option><option value="airbnb">Airbnb</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} reservas</span>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-border overflow-hidden">
      <table class="w-full">
        <thead><tr class="border-b border-border bg-surface/50">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hab</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Check-in</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Check-out</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">N</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Canal</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Total</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase"></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in filtered" :key="r.id" class="border-b border-border last:border-0 hover:bg-surface/50 cursor-pointer" @click="openEdit(r)">
            <td class="p-4"><div class="font-bold text-sm text-navy">{{ r.guestName }}</div><div class="text-[10px] text-text-muted">{{ r.email }}</div></td>
            <td class="p-4 text-sm font-bold">{{ r.roomNumber }}</td>
            <td class="p-4 text-sm">{{ fmtDate(r.checkIn) }}</td>
            <td class="p-4 text-sm">{{ fmtDate(r.checkOut) }}</td>
            <td class="p-4 text-sm font-bold">{{ r.nights }}n</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="stClass(r.status)">{{ stLabel(r.status) }}</span></td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="srcClass(r.source)">{{ srcLabel(r.source) }}</span></td>
            <td class="p-4 text-right text-sm font-extrabold text-navy">${{ r.total }}</td>
            <td class="p-4 text-right" @click.stop>
              <button v-if="r.status==='confirmed'" @click="confirmAction('checkin',r)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold cursor-pointer hover:bg-teal/20 mr-1">Check-in</button>
              <button v-if="r.status==='pending'||r.status==='confirmed'" @click="confirmAction('cancel',r)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">Cancelar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="modal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="p-5 border-b border-border flex items-center justify-between shrink-0">
            <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nueva' }} Reserva</h3>
            <div class="flex items-center gap-3">
              <div class="flex gap-2">
                <button v-for="s in ['confirmed','pending','checked_in','cancelled']" :key="s" @click="form.status=s" class="px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer" :class="form.status===s?stBtn(s):'border-border text-text-secondary'">{{ stLabel(s) }}</button>
              </div>
              <button @click="modal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center cursor-pointer">✕</button>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div class="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <!-- LEFT -->
              <div class="p-5 space-y-5">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Canal</label>
                  <div class="grid grid-cols-4 gap-2">
                    <button v-for="ch in chList" :key="ch.v" @click="form.source=ch.v" class="p-2.5 rounded-xl border-2 text-center cursor-pointer" :class="form.source===ch.v?'border-navy bg-navy/5':'border-border'"><span class="text-lg block">{{ ch.i }}</span><span class="text-[9px] font-bold">{{ ch.l }}</span></button>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Check-in *</label><input v-model="form.checkIn" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                  <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Check-out *</label><input v-model="form.checkOut" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Hab.</label><select v-model="form.roomId" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer"><option value="">--</option><option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.number }} - {{ r.type }}</option></select></div>
                  <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Adultos</label><input v-model.number="form.adults" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                  <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Niños</label><input v-model.number="form.children" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                </div>
                <div v-if="form.source!=='direct'" class="grid grid-cols-2 gap-3">
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Comisión (%)</label><input v-model.number="form.commission" type="number" min="0" @input="form.commissionAmount = Math.round(total * form.commission / 100)" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                  <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Loc. OTA</label><input v-model="form.extLocator" type="text" class="w-full px-3 py-2 rounded-lg border border-border text-sm" /></div>
                  <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Notas del Canal (OTA)</label><textarea v-model="form.otaNotes" rows="2" class="w-full px-3 py-2 rounded-lg border border-border text-xs resize-none"></textarea></div>
                </div>
                <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Notas Internas</label><textarea v-model="form.notes" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm resize-none"></textarea></div>

                <!-- Condiciones (colapsable) -->
                <div class="border border-border rounded-xl overflow-hidden">
                  <button @click="expandedSections.conditions = !expandedSections.conditions" class="w-full px-4 py-2.5 bg-surface flex items-center justify-between text-xs font-bold text-navy cursor-pointer">
                    <span>⚖️ Condiciones de Reserva</span>
                    <span>{{ expandedSections.conditions ? '▲' : '▼' }}</span>
                  </button>
                  <div v-if="expandedSections.conditions" class="p-4 space-y-3">
                    <label class="flex items-center gap-2 text-xs text-text-secondary">
                      <input v-model="form.autoSendEnabled" type="checkbox" class="w-4 h-4 rounded text-cyan" />
                      Envíos automáticos al huésped
                    </label>
                  </div>
                </div>
                <div v-if="selRoom && form.checkIn && form.checkOut" class="bg-surface rounded-xl p-4 text-sm space-y-2">
                  <div class="flex justify-between"><span>{{ nights }}n × ${{ selRoom.basePrice }}</span><span class="font-bold">${{ selRoom.basePrice*nights }}</span></div>
                  <div class="flex justify-between"><span>Impuestos</span><span class="font-bold">${{ taxes }}</span></div>
                  <div class="border-t border-border pt-2 flex justify-between"><span class="font-extrabold text-navy">Total</span><span class="font-extrabold text-navy text-lg">${{ total }}</span></div>
                </div>
              </div>
              <!-- RIGHT -->
              <div class="p-5 space-y-5">
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Huésped</label>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2"><input v-model="form.guestName" type="text" placeholder="Nombre *" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                    <div><input v-model="form.email" type="email" placeholder="Email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                    <div><input v-model="form.phone" type="tel" placeholder="Teléfono" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                    <div><input v-model="form.document" type="text" placeholder="Pasaporte/ID" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
                    <div><select v-model="form.docType" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer"><option value="passport">Pasaporte</option><option value="id">Cédula</option></select></div>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Pago</label>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-[10px] font-bold text-text-muted uppercase mb-1">Método</label><select v-model="form.payMethod" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer"><option value="transfer">Transferencia</option><option value="card">Tarjeta</option><option value="cash">Efectivo</option></select></div>
                    <div><label class="text-[10px] font-bold text-text-muted uppercase mb-1">Depósito $</label><input v-model.number="form.deposit" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" /></div>
                  </div>
                  <div v-if="total>0" class="mt-3 bg-navy/5 rounded-xl p-3 flex justify-between items-center"><span class="text-xs text-text-secondary">Pendiente</span><span class="text-sm font-black" :class="pend>0?'text-coral':'text-teal'">${{ pend }}</span></div>
                  <div v-if="total>0 && pend>0" class="mt-3">
                    <label class="block text-[11px] font-bold text-navy uppercase mb-2">Req. de Pago</label>
                    <div class="bg-surface rounded-xl p-3 space-y-2">
                      <div class="text-xs text-text-secondary">Crear requerimiento de pago por ${{ pend }}</div>
                      <div class="flex gap-2">
                        <button @click="createPaymentRequest" class="flex-1 py-2 bg-navy text-white rounded-lg text-xs font-bold cursor-pointer">💳 Crear link</button>
                        <button @click="sendPayLink('email')" class="flex-1 py-2 bg-purple text-white rounded-lg text-xs font-bold cursor-pointer">📧 Email</button>
                        <button @click="sendPayLink('whatsapp')" class="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer">💬 WhatsApp</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-navy uppercase mb-2">Acompañantes</label>
                  <div class="space-y-2">
                    <div v-for="(c,i) in form.companions" :key="i" class="grid grid-cols-12 gap-1.5 items-center bg-surface rounded-lg p-2">
                      <input v-model="c.name" placeholder="Nombre" class="col-span-5 px-2 py-1.5 rounded-lg border border-border text-xs" />
                      <input v-model="c.doc" placeholder="Doc." class="col-span-3 px-2 py-1.5 rounded-lg border border-border text-xs" />
                      <select v-model="c.docType" class="col-span-3 px-1 py-1.5 rounded-lg border border-border text-xs cursor-pointer">
                        <option value="passport">Pasap.</option>
                        <option value="id">Cédula</option>
                        <option value="driver_license">Lic.</option>
                      </select>
                      <button @click="form.companions.splice(i,1)" class="col-span-1 text-coral text-xs font-bold cursor-pointer">✕</button>
                    </div>
                    <button @click="form.companions.push({name:'',doc:'',docType:'passport'})" class="text-xs font-bold text-teal hover:underline cursor-pointer">+ Agregar acompañante</button>
                  </div>
                </div>
                <!-- Cerradura TTLock -->
                <div class="border border-border rounded-xl p-3 bg-surface">
                  <div class="flex items-center justify-between mb-2">
                    <label class="text-[11px] font-bold text-navy uppercase">🔐 Cerradura</label>
                    <button @click="generateLockCode" class="text-[10px] font-bold text-teal hover:underline cursor-pointer">
                      {{ lockCode ? '↻ Regenerar' : '+ Generar código' }}
                    </button>
                  </div>
                  <div v-if="lockCode" class="text-center py-2 bg-white rounded-lg border-2 border-dashed border-teal">
                    <div class="text-[10px] font-bold text-text-muted uppercase">Código de acceso</div>
                    <div class="text-2xl font-black text-teal tracking-wider">{{ lockCode }}</div>
                  </div>
                  <div v-else class="text-[10px] text-text-muted text-center py-1">Sin código generado</div>
                </div>
              </div>
            </div>
          </div>
          <div class="p-5 border-t border-border bg-surface/50 shrink-0">
            <div v-if="err" class="mb-3 px-4 py-2 rounded-lg bg-coral/10 text-coral text-xs font-bold">{{ err }}</div>
            <div class="flex gap-3 justify-end">
              <button @click="modal.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
              <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">{{ saving?'Guardando...':'Guardar' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <div v-if="cfg.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="cfg.show=false">
        <div class="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
          <div class="text-3xl mb-3">{{ cfg.icon }}</div>
          <h3 class="text-lg font-black text-navy mb-2">{{ cfg.title }}</h3>
          <p class="text-sm text-text-secondary">{{ cfg.msg }}</p>
          <div class="flex gap-3 mt-6">
            <button @click="cfg.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="cfg.fn();cfg.show=false" class="flex-1 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer" :class="cfg.btn">Confirmar</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ReservationService } from '@/services/Reservation.service'
import { CompanionsService } from '@/services/Companions.service'
import { PaymentsService } from '@/services/Payments.service'
import { TTLockService } from '@/services/TTLock.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { http } from '@/services/http'

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const search = ref('')
const filterStatus = ref('')
const filterChannel = ref('')
const list = ref<any[]>([])
const rooms = ref<any[]>([])
const saving = ref(false)
const err = ref('')
const editId = ref('')

const modal = ref({ show: false, edit: false })
const expandedSections = ref<Record<string, boolean>>({ conditions: true, communications: false, whatsapp: false, services: false })
const lockCode = ref<string>('')
const form = ref({
  guestName: '', email: '', phone: '', document: '', docType: 'passport',
  checkIn: '', checkOut: '', roomId: '', adults: 2, children: 0,
  status: 'pending', source: 'direct', notes: '', otaNotes: '',
  commission: 0, commissionAmount: 0, extLocator: '',
  payMethod: 'transfer', deposit: 0,
  autoSendEnabled: true,
  companions: [] as { id?: string; name: string; doc: string; docType?: string; nationality?: string }[],
})
const cfg = ref({ show:false,icon:'',title:'',msg:'',btn:'',fn:()=>{} })

const chList = [{v:'direct',l:'Directa',i:'🏨'},{v:'booking',l:'Booking',i:'🌐'},{v:'expedia',l:'Expedia',i:'✈️'},{v:'airbnb',l:'Airbnb',i:'🏠'},{v:'google',l:'Google',i:'🔍'},{v:'whatsapp',l:'WhatsApp',i:'💬'},{v:'phone',l:'Teléfono',i:'📞'}]

const today = new Date().toISOString().split('T')[0]
const statsCards = computed(() => {
  const ti = list.value.filter((r:any)=>r.checkIn===today&&(r.status==='confirmed'||r.status==='checked_in')).length
  const to = list.value.filter((r:any)=>r.checkOut===today&&r.status==='checked_in').length
  const tr = list.value.filter((r:any)=>r.checkIn===today).reduce((s:number,r:any)=>s+(r.total||0),0)
  const all = list.value.filter((r:any)=>r.status!=='cancelled').reduce((s:number,r:any)=>s+(r.total||0),0)
  return [
    {label:'Check-ins Hoy',value:String(ti),color:'text-navy'},
    {label:'Check-outs Hoy',value:String(to),color:'text-coral'},
    {label:'Ingresos Hoy',value:'$'+tr,color:'text-teal'},
    {label:'Total Facturado',value:'$'+all,color:'text-purple'},
    {label:'Pendientes',value:String(list.value.filter((r:any)=>r.status==='pending').length),color:'text-gold'},
    {label:'Confirmadas',value:String(list.value.filter((r:any)=>r.status==='confirmed').length),color:'text-cyan'},
  ]
})
const filtered = computed(() => {
  let l = list.value
  if(search.value){const q=search.value.toLowerCase();l=l.filter((r:any)=>(r.guestName||'').toLowerCase().includes(q)||(r.email||'').toLowerCase().includes(q))}
  if(filterStatus.value) l=l.filter((r:any)=>r.status===filterStatus.value)
  if(filterChannel.value) l=l.filter((r:any)=>r.source===filterChannel.value)
  return l
})
const selRoom = computed(() => rooms.value.find((r:any)=>r.id===form.value.roomId))
const nights = computed(()=>{if(!form.value.checkIn||!form.value.checkOut)return 0;return Math.max(1,Math.round((new Date(form.value.checkOut).getTime()-new Date(form.value.checkIn).getTime())/86400000))})
const taxes = computed(()=>selRoom.value?Math.round(selRoom.value.basePrice*nights.value*0.1):0)
const total = computed(()=>selRoom.value?selRoom.value.basePrice*nights.value+taxes.value:0)
const pend = computed(()=>Math.max(0,total.value-(form.value.deposit||0)))

function fmtDate(d:string){return new Date(d+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}
function stLabel(s:string){const m:any={pending:'Pendiente',confirmed:'Confirmada',checked_in:'Check-in',checked_out:'Check-out',cancelled:'Cancelada'};return m[s]||s}
function stClass(s:string){const m:any={pending:'bg-gold/10 text-gold',confirmed:'bg-teal/10 text-teal',checked_in:'bg-cyan/10 text-cyan',checked_out:'bg-gray-100 text-gray-500',cancelled:'bg-coral/10 text-coral'};return m[s]||''}
function stBtn(s:string){const m:any={pending:'border-gold bg-gold/10 text-gold',confirmed:'border-blue-500 bg-blue-50 text-blue-700',checked_in:'border-teal bg-teal/10 text-teal',cancelled:'border-coral bg-coral/10 text-coral'};return m[s]||''}
function srcLabel(s:string){const m:any={direct:'Directa',booking:'Booking',expedia:'Expedia',airbnb:'Airbnb',google:'Google',whatsapp:'WhatsApp',phone:'Teléfono'};return m[s]||s}
function srcClass(s:string){const m:any={direct:'bg-teal/10 text-teal',booking:'bg-cyan/10 text-cyan',expedia:'bg-gold/10 text-gold',airbnb:'bg-coral/10 text-coral',google:'bg-blue-100 text-blue-700',whatsapp:'bg-emerald-100 text-emerald-700'};return m[s]||'bg-gray-100 text-gray-500'}

async function load(){
  try{
    const[{RoomService},{GuestService}]=await Promise.all([import('@/services/Room.service'),import('@/services/Guest.service')])
    const[res,rom,gst]=await Promise.all([ReservationService.list({hotelId:hid.value}).catch(()=>({reservations:[],total:0})),RoomService.list({hotelId:hid.value}).catch(()=>({rooms:[],total:0})),GuestService.list({hotelId:hid.value}).catch(()=>({guests:[],total:0}))])
    rooms.value=rom.rooms||[]
    const rm=new Map(rooms.value.map((r:any)=>[r.id,r]))
    const gm=new Map((gst.guests||[]).map((g:any)=>[g.id,g]))
    list.value=(res.reservations||[]).map((r:any)=>{const room=rm.get(r.roomId);const guest=gm.get(r.guestId);return{id:r.id,guestName:guest?.name||guest?.firstName||'Guest',email:guest?.email||'',roomNumber:room?.number||r.roomNumber||'—',roomId:r.roomId,guestId:r.guestId,checkIn:String(r.checkIn||'').slice(0,10),checkOut:String(r.checkOut||'').slice(0,10),nights:nBetween(r.checkIn,r.checkOut),status:r.status,source:r.source,total:r.totalAmount,adults:r.adults,children:r.children,notes:r.notes||''}})
  }catch{}
}
function nBetween(a?:string,b?:string):number{if(!a||!b)return 0;return Math.max(1,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000))}

function openNew() {
  editId.value = ''
  err.value = ''
  lockCode.value = ''
  form.value = {
    guestName: '', email: '', phone: '', document: '', docType: 'passport',
    checkIn: '', checkOut: '', roomId: '', adults: 2, children: 0,
    status: 'pending', source: 'direct', notes: '', otaNotes: '',
    commission: 0, commissionAmount: 0, extLocator: '',
    payMethod: 'transfer', deposit: 0, autoSendEnabled: true,
    companions: [],
  }
  modal.value = { show: true, edit: false }
}

async function openEdit(r: any) {
  editId.value = r.id
  err.value = ''
  lockCode.value = ''
  form.value = {
    guestName: r.guestName || '', email: r.email || '', phone: r.phone || '',
    document: r.document || '', docType: r.docType || 'passport',
    checkIn: r.checkIn, checkOut: r.checkOut, roomId: r.roomId || '',
    adults: r.adults || 2, children: r.children || 0,
    status: r.status, source: r.source || 'direct',
    notes: r.notes || '', otaNotes: r.otaNotes || '',
    commission: r.commission || 0, commissionAmount: r.commissionAmount || 0,
    extLocator: r.extLocator || r.externalLocator || '',
    payMethod: r.payMethod || r.paymentMethod || 'transfer',
    deposit: r.deposit || 0, autoSendEnabled: r.autoSendEnabled !== false,
    companions: [],
  }
  modal.value = { show: true, edit: true }

  // Cargar datos extendidos de la reserva (companions, lockCode, OTA)
  try {
    const ext = await http.get<any>(`/reservations/${r.id}`)
    form.value.companions = (ext.companions || []).map((c: any) => ({
      id: c.id, name: c.name || '', doc: c.documentNumber || '',
      docType: c.documentType, nationality: c.nationality,
    }))
    if (ext.lockCodes?.length) {
      lockCode.value = ext.lockCodes[0].code || ''
    }
  } catch { /* silencioso */ }
}

async function save() {
  if (!form.value.guestName || !form.value.checkIn || !form.value.checkOut) {
    err.value = 'Completa los campos obligatorios'
    return
  }
  saving.value = true
  err.value = ''
  try {
    const payload: any = {
      roomId: form.value.roomId,
      checkIn: form.value.checkIn,
      checkOut: form.value.checkOut,
      channel: form.value.source,
      source: form.value.source,
      totalAmount: total.value,
      status: form.value.status,
      notes: form.value.notes,
      otaNotes: form.value.otaNotes,
      commission: form.value.commission,
      commissionAmount: form.value.commissionAmount,
      externalLocator: form.value.extLocator,
      paymentMethod: form.value.payMethod,
      deposit: form.value.deposit,
      autoSendEnabled: form.value.autoSendEnabled ? 1 : 0,
      adults: form.value.adults,
      children: form.value.children,
    }

    if (editId.value) {
      // Update reserva
      await ReservationService.update(editId.value, payload as any)
      // Sincronizar companions (diff simple)
      const existing = await CompanionsService.listByReservation(editId.value)
      const existingIds = new Set(existing.data.map(c => c.id).filter((id): id is string => Boolean(id)))
      for (const c of form.value.companions) {
        if (c.id && existingIds.has(c.id)) {
          await CompanionsService.update(c.id, {
            name: c.name, documentNumber: c.doc,
            documentType: c.docType, nationality: c.nationality,
          })
          existingIds.delete(c.id)
        } else {
          await CompanionsService.create(editId.value, {
            name: c.name, documentNumber: c.doc,
            documentType: c.docType || 'passport', nationality: c.nationality,
          })
        }
      }
      // Borrar los que ya no están
      for (const id of existingIds) {
        await CompanionsService.remove(id)
      }
    } else {
      const created: any = await ReservationService.create({
        hotelId: hid.value!,
        roomId: form.value.roomId,
        checkIn: form.value.checkIn,
        checkOut: form.value.checkOut,
        channel: form.value.source,
        source: form.value.source,
        totalAmount: total.value,
        status: 'confirmed',
        ...payload,
      } as any)
      const newId = created?.id || created?.reservationId
      if (newId) {
        for (const c of form.value.companions) {
          if (c.name) {
            await CompanionsService.create(newId, {
              name: c.name, documentNumber: c.doc,
              documentType: c.docType || 'passport', nationality: c.nationality,
            })
          }
        }
      }
    }
    modal.value.show = false
    await load()
  } catch (e: any) {
    err.value = e.message || 'Error'
  }
  saving.value = false
}

async function generateLockCode() {
  if (!editId.value) {
    toast.error('Guarda la reserva primero')
    return
  }
  try {
    const code = await TTLockService.generateCode(editId.value)
    lockCode.value = code.code || ''
    toast.success(`Código generado: ${lockCode.value}`)
  } catch (e: any) {
    toast.error(e.message || 'Sin cerradura asignada a esta habitación')
  }
}

async function createPaymentRequest() {
  if (!editId.value) { toast.error('Guarda la reserva primero'); return }
  if (pend.value <= 0) { toast.info('Sin monto pendiente'); return }
  try {
    await PaymentsService.create({
      reservationId: editId.value,
      amount: pend.value,
      sentTo: form.value.email,
      sentVia: 'email',
    })
    toast.success('Requerimiento de pago creado')
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

function confirmAction(type:string,r:any){
  if(type==='checkin'){cfg.value={show:true,icon:'🛎️',title:'¿Check-in?',msg:`${r.guestName} — Hab. ${r.roomNumber} — ${r.checkIn}`,btn:'bg-teal',fn:()=>doCheckin(r)}}
  else{cfg.value={show:true,icon:'⚠️',title:'¿Cancelar?',msg:`${r.guestName} — Hab. ${r.roomNumber} — $${r.total}`,btn:'bg-coral',fn:()=>doCancel(r)}}
}
async function doCheckin(r:any){try{await ReservationService.update(r.id,{status:'checked_in'}as any);await load();toast.success('Check-in')}catch{toast.error('Error')}}
async function doCancel(r:any){try{await ReservationService.update(r.id,{status:'cancelled'}as any);await load();toast.success('Cancelada')}catch{toast.error('Error')}}

function sendPayLink(ch:string){
  const g=form.value.guestName;const a=pend.value;const e=form.value.email;const p=form.value.phone
  if(ch==='email'&&e){window.open(`mailto:${e}?subject=${encodeURIComponent('Pago pendiente - '+g)}&body=${encodeURIComponent('Hola '+g+', tu reserva tiene $'+a+' pendientes. Paga aquí: [link]')}`);toast.success('Email abierto')}
  else if(ch==='whatsapp'&&p){window.open(`https://wa.me/${p.replace(/\D/g,'')}?text=${encodeURIComponent('Hola '+g+', pago pendiente: $'+a)}`);toast.success('WhatsApp abierto')}
  else{toast.error('Falta email/teléfono')}
}

onMounted(load)
</script>
