<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Housekeeping</h2>

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
      <div class="flex gap-2">
        <button @click="openAssignModal" class="bg-navy text-white font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          + Asignar Tarea
        </button>
        <button @click="openNewTask" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          + Nueva Tarea
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-6 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
        <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Board View (Kanban) -->
    <div v-if="activeView === 'board'" class="grid grid-cols-4 gap-4">
      <div v-for="column in kanbanColumns" :key="column.id"
        class="bg-surface rounded-xl p-4 min-h-[300px] transition-all"
        :class="dragOverColumn === column.id ? 'ring-2 ring-navy bg-navy/5' : ''"
        @dragover.prevent="dragOverColumn = column.id"
        @dragleave="dragOverColumn = null"
        @drop.prevent="onDrop($event, column.id)">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" :class="column.dotColor"></span>
            <h3 class="text-sm font-black text-navy">{{ column.title }}</h3>
          </div>
          <span class="bg-white px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted border border-border">
            {{ getColumnTasks(column.id).length }}
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="task in getColumnTasks(column.id)"
            :key="task.id"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @dragend="dragOverColumn = null; draggedTask = null"
            @click="openViewTask(task)"
            class="bg-white rounded-xl p-4 border border-border border-l-4 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing"
            :class="[draggedTask?.id === task.id ? 'opacity-50' : '', TYPE_COLORS[task.rawType] || 'border-l-gray-300']">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-xs">{{ TYPE_ICONS[task.rawType] || '🧹' }}</span>
                <span class="text-sm font-black text-navy">{{ task.roomNumber }}</span>
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="priorityBadgeClass(task.priority)">
                {{ task.priority }}
              </span>
            </div>
            <div class="text-[11px] text-text-secondary mb-3">{{ task.type }}</div>
            <div v-if="task.notes" class="text-[10px] text-text-muted mb-3 truncate">{{ task.notes }}</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" :class="staffColor(task.assignedTo)">
                  {{ getInitials(task.assignedTo) }}
                </div>
                <span class="text-[10px] font-medium text-navy">{{ task.assignedTo }}</span>
              </div>
              <span class="text-[10px] text-text-muted">{{ task.time }}</span>
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
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hab</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Piso</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Prioridad</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Asignado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Tiempo</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in filteredTasks" :key="task.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer">
            <td class="p-4 text-sm font-black text-navy">{{ task.roomNumber }}</td>
            <td class="p-4 text-sm">{{ task.type }}</td>
            <td class="p-4 text-sm">{{ task.floor }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(task.status)">
                {{ statusLabel(task.status) }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(task.priority)">
                {{ task.priority }}
              </span>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center">
                  <span class="text-[9px] font-bold text-navy">{{ getInitials(task.assignedTo) }}</span>
                </div>
                <span class="text-sm">{{ task.assignedTo }}</span>
              </div>
            </td>
            <td class="p-4 text-sm text-text-muted">{{ task.time }}</td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click.stop="openViewTask(task)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click.stop="openEditTask(task)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
                <button @click.stop="openStatusModal(task)" class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cambiar Estado</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Ver Tarea -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showViewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Detalle de Tarea</h3>
          <button @click="showViewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Habitación</div>
              <div class="text-lg font-black text-navy">{{ selectedTask.roomNumber }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Tipo de Tarea</div>
              <div class="text-sm font-bold">{{ selectedTask.type }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Piso</div>
              <div class="text-sm">{{ selectedTask.floor }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Estado</div>
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(selectedTask.status)">
                {{ statusLabel(selectedTask.status) }}
              </span>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Prioridad</div>
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(selectedTask.priority)">
                {{ selectedTask.priority }}
              </span>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Asignado a</div>
              <div class="text-sm font-bold">{{ selectedTask.assignedTo }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Tiempo Estimado</div>
              <div class="text-sm">{{ selectedTask.time }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Inicio</div>
              <div class="text-sm">{{ selectedTask.startTime }}</div>
            </div>
          </div>
          <div v-if="selectedTask.notes" class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Notas</div>
            <div class="text-sm text-text-secondary">{{ selectedTask.notes }}</div>
          </div>
          <div v-if="selectedTask.items" class="mt-4 bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Items de Limpieza</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in selectedTask.items" :key="item" class="text-[10px] bg-white px-2 py-1 rounded-full border border-border">
                {{ item }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showViewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button @click="completeTask(selectedTask)" class="flex-1 py-2.5 bg-cyan text-navy rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Marcar Completa</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nueva Tarea -->
    <div v-if="showNewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showNewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Nueva Tarea</h3>
          <button @click="showNewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Habitación *</label>
              <select v-model="newTask.roomNumber" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option v-for="room in availableRooms" :key="room.number" :value="room.number">{{ room.number }} - {{ room.type }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Tipo de Tarea *</label>
              <select v-model="newTask.type" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option value="full_cleaning">Limpieza completa</option>
                <option value="quick_cleaning">Limpieza rápida</option>
                <option value="deep_cleaning">Limpieza profunda</option>
                <option value="inspection">Inspección</option>
                <option value="maintenance">Mantenimiento</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Prioridad</label>
              <select v-model="newTask.priority" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="medium">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Asignar a *</label>
              <select v-model="newTask.assignedTo" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option v-for="staff in housekeepingStaff" :key="staff.id" :value="staff.name">{{ staff.name }}</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Notas</label>
              <textarea v-model="newTask.notes" rows="3" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Instrucciones especiales..."></textarea>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showNewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="createTask" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Crear Tarea</button>
        </div>
      </div>
    </div>

    <!-- Modal: Asignar Tarea -->
    <div v-if="showAssignModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showAssignModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Asignar Tareas Rápidas</h3>
          <button @click="showAssignModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="mb-4">
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Seleccionar Personal</label>
            <select v-model="assignStaff" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="">Seleccionar...</option>
              <option v-for="staff in housekeepingStaff" :key="staff.id" :value="staff.id">{{ staff.name }} - {{ staff.role }}</option>
            </select>
          </div>
          <div v-if="assignStaff" class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-3">Tareas Pendientes Asignadas</div>
            <div class="space-y-2">
              <div v-for="task in getTasksByStaff(Number(assignStaff))" :key="task.id" class="bg-white rounded-lg p-3 border border-border flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-sm font-black text-navy">{{ task.roomNumber }}</span>
                  <span class="text-[10px] text-text-muted">{{ task.type }}</span>
                </div>
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="priorityClass(task.priority)">
                  {{ task.priority }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showAssignModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
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
            <div class="text-2xl font-black text-navy mb-1">{{ selectedTask.roomNumber }}</div>
            <div class="text-sm text-text-muted">{{ selectedTask.type }}</div>
          </div>
          <div class="space-y-3">
            <button
              v-for="status in availableStatuses"
              :key="status.value"
              @click="changeStatus(status.value)"
              class="w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer"
              :class="selectedTask.status === status.value ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/30'"
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
import { useRoomStore } from '@/stores/room.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const roomStore = useRoomStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeView = ref('list')
const activeFilter = ref('all')
const showViewModal = ref(false)
const showNewModal = ref(false)
const showAssignModal = ref(false)
const showStatusModal = ref(false)
const selectedTask = ref<any>({})
const assignStaff = ref('')

const views = [
  { label: 'Lista', value: 'list' },
  { label: 'Tablero', value: 'board' }
]

const statusFilters = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En Progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' }
]

const stats = computed(() => {
  const t = tasks.value
  const en = (e: string) => t.filter((x: any) => x.status === e).length
  return [
    { label: 'Pendientes', value: en('pending'), color: 'text-orange' },
    { label: 'En Progreso', value: en('in_progress'), color: 'text-cyan' },
    { label: 'Completadas', value: en('completed'), color: 'text-teal' },
    { label: 'Inspeccionadas', value: en('inspected'), color: 'text-purple' },
    { label: 'Total', value: t.length, color: 'text-navy' },
  ]
})

const kanbanColumns = [
  { id: 'pending', title: 'Pendiente', dotColor: 'bg-orange' },
  { id: 'in_progress', title: 'En Progreso', dotColor: 'bg-cyan' },
  { id: 'completed', title: 'Completada', dotColor: 'bg-teal' },
  { id: 'inspected', title: 'Inspeccionada', dotColor: 'bg-purple' }
]

const availableStatuses = [
  { value: 'pending', label: 'Pendiente', description: 'Tarea creada, esperando ser iniciada', dotColor: 'bg-orange' },
  { value: 'in_progress', label: 'En Progreso', description: 'Personal trabajando en la habitación', dotColor: 'bg-cyan' },
  { value: 'completed', label: 'Completada', description: 'Limpieza finalizada, lista para inspección', dotColor: 'bg-teal' },
  { value: 'inspected', label: 'Inspeccionada', description: 'Verificada por supervisor, habitación lista para huésped', dotColor: 'bg-purple' }
]

const housekeepingStaff = [
  { id: 1, name: 'Housekeeping', role: 'Staff' },
]

const tasks = ref<any[]>([])
const draggedTask = ref<any>(null)
const dragOverColumn = ref<string | null>(null)

const PRI_LABELS: Record<string, string> = { high: 'High', medium: 'Normal', low: 'Low', urgent: 'Urgent' }

const TYPE_LABELS: Record<string, string> = { full_cleaning: 'Full Cleaning', quick_cleaning: 'Quick Clean', deep_cleaning: 'Deep Clean', inspection: 'Inspection', maintenance: 'Maintenance' }
const TYPE_ICONS: Record<string, string> = { full_cleaning: '🧹', quick_cleaning: '✨', deep_cleaning: '🧼', inspection: '🔍', maintenance: '🔧' }
const TYPE_COLORS: Record<string, string> = { full_cleaning: 'border-l-4 border-l-cyan-500', quick_cleaning: 'border-l-4 border-l-teal-500', deep_cleaning: 'border-l-4 border-l-blue-600', inspection: 'border-l-4 border-l-purple-500', maintenance: 'border-l-4 border-l-amber-500' }

async function loadData() {
  try {
    await roomStore.fetchRooms({ hotelId: hotelId.value })
    const { data } = await OperationsService.housekeeping.list(hotelId.value)
    const roomMap = new Map(roomStore.rooms.map(r => [r.id, r]))
    tasks.value = data.map((t: any) => {
      const room = roomMap.get(t.roomId)
      return {
        id: t.id,
        rawType: t.type,
        roomNumber: room?.number || t.roomNumber || '—',
        type: TYPE_LABELS[t.type] || t.type || 'Cleaning',
        floor: room?.floor || t.floor || '',
        status: t.status || 'pending',
        priority: PRI_LABELS[t.priority] || t.priority || 'Normal',
        assignedTo: t.staffId || 'Unassigned',
        time: '',
        startTime: t.assignedDate ? String(t.assignedDate).slice(11, 16) : '--',
        notes: t.notes || '',
        items: t.cleaningItems ? (() => { try { return JSON.parse(t.cleaningItems) } catch { return [] } })() : [],
      }
    })
  } catch { toast.error("Error al cargar datos") }
}

onMounted(loadData)

const newTask = ref({
  roomNumber: '',
  type: '',
  priority: 'medium',
  assignedTo: '',
  notes: ''
})

const availableRooms = computed(() =>
  roomStore.rooms.map(r => ({ number: r.number, type: r.type || 'Standard' }))
)

const filteredTasks = computed(() => {
  if (activeFilter.value === 'all') return tasks.value
  return tasks.value.filter(t => t.status === activeFilter.value)
})

const getColumnTasks = (columnId: string) => {
  return tasks.value.filter(t => t.status === columnId)
}

const getTasksByStaff = (staffId: number) => {
  const staff = housekeepingStaff.find(s => s.id === staffId)
  if (!staff) return []
  return tasks.value.filter(t => t.assignedTo === staff.name && t.status !== 'completed' && t.status !== 'inspected')
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('')
}

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: 'bg-orange/10 text-orange',
    in_progress: 'bg-cyan/10 text-cyan',
    completed: 'bg-teal/10 text-teal',
    inspected: 'bg-purple/10 text-purple'
  }
  return classes[status] || 'bg-surface text-text-muted'
}

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    inspected: 'Inspeccionada'
  }
  return labels[status] || status
}

const priorityClass = (priority: string) => {
  const classes: Record<string, string> = {
    Normal: 'bg-surface text-text-muted', High: 'bg-coral/10 text-coral', Urgent: 'bg-red/10 text-red',
    low: 'bg-surface text-text-muted', medium: 'bg-gold/10 text-gold', high: 'bg-coral/10 text-coral', urgent: 'bg-red/10 text-red'
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

const priorityBadgeClass = (priority: string) => {
  const classes: Record<string, string> = {
    Normal: 'bg-surface text-text-muted', High: 'bg-coral/10 text-coral', Urgent: 'bg-red text-white',
    low: 'bg-surface text-text-muted', medium: 'bg-gold/10 text-gold', high: 'bg-coral/10 text-coral', urgent: 'bg-red text-white'
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

const staffColor = (name: string) => {
  const colors = ['bg-cyan', 'bg-teal', 'bg-navy', 'bg-purple', 'bg-coral', 'bg-gold']
  const idx = (name || '').split('').reduce((s,c) => s + c.charCodeAt(0), 0) % colors.length
  return colors[idx]
}

const openViewTask = (task: any) => {
  selectedTask.value = task
  showViewModal.value = true
}

const openNewTask = () => {
  newTask.value = { roomNumber: '', type: '', priority: 'medium', assignedTo: '', notes: '' }
  showNewModal.value = true
}

const openAssignModal = () => {
  assignStaff.value = ''
  showAssignModal.value = true
}

const openEditTask = (task: any) => {
  selectedTask.value = task
  showNewModal.value = true
}

const openStatusModal = (task: any) => {
  selectedTask.value = task
  showStatusModal.value = true
}

const createTask = async () => {
  if (!newTask.value.roomNumber || !newTask.value.type) return
  try {
    await OperationsService.housekeeping.create({
      roomId: availableRooms.find(r => r.number === newTask.value.roomNumber)?.id || newTask.value.roomNumber,
      roomNumber: newTask.value.roomNumber,
      hotelId: hotelId.value,
      type: newTask.value.type,
      priority: newTask.value.priority || 'medium',
      status: 'pending',
      notes: newTask.value.notes || '',
      staffId: newTask.value.assignedTo || '',
    })
    showNewModal.value = false
    await loadData()
    toast.success('Tarea creada', `Hab ${newTask.value.roomNumber}`)
  } catch (e: any) { toast.error('No se pudo crear la tarea', e?.message) }
}

const completeTask = async (task: any) => {
  try {
    await OperationsService.housekeeping.update(task.id, { status: 'completed', completedDate: new Date().toISOString() })
    showViewModal.value = false
    await loadData()
    toast.success('Tarea completada', 'Lista para inspección')
  } catch (e: any) { toast.error('No se pudo completar la tarea', e?.message) }
}

const changeStatus = async (newStatus: string) => {
  if (!selectedTask.value?.id) return
  if (selectedTask.value.status === newStatus) {
    showStatusModal.value = false
    return
  }
  try {
    await OperationsService.housekeeping.update(selectedTask.value.id, { status: newStatus })
    const task = tasks.value.find(t => t.id === selectedTask.value.id)
    if (task) task.status = newStatus
    showStatusModal.value = false
  } catch (e: any) { toast.error('No se pudo cambiar el estado', e?.message) }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────
function onDragStart(e: DragEvent, task: any) {
  draggedTask.value = task
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }
}

async function onDrop(e: DragEvent, newStatus: string) {
  dragOverColumn.value = null
  if (!draggedTask.value) return
  if (draggedTask.value.status === newStatus) {
    draggedTask.value = null
    return
  }
  const task = draggedTask.value
  try {
    await OperationsService.housekeeping.update(task.id, { status: newStatus })
    const t = tasks.value.find(t => t.id === task.id)
    if (t) t.status = newStatus
  } catch (err: any) {
    toast.error('No se pudo mover la tarea', err?.message)
  }
  draggedTask.value = null
}
</script>
