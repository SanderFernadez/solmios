<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-black text-navy">Habitaciones</h2>
      <div class="flex gap-2">
        <select v-model="activeFilter" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
          <option value="all">Todas</option>
          <option value="available">Disponibles</option>
          <option value="occupied">Ocupadas</option>
          <option value="cleaning">Limpieza</option>
          <option value="dirty">Sucias</option>
          <option value="out_of_service">F/S</option>
        </select>
        <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Nueva</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-6 gap-3 mb-6">
      <div v-for="s in stats" :key="s.label" class="card p-3 text-center">
        <div class="text-lg font-black" :class="s.color">{{ s.value }}</div>
        <div class="text-[9px] text-text-muted font-bold uppercase">{{ s.label }}</div>
      </div>
    </div>

    <!-- Table by Type Groups -->
    <div v-for="rt in roomTypes" :key="rt.type" class="mb-6">
      <div class="flex items-center gap-3 mb-3 px-1">
        <div class="w-3 h-3 rounded" :class="rt.dot"></div>
        <h3 class="text-sm font-black text-navy">{{ rt.type }}</h3>
        <span class="text-[10px] text-text-muted">({{ rt.rooms.length }})</span>
        <span class="text-[10px] font-bold text-teal ml-2">{{ rt.available }} disponibles</span>
        <span class="text-[10px] font-bold text-coral ml-2">{{ rt.occupied }} ocupadas</span>
      </div>
      <div class="bg-white rounded-2xl border border-border overflow-hidden">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
          <div v-for="room in rt.rooms" :key="room.id" @click="openEdit(room)"
            class="rounded-xl border-2 p-4 cursor-pointer hover:shadow-lg transition-all"
            :class="roomCardClass(room.status)">
            <div class="flex items-center justify-between mb-2">
              <span class="text-lg font-black text-navy">{{ room.number }}</span>
              <span class="w-3 h-3 rounded-full" :class="statusDot(room.status)"></span>
            </div>
            <div class="text-[10px] text-text-muted uppercase font-bold mb-2">{{ statusLabel(room.status) }}</div>
            <div class="flex items-center gap-2 text-sm">
              <span class="font-bold text-navy">${{ room.basePrice }}</span>
              <span class="text-text-muted">/noche</span>
            </div>
            <div class="flex items-center gap-1 mt-2 text-[9px] text-text-muted">
              <span>{{ room.maxGuests }}p máx</span>
              <span>·</span>
              <span>Piso {{ room.floor }}</span>
            </div>
            <div class="flex flex-wrap gap-1 mt-2">
              <span v-for="a in (room.amenities||[]).slice(0,4)" :key="a" class="px-1.5 py-0.5 bg-surface rounded text-[8px] text-text-secondary">{{ a }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="modal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div class="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="text-lg font-black text-navy">{{ modal.edit ? 'Editar' : 'Nueva' }} Habitación</h3>
            <button @click="modal.show=false" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center cursor-pointer">✕</button>
          </div>
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-3 gap-4">
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Número *</label><input v-model="form.number" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Tipo</label>
                <select v-model="form.type" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="single">Single</option><option value="double">Double</option><option value="suite">Suite</option><option value="family">Family</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Estado</label>
                <select v-model="form.status" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="available">Disponible</option><option value="occupied">Ocupada</option><option value="cleaning">Limpieza</option><option value="dirty">Sucia</option><option value="out_of_service">F/S</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Piso</label><input v-model.number="form.floor" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Capacidad</label><input v-model.number="form.maxGuests" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Precio Base $</label><input v-model.number="form.basePrice" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Superficie m²</label><input v-model.number="form.surfaceArea" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Baños</label><input v-model.number="form.bathrooms" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 cursor-pointer bg-surface rounded-xl p-3 w-full">
                  <input v-model="form.onlineBooking" type="checkbox" class="w-4 h-4 rounded text-cyan" />
                  <span class="text-[11px] font-bold text-navy">Venta Online</span>
                </label>
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase mb-2">Amenities</label>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-2 bg-surface rounded-xl p-3">
                <label v-for="cat in amenityCats" :key="cat.key" class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" :value="cat.key" v-model="form.amenities" class="w-3.5 h-3.5 rounded text-cyan" />
                  <span class="text-xs text-navy">{{ cat.label }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="p-5 border-t border-border bg-surface/50 flex gap-3 justify-end sticky bottom-0">
            <button v-if="modal.edit" @click="deleteRoom" class="px-5 py-2.5 border border-coral/30 text-coral rounded-xl text-sm font-bold cursor-pointer mr-auto">🗑️ Eliminar</button>
            <button @click="modal.show=false" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="save" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">{{ saving?'Guardando...':'Guardar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeFilter = ref('all')
const rooms = ref<any[]>([])
const saving = ref(false)
const editId = ref('')
const modal = ref({ show: false, edit: false })

const form = ref({ number:'', type:'double', floor:1, maxGuests:2, basePrice:80, status:'available', amenities:[] as string[], surfaceArea:0, bathrooms:1, onlineBooking:true })

const amenityCats = [
  { key:'ac', label:'Aire Acond.' },{ key:'heating', label:'Calefacción' },{ key:'wifi', label:'WiFi' },
  { key:'tv', label:'TV' },{ key:'safe', label:'Caja Fuerte' },{ key:'minibar', label:'Minibar' },
  { key:'kitchen', label:'Cocina' },{ key:'fridge', label:'Nevera' },{ key:'microwave', label:'Microondas' },
  { key:'coffee_maker', label:'Cafetera' },{ key:'washer', label:'Lavadora' },{ key:'dishwasher', label:'Lavavajillas' },
  { key:'hair_dryer', label:'Secador' },{ key:'iron', label:'Plancha' },{ key:'balcony', label:'Balcón' },
  { key:'bathtub', label:'Bañera' },{ key:'work_desk', label:'Escritorio' },
]

const stats = computed(() => [
  { label:'Total', value:rooms.value.length, color:'text-navy' },
  { label:'Disp.', value:rooms.value.filter(r=>r.status==='available').length, color:'text-teal' },
  { label:'Ocup.', value:rooms.value.filter(r=>r.status==='occupied').length, color:'text-coral' },
  { label:'Limpieza', value:rooms.value.filter(r=>r.status==='cleaning').length, color:'text-cyan' },
  { label:'Sucias', value:rooms.value.filter(r=>r.status==='dirty').length, color:'text-gold' },
  { label:'F/S', value:rooms.value.filter(r=>r.status==='out_of_service').length, color:'text-gray-400' },
])

const DOT: Record<string,string> = { single:'bg-teal', double:'bg-cyan', suite:'bg-gold', family:'bg-purple' }
const roomTypes = computed(() => {
  let list = rooms.value
  if(activeFilter.value!=='all') list = list.filter(r => r.status === activeFilter.value)
  const g: Record<string,any[]> = {}
  for(const r of list) { const t=r.type||'double'; if(!g[t]) g[t]=[]; g[t].push(r) }
  return Object.entries(g).map(([t,rooms])=>({
    type: t.charAt(0).toUpperCase()+t.slice(1), dot: DOT[t]||'bg-cyan',
    available: rooms.filter((r:any)=>r.status==='available').length,
    occupied: rooms.filter((r:any)=>r.status==='occupied').length, rooms,
  }))
})

function roomCardClass(s:string) {
  const m: Record<string,string> = { available:'border-teal/20 bg-teal/[0.02]', occupied:'border-coral/20 bg-coral/[0.02]', cleaning:'border-cyan/20 bg-cyan/[0.02]', dirty:'border-gold/20 bg-gold/[0.02]', out_of_service:'border-gray-200 bg-gray-50' }
  return m[s]||'border-border'
}
function statusDot(s:string) { const m:any={ available:'bg-teal', occupied:'bg-coral', cleaning:'bg-cyan', dirty:'bg-gold', out_of_service:'bg-gray-400' }; return m[s]||'bg-gray-300' }
function statusLabel(s:string) { const m:any={ available:'Disponible', occupied:'Ocupada', cleaning:'En Limpieza', dirty:'Sucia', out_of_service:'Fuera de Servicio' }; return m[s]||s }

async function load() {
  try {
    const { RoomService } = await import('@/services/Room.service')
    const res = await RoomService.list({ hotelId: hid.value }).catch(()=>({ rooms:[], total:0 }))
    rooms.value = (res.rooms||[]).map((r:any)=>({
      id:r.id, number:r.number, type:r.type, floor:r.floor||1, status:r.status||'available',
      maxGuests:r.maxGuests||r.capacity||2, basePrice:r.basePrice||0,
      amenities:(r.amenities||[]), surfaceArea:r.surfaceArea||0, bathrooms:r.bathrooms||1,
      onlineBooking:r.onlineBookingEnabled!==false,
    }))
  } catch {}
}

function openNew() {
  editId.value=''; modal.value={show:true,edit:false}
  form.value={ number:'',type:'double',floor:1,maxGuests:2,basePrice:80,status:'available',amenities:[],surfaceArea:0,bathrooms:1,onlineBooking:true }
}
function openEdit(room:any) {
  editId.value=room.id; modal.value={show:true,edit:true}
  form.value={ number:room.number,type:room.type,floor:room.floor||1,maxGuests:room.maxGuests||2,basePrice:room.basePrice||0,status:room.status||'available',amenities:[...((room.amenities||[]))],surfaceArea:room.surfaceArea||0,bathrooms:room.bathrooms||1,onlineBooking:room.onlineBooking!==false }
}
async function save() {
  if(!form.value.number){ toast.error('Falta número'); return }
  saving.value=true
  try {
    const { RoomService } = await import('@/services/Room.service')
    const patch: any = { number:form.value.number, type:form.value.type, floor:form.value.floor, maxGuests:form.value.maxGuests, basePrice:form.value.basePrice, status:form.value.status, amenities:form.value.amenities, surfaceArea:form.value.surfaceArea, bathrooms:form.value.bathrooms, onlineBookingEnabled:form.value.onlineBooking }
    if(editId.value) { await RoomService.update(editId.value, patch) }
    else { await RoomService.create({ ...patch, hotelId: hid.value! }) }
    toast.success(editId.value?'Actualizada':'Creada')
  } catch { toast.error('Error') }
  saving.value=false; modal.value.show=false; await load()
}

async function deleteRoom() {
  if (!confirm(`¿Eliminar habitación ${form.value.number}?`)) return
  try {
    const { RoomService } = await import('@/services/Room.service')
    await RoomService.delete(editId.value)
    toast.success('Eliminada')
    modal.value.show = false
    await load()
  } catch { toast.error('Error al eliminar') }
}

onMounted(load)
</script>
