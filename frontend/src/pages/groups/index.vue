<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Grupos & Blocks</h2>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex gap-2">
        <button
          v-for="view in views"
          :key="view.value"
          @click="activeView = view.value"
          class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
          :class="activeView === view.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
        >
          {{ view.label }}
        </button>
      </div>
      <button @click="openNewGroup" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        + Nuevo Grupo
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
        <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Lista de Grupos -->
    <div v-if="activeView === 'list'" class="space-y-4">
      <div v-for="group in groups" :key="group.id" class="bg-white rounded-2xl border border-border card-shadow p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-black text-navy">{{ group.name }}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(group.status)">
                {{ group.status }}
              </span>
            </div>
            <div class="text-sm text-text-muted">{{ group.contact }} — {{ group.company }}</div>
          </div>
          <div class="flex gap-2">
            <button @click.stop="openViewGroup(group)" class="px-3 py-1.5 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver Detalles</button>
            <button @click.stop="openEditGroup(group)" class="px-3 py-1.5 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
          </div>
        </div>

        <div class="grid grid-cols-5 gap-4 mb-4">
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Fechas</div>
            <div class="text-sm font-bold">{{ group.checkIn }} — {{ group.checkOut }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Noches</div>
            <div class="text-sm font-bold">{{ group.nights }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Habitaciones</div>
            <div class="text-sm font-bold">{{ group.rooms }} habitaciones</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Huéspedes</div>
            <div class="text-sm font-bold">{{ group.guests }} personas</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Total</div>
            <div class="text-sm font-black text-navy">${{ group.total.toLocaleString() }}</div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-border">
          <div class="flex gap-2">
            <span v-for="tag in group.tags" :key="tag" class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted">
              {{ tag }}
            </span>
          </div>
          <div class="text-[10px] text-text-muted">
            Deposits: ${{ group.deposit.toLocaleString() }} / Restante: ${{ (group.total - group.deposit).toLocaleString() }}
          </div>
        </div>
      </div>
    </div>

    <!-- Calendar View -->
    <div v-else class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between">
        <button @click="prevWeek" class="px-3 py-1 bg-surface rounded-lg text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">← Anterior</button>
        <h3 class="text-sm font-black text-navy">{{ currentWeekLabel }}</h3>
        <button @click="nextWeek" class="px-3 py-1 bg-surface rounded-lg text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Siguiente →</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[800px]">
          <thead>
            <tr class="border-b border-border">
              <th class="p-3 text-[10px] font-bold text-text-muted uppercase text-left w-40">Grupo</th>
              <th v-for="day in weekDays" :key="day.date" class="p-3 text-[10px] font-bold text-text-muted uppercase text-center">
                {{ day.label }}
                <div class="text-text-secondary font-normal">{{ day.date }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.id" class="border-b border-border last:border-0">
              <td class="p-3">
                <div class="text-sm font-bold text-navy">{{ group.name }}</div>
                <div class="text-[10px] text-text-muted">{{ group.rooms }} hab.</div>
              </td>
              <td v-for="day in weekDays" :key="day.date" class="p-1">
                <div
                  v-if="isGroupActive(group, day.date)"
                  class="h-10 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-pointer"
                  :class="getGroupDayClass(group, day.date)"
                >
                  {{ group.rooms }} Hab
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Ver Grupo -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showViewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-2xl card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Detalle del Grupo</h3>
          <button @click="showViewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="flex items-center gap-3 mb-6">
            <h2 class="text-xl font-black text-navy">{{ selectedGroup.name }}</h2>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(selectedGroup.status)">
              {{ selectedGroup.status }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 class="text-sm font-black text-navy mb-3">Información del Contacto</h4>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Nombre:</span>
                  <span class="font-bold">{{ selectedGroup.contact }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Empresa:</span>
                  <span class="font-bold">{{ selectedGroup.company }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Teléfono:</span>
                  <span class="font-bold">{{ selectedGroup.phone }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Email:</span>
                  <span class="font-bold">{{ selectedGroup.email }}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 class="text-sm font-black text-navy mb-3">Detalles de la Reserva</h4>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Check-in:</span>
                  <span class="font-bold">{{ selectedGroup.checkIn }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Check-out:</span>
                  <span class="font-bold">{{ selectedGroup.checkOut }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Noches:</span>
                  <span class="font-bold">{{ selectedGroup.nights }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Habitaciones:</span>
                  <span class="font-bold">{{ selectedGroup.rooms }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-surface rounded-xl p-4 mb-4">
            <h4 class="text-sm font-black text-navy mb-3">Desglose de Costos</h4>
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">{{ selectedGroup.rooms }} hab. × {{ selectedGroup.nights }} noches × ${{ selectedGroup.rate }}</span>
                <span class="font-bold">${{ (selectedGroup.rooms * selectedGroup.nights * selectedGroup.rate).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Impuestos (18%)</span>
                <span class="font-bold">${{ Math.round(selectedGroup.total * 0.18).toLocaleString() }}</span>
              </div>
              <div class="border-t border-border pt-2 flex justify-between text-sm font-bold">
                <span class="text-navy">Total</span>
                <span class="text-navy">${{ selectedGroup.total.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="bg-surface rounded-xl p-4">
              <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Depósito Recibido</div>
              <div class="text-lg font-black text-teal">${{ selectedGroup.deposit.toLocaleString() }}</div>
            </div>
            <div class="bg-surface rounded-xl p-4">
              <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Pendiente de Pago</div>
              <div class="text-lg font-black text-orange">${{ (selectedGroup.total - selectedGroup.deposit).toLocaleString() }}</div>
            </div>
          </div>

          <div v-if="selectedGroup.notes" class="mt-4 bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Notas</div>
            <div class="text-sm text-text-secondary">{{ selectedGroup.notes }}</div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showViewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Exportar PDF</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nuevo Grupo -->
    <div v-if="showNewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showNewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-2xl card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Nuevo Grupo / Block</h3>
          <button @click="showNewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre del Grupo *</label>
              <input v-model="newGroup.name" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Ej: Conferencia Tech Summit 2026">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Contacto *</label>
              <input v-model="newGroup.contact" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Nombre del contacto">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Empresa</label>
              <input v-model="newGroup.company" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Nombre de la empresa">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Teléfono</label>
              <input v-model="newGroup.phone" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="+1 234 567 890">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Email</label>
              <input v-model="newGroup.email" type="email" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="email@empresa.com">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Fecha Check-in *</label>
              <input v-model="newGroup.checkIn" type="date" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Fecha Check-out *</label>
              <input v-model="newGroup.checkOut" type="date" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Habitaciones *</label>
              <input v-model.number="newGroup.rooms" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="10">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Tarifa por Noche *</label>
              <input v-model.number="newGroup.rate" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="150">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Depósito</label>
              <input v-model.number="newGroup.deposit" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="0">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Tipo de Evento</label>
              <select v-model="newGroup.eventType" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option value="Conferencia">Conferencia</option>
                <option value="Boda">Boda</option>
                <option value="Corporativo">Corporativo</option>
                <option value="Turismo Grupal">Turismo Grupal</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Notas</label>
              <textarea v-model="newGroup.notes" rows="3" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Instrucciones especiales, requerimientos..."></textarea>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showNewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="createGroup" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Crear Grupo</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeView = ref('list')
const showViewModal = ref(false)
const showNewModal = ref(false)
const selectedGroup = ref<any>({})

const views = [
  { label: 'Lista', value: 'list' },
  { label: 'Calendario', value: 'calendar' }
]

const groups = ref<any[]>([])

const stats = computed(() => {
  const g = groups.value
  const rooms = g.reduce((s: number, x: any) => s + (x.rooms ?? 0), 0)
  const total = g.reduce((s: number, x: any) => s + (x.total ?? 0), 0)
  const pend = g.filter((x: any) => x.status === 'Pendiente').length
  return [
    { label: 'Grupos Activos', value: g.length, color: 'text-navy' },
    { label: 'Habitaciones Bloqueadas', value: rooms, color: 'text-cyan' },
    { label: 'Ingresos Potenciales', value: `$${total.toLocaleString()}`, color: 'text-teal' },
    { label: 'Pendiente Confirmar', value: pend, color: 'text-orange' },
  ]
})

async function loadData() {
  try {
    const { data } = await OperationsService.grupos.list(hotelId.value)
    groups.value = data.map((g: any) => {
      const ci = String(g.checkIn || '').slice(5, 10)
      const co = String(g.checkOut || '').slice(5, 10)
      const nights = ci && co ? Math.ceil((new Date(g.checkOut).getTime() - new Date(g.checkIn).getTime()) / 86400000) : 0
      const rate = g.totalRooms ? Math.round(g.totalAmount / Math.max(g.totalRooms, 1) / Math.max(nights, 1)) : 0
      return {
        id: g.id, name: g.name || g.nombre, contact: '', company: '', phone: '', email: '',
        checkIn: ci, checkOut: co, nights, rooms: g.totalRooms, guests: (g.totalRooms ?? 0) * 2,
        rate, total: g.totalAmount, deposit: 0, status: g.status || 'pending',
        tags: [], notes: g.notes || '',
      }
    })
  } catch { }
}
onMounted(loadData)

const newGroup = ref({
  name: '',
  contact: '',
  company: '',
  phone: '',
  email: '',
  checkIn: '',
  checkOut: '',
  rooms: 1,
  rate: 150,
  deposit: 0,
  eventType: '',
  notes: ''
})

const currentWeek = ref(new Date())
const currentWeekLabel = computed(() => {
  const start = new Date(currentWeek.value)
  start.setDate(start.getDate() - start.getDay() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.getDate()} ${start.toLocaleString('es', { month: 'short' })} — ${end.getDate()} ${end.toLocaleString('es', { month: 'short' })}`
})

const weekDays = computed(() => {
  const start = new Date(currentWeek.value)
  start.setDate(start.getDate() - start.getDay() + 1)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return {
      label: date.toLocaleString('es', { weekday: 'short' }),
      date: `${date.getDate()}/${date.getMonth() + 1}`
    }
  })
})

const prevWeek = () => {
  const d = new Date(currentWeek.value)
  d.setDate(d.getDate() - 7)
  currentWeek.value = d
}

const nextWeek = () => {
  const d = new Date(currentWeek.value)
  d.setDate(d.getDate() + 7)
  currentWeek.value = d
}

const isGroupActive = (group: any, day: string) => {
  if (!group.checkIn || !group.checkOut || !day) return false
  const d = new Date(day).getTime()
  const ci = new Date(group.checkIn).getTime()
  const co = new Date(group.checkOut).getTime()
  return d >= ci && d <= co
}

const getGroupDayClass = (group: any, day: string) => {
  const s = String(group.status).toLowerCase()
  if (s === 'confirmado' || s === 'confirmed') return 'bg-teal/20 text-teal'
  if (s === 'pendiente' || s === 'pending') return 'bg-orange/20 text-orange'
  return 'bg-gray-100 text-gray-500'
}

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    'Confirmado': 'bg-teal/10 text-teal',
    'Pendiente': 'bg-orange/10 text-orange',
    'Cancelado': 'bg-red/10 text-red'
  }
  return classes[status] || 'bg-surface text-text-muted'
}

const openViewGroup = (group: any) => {
  selectedGroup.value = group
  showViewModal.value = true
}

const openNewGroup = () => {
  newGroup.value = { name: '', contact: '', company: '', phone: '', email: '', checkIn: '', checkOut: '', rooms: 1, rate: 150, deposit: 0, eventType: '', notes: '' }
  showNewModal.value = true
}

const openEditGroup = (group: any) => {
  selectedGroup.value = group
  showNewModal.value = true
}

const createGroup = async () => {
  if (!newGroup.value.name) return
  try {
    const nights = Math.ceil((new Date(newGroup.value.checkOut || Date.now()).getTime() - new Date(newGroup.value.checkIn || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
    await OperationsService.grupos.create({
      name: newGroup.value.name,
      hotelId: hotelId.value,
      totalRooms: newGroup.value.rooms || 1,
      checkIn: newGroup.value.checkIn,
      checkOut: newGroup.value.checkOut,
      status: 'pendiente',
      totalAmount: (newGroup.value.rooms || 1) * (nights > 0 ? nights : 1) * (newGroup.value.rate || 0),
      notes: newGroup.value.email ? `Contacto: ${newGroup.value.contact} / ${newGroup.value.email}` : '',
    })
    showNewModal.value = false
    await loadData()
  } catch { toast.error('Error al crear grupo') }
}
</script>
