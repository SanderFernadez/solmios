<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Mantenimiento</h2>

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
        <div class="w-px bg-border mx-2"></div>
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          @click="activeFilter = filter.value"
          class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
          :class="activeFilter === filter.value ? 'bg-navy/10 text-navy' : 'text-text-secondary hover:bg-surface'"
        >
          {{ filter.label }}
        </button>
      </div>
      <button @click="openNewOrder" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
        + Nueva Orden
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-5 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
        <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Board View -->
    <div v-if="activeView === 'board'" class="grid grid-cols-4 gap-4">
      <div v-for="column in kanbanColumns" :key="column.id"
        class="bg-surface rounded-xl p-4 min-h-[300px] transition-all"
        :class="dragOverCol === column.id ? 'ring-2 ring-navy bg-navy/5' : ''"
        @dragover.prevent="dragOverCol = column.id"
        @dragleave="dragOverCol = null"
        @drop.prevent="onDrop($event, column.id)">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" :class="column.dotColor"></span>
            <h3 class="text-sm font-black text-navy">{{ column.title }}</h3>
          </div>
          <span class="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted border border-border">
            {{ getColumnOrders(column.id).length }}
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="order in getColumnOrders(column.id)"
            :key="order.id"
            draggable="true"
            @dragstart="onDragStart($event, order)"
            @dragend="dragOverCol = null; draggedOrder = null"
            @click="openViewOrder(order)"
            class="bg-white rounded-xl p-4 border border-border border-l-4 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing"
            :class="[draggedOrder?.id === order.id ? 'opacity-50' : '', catBorder(order.category)]">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="priorityClass(order.priority)">
                {{ order.priority }}
              </span>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(order.category)">
                {{ order.category }}
              </span>
            </div>
            <div class="text-sm font-black text-navy mb-1">{{ order.title }}</div>
            <div class="text-[11px] text-text-secondary mb-3">{{ order.location }}</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" :class="staffColor(order.assignedTo)">
                  <span>{{ getInitials(order.assignedTo) }}</span>
                </div>
                <span class="text-[10px] font-medium text-navy">{{ order.assignedTo }}</span>
              </div>
              <span class="text-[10px] text-text-muted">{{ order.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">ID</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Título</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Ubicación</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Prioridad</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Asignado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer">
            <td class="p-4 text-sm font-mono text-text-muted">#{{ order.id }}</td>
            <td class="p-4 text-sm font-bold text-navy">{{ order.title }}</td>
            <td class="p-4 text-sm">{{ order.location }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="categoryClass(order.category)">
                {{ order.category }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(order.priority)">
                {{ order.priority }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(order.status)">
                {{ statusLabel(order.status) }}
              </span>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center">
                  <span class="text-[9px] font-bold text-navy">{{ getInitials(order.assignedTo) }}</span>
                </div>
                <span class="text-sm">{{ order.assignedTo }}</span>
              </div>
            </td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click.stop="openViewOrder(order)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click.stop="openEditOrder(order)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
                <button @click.stop="openStatusModal(order)" class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cambiar Estado</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Ver Orden -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showViewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Detalle de Orden</h3>
          <button @click="showViewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="flex items-center gap-3 mb-6">
            <span class="text-sm font-mono text-text-muted">#{{ selectedOrder.id }}</span>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(selectedOrder.status)">
              {{ statusLabel(selectedOrder.status) }}
            </span>
            <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(selectedOrder.priority)">
              {{ selectedOrder.priority }}
            </span>
          </div>
          <div class="text-lg font-black text-navy mb-4">{{ selectedOrder.title }}</div>
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Ubicación</div>
              <div class="text-sm">{{ selectedOrder.location }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Categoría</div>
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="categoryClass(selectedOrder.category)">
                {{ selectedOrder.category }}
              </span>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Asignado a</div>
              <div class="text-sm font-bold">{{ selectedOrder.assignedTo }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Fecha Reporte</div>
              <div class="text-sm">{{ selectedOrder.date }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Costo Estimado</div>
              <div class="text-sm font-bold text-navy">${{ selectedOrder.estimatedCost }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Tiempo Estimado</div>
              <div class="text-sm">{{ selectedOrder.estimatedTime }}</div>
            </div>
          </div>
          <div class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Descripción</div>
            <div class="text-sm text-text-secondary">{{ selectedOrder.description }}</div>
          </div>
          <div v-if="selectedOrder.notes" class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Notas del Técnico</div>
            <div class="text-sm text-text-secondary">{{ selectedOrder.notes }}</div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showViewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button @click="completeOrder(selectedOrder)" class="flex-1 py-2.5 bg-cyan text-navy rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Marcar Completa</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nueva Orden -->
    <div v-if="showNewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showNewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Nueva Orden de Mantenimiento</h3>
          <button @click="showNewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Título *</label>
              <input v-model="newOrder.title" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Ej: Aire acondicionado no funciona">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Ubicación *</label>
              <select v-model="newOrder.location" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option value="Hab 101">Hab 101</option>
                <option value="Hab 102">Hab 102</option>
                <option value="Hab 201">Hab 201</option>
                <option value="Lobby">Lobby</option>
                <option value="Restaurante">Restaurante</option>
                <option value="Piscina">Piscina</option>
                <option value="Estacionamiento">Estacionamiento</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Categoría *</label>
              <select v-model="newOrder.category" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option value="Eléctrico">Eléctrico</option>
                <option value="Plomería">Plomería</option>
                <option value="Aire Acondicionado">Aire Acondicionado</option>
                <option value="Carpintería">Carpintería</option>
                <option value="Pintura">Pintura</option>
                <option value="Electrónica">Electrónica</option>
                <option value="Limpieza">Limpieza</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Prioridad *</label>
              <select v-model="newOrder.priority" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="Baja">Baja</option>
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Asignar a *</label>
              <select v-model="newOrder.assignedTo" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option v-for="tech in maintenanceStaff" :key="tech.id" :value="tech.name">{{ tech.name }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Descripción *</label>
              <textarea v-model="newOrder.description" rows="3" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Describa el problema detalladamente..."></textarea>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Costo Estimado</label>
              <input v-model="newOrder.estimatedCost" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="0.00">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Tiempo Estimado</label>
              <input v-model="newOrder.estimatedTime" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="Ej: 2 horas">
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showNewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="createOrder" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Crear Orden</button>
        </div>
      </div>
    </div>

    <!-- Modal: Cambiar Estado -->
    <div v-if="showStatusModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showStatusModal = false">
      <div class="bg-white rounded-2xl w-full max-w-md card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Cambiar Estado</h3>
          <button @click="showStatusModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="mb-4 text-center">
            <div class="text-sm text-text-muted mb-1">#{{ selectedOrder.id }}</div>
            <div class="text-lg font-black text-navy">{{ selectedOrder.title }}</div>
          </div>
          <div class="space-y-3">
            <button
              v-for="status in availableStatuses"
              :key="status.value"
              @click="changeStatus(status.value)"
              class="w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer"
              :class="selectedOrder.status === status.value ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/30'"
            >
              <div class="flex items-center gap-3">
                <span class="w-3 h-3 rounded-full" :class="status.dotColor"></span>
                <div>
                  <div class="text-sm font-bold">{{ status.label }}</div>
                  <div class="text-[10px] text-text-muted">{{ status.description }}</div>
                </div>
              </div>
            </button>
          </div>
        </div>
        <div class="p-6 border-t border-border">
          <button @click="showStatusModal = false" class="w-full py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
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
const activeFilter = ref('all')
const showViewModal = ref(false)
const showNewModal = ref(false)
const showStatusModal = ref(false)
const selectedOrder = ref<any>({})

const views = [
  { label: 'Lista', value: 'list' },
  { label: 'Tablero', value: 'board' }
]

const statusFilters = [
  { label: 'Todas', value: 'all' },
  { label: 'Abiertas', value: 'open' },
  { label: 'En Progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'closed' }
]

const stats = computed(() => {
  const o = orders.value
  const en = (e: string) => o.filter((x: any) => x.status === e).length
  const costo = o.reduce((s: number, x: any) => s + (x.estimatedCost ?? 0), 0)
  return [
    { label: 'Abiertas', value: en('open'), color: 'text-orange' },
    { label: 'En Progreso', value: en('in_progress'), color: 'text-cyan' },
    { label: 'Urgentes', value: o.filter((x: any) => x.priority === 'High' || x.priority === 'Urgent').length, color: 'text-red' },
    { label: 'Completadas', value: en('closed'), color: 'text-teal' },
    { label: 'Costo Total', value: `$${costo.toLocaleString()}`, color: 'text-navy' },
  ]
})

const kanbanColumns = [
  { id: 'open', title: 'Abierta', dotColor: 'bg-orange' },
  { id: 'in_progress', title: 'En Progreso', dotColor: 'bg-cyan' },
  { id: 'waiting', title: 'Esperando', dotColor: 'bg-purple' },
  { id: 'closed', title: 'Completada', dotColor: 'bg-teal' }
]

const availableStatuses = [
  { value: 'open', label: 'Abierta', description: 'Problema reportado, esperando asignación', dotColor: 'bg-orange' },
  { value: 'in_progress', label: 'En Progreso', description: 'Técnico trabajando en la solución', dotColor: 'bg-cyan' },
  { value: 'waiting', label: 'Esperando', description: 'Esperando repuestos o aprobación', dotColor: 'bg-purple' },
  { value: 'closed', label: 'Completada', description: 'Problema resuelto verificado', dotColor: 'bg-teal' }
]

const maintenanceStaff = [
  { id: 1, name: 'Mantenimiento', role: 'Técnico' },
]

const orders = ref<any[]>([])
const draggedOrder = ref<any>(null)
const dragOverCol = ref<string | null>(null)

const PRI_LABELS: Record<string, string> = { high: 'High', medium: 'Normal', low: 'Low', urgent: 'Urgent' }
const CAT_LABELS: Record<string, string> = { hvac: 'HVAC', plumbing: 'Plumbing', electronics: 'Electronics', locks: 'Locks', general: 'General', carpentry: 'Carpentry', painting: 'Painting' }

onMounted(loadData)

async function loadData() {
  try {
    const { data } = await OperationsService.mantenimiento.list(hotelId.value)
    orders.value = data.map((o: any) => ({
      id: o.id,
      title: o.title || 'Untitled',
      location: o.roomNumber ? `Room ${o.roomNumber}` : (o.category || ''),
      category: CAT_LABELS[o.category] || o.category || 'General',
      priority: PRI_LABELS[o.priority] || o.priority || 'Normal',
      status: o.status || 'open',
      assignedTo: o.assignedTo || 'Unassigned',
      date: o.reportedDate ? String(o.reportedDate).slice(0, 10) : '',
      description: o.description || '',
      estimatedCost: o.estimatedCost || 0,
      estimatedTime: '',
      notes: '',
    }))
  } catch { toast.error("Error al cargar datos") }
}

const newOrder = ref({
  title: '',
  location: '',
  category: '',
  priority: 'Normal',
  assignedTo: '',
  description: '',
  estimatedCost: '',
  estimatedTime: ''
})

const filteredOrders = computed(() => {
  if (activeFilter.value === 'all') return orders.value
  return orders.value.filter(o => o.status === activeFilter.value)
})

const getColumnOrders = (columnId: string) => {
  return orders.value.filter(o => o.status === columnId)
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('')
}

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    open: 'bg-orange/10 text-orange',
    in_progress: 'bg-cyan/10 text-cyan',
    waiting: 'bg-purple/10 text-purple',
    completed: 'bg-teal/10 text-teal'
  }
  return classes[status] || 'bg-surface text-text-muted'
}

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Abierta',
    in_progress: 'En Progreso',
    waiting: 'Esperando',
    completed: 'Completada'
  }
  return labels[status] || status
}

const priorityClass = (priority: string) => {
  const classes: Record<string, string> = {
    Baja: 'bg-surface text-text-muted',
    Normal: 'bg-blue/10 text-blue',
    Alta: 'bg-orange/10 text-orange',
    Urgente: 'bg-red/10 text-red'
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

const categoryClass = (category: string) => {
  const classes: Record<string, string> = {
    'Eléctrico': 'bg-yellow/10 text-yellow',
    'Plomería': 'bg-blue/10 text-blue',
    'Aire Acondicionado': 'bg-cyan/10 text-cyan',
    'Carpintería': 'bg-orange/10 text-orange',
    'Pintura': 'bg-purple/10 text-purple',
    'Electrónica': 'bg-navy/10 text-navy',
    'Limpieza': 'bg-teal/10 text-teal',
    'Otro': 'bg-surface text-text-muted'
  }
  return classes[category] || 'bg-surface text-text-muted'
}

const openViewOrder = (order: any) => {
  selectedOrder.value = order
  showViewModal.value = true
}

const openNewOrder = () => {
  newOrder.value = { title: '', location: '', category: '', priority: 'Normal', assignedTo: '', description: '', estimatedCost: '', estimatedTime: '' }
  showNewModal.value = true
}

const openEditOrder = (order: any) => {
  selectedOrder.value = order
  showNewModal.value = true
}

const openStatusModal = (order: any) => {
  selectedOrder.value = order
  showStatusModal.value = true
}

const createOrder = async () => {
  if (!newOrder.value.title) return
  try {
    await OperationsService.mantenimiento.create({
      title: newOrder.value.title,
      hotelId: hotelId.value,
      category: newOrder.value.category || 'general',
      priority: newOrder.value.priority || 'medium',
      status: 'open',
      description: newOrder.value.description || '',
      roomNumber: newOrder.value.location || '',
      assignedTo: newOrder.value.assignedTo || '',
      estimatedCost: newOrder.value.estimatedCost ? parseInt(newOrder.value.estimatedCost) : 0,
    })
    showNewModal.value = false
    await loadData()
  } catch { toast.error('Error al crear orden') }
}

const completeOrder = async (order: any) => {
  try {
    await OperationsService.mantenimiento.update(order.id, { status: 'closed', resolvedDate: new Date().toISOString() })
    showViewModal.value = false
    await loadData()
  } catch { toast.error('Error al completar orden') }
}

const changeStatus = async (status: string) => {
  if (!selectedOrder.value?.id) return
  if (selectedOrder.value.status === status) { showStatusModal.value = false; return }
  try {
    await OperationsService.mantenimiento.update(selectedOrder.value.id, { status })
    const order = orders.value.find(o => o.id === selectedOrder.value.id)
    if (order) order.status = status
    showStatusModal.value = false
  } catch { toast.error('Error al cambiar estado') }
}

// ─── Drag & Drop Kanban ─────────────────────────────────────────────
function catBorder(cat: string) {
  const map: Record<string, string> = { 'HVAC': 'border-l-cyan-500', 'Plumbing': 'border-l-blue-500', 'Electronics': 'border-l-amber-500', 'Locks': 'border-l-red-500', 'General': 'border-l-gray-400', 'Carpentry': 'border-l-yellow-600', 'Painting': 'border-l-purple-500' }
  return map[cat] || 'border-l-gray-300'
}

function staffColor(name: string) {
  const colors = ['bg-cyan', 'bg-teal', 'bg-navy', 'bg-purple', 'bg-coral', 'bg-gold']
  const idx = (name || '').split('').reduce((s: number, c: string) => s + c.charCodeAt(0), 0) % colors.length
  return colors[idx]
}

function onDragStart(e: DragEvent, order: any) {
  draggedOrder.value = order
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', order.id)
}

async function onDrop(e: DragEvent, newStatus: string) {
  dragOverCol.value = null
  if (!draggedOrder.value || draggedOrder.value.status === newStatus) { draggedOrder.value = null; return }
  const order = draggedOrder.value
  try {
    await OperationsService.mantenimiento.update(order.id, { status: newStatus })
    const o = orders.value.find(o => o.id === order.id)
    if (o) o.status = newStatus
  } catch { toast.error('Error al mover orden') }
  draggedOrder.value = null
}
</script>
