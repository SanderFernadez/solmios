<template>
  <div>
    <h2 class="text-xl font-black text-navy mb-6">Housekeeping</h2>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="view in views"
          :key="view.value"
          @click="switchView(view.value)"
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
        <label class="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary cursor-pointer ml-2 select-none">
          <input type="checkbox" v-model="hideCompleted" class="accent-navy w-3.5 h-3.5 cursor-pointer" />
          Ocultar terminadas
        </label>
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

    <!-- Stats cards -->
    <div class="grid grid-cols-5 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center">
        <div class="text-lg font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Dashboard de Estadísticas -->
    <div v-if="activeView === 'stats'" class="bg-white rounded-2xl border border-border card-shadow p-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 class="text-lg font-black text-navy">Rendimiento por Empleado</h3>
        <div class="flex gap-2">
          <button
            v-for="r in statsRanges"
            :key="r"
            @click="changeStatsRange(r)"
            class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
            :class="statsRangeDays === r ? 'bg-navy text-white' : 'bg-surface text-text-secondary hover:bg-surface-dark'"
          >
            Últimos {{ r }} días
          </button>
        </div>
      </div>
      <div v-if="store.stats.length === 0" class="text-center py-12 text-text-muted text-sm">
        No hay tareas completadas en el período seleccionado.
      </div>
      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Empleado</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Tareas completadas</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Tiempo promedio</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Tiempo total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in store.stats" :key="row.staffId" class="border-b border-border last:border-0">
            <td class="p-3 text-sm font-bold text-navy">{{ staffName(row.staffId) }}</td>
            <td class="p-3 text-sm text-right">{{ row.completed }}</td>
            <td class="p-3 text-sm text-right text-cyan font-bold">{{ humanizeMs(row.avgDurationMs) }}</td>
            <td class="p-3 text-sm text-right text-text-muted">{{ humanizeMs(row.totalDurationMs) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Board View (Kanban) -->
    <div v-else-if="activeView === 'board'" class="grid grid-cols-4 gap-4">
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
          <!-- Empty state: columna sin tareas -->
          <div v-if="getColumnTasks(column.id).length === 0" class="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border/60 rounded-xl">
            <span class="text-2xl mb-2 opacity-50">{{ column.icon }}</span>
            <p class="text-xs font-bold text-text-muted">Sin tareas</p>
            <p class="text-[10px] text-text-muted/70 mt-1 px-2 leading-tight">{{ column.emptyHint }}</p>
          </div>
          <div
            v-for="task in getColumnTasks(column.id)"
            :key="task.id"
            draggable="true"
            @dragstart="onDragStart($event, task)"
            @dragend="dragOverColumn = null; draggedTask = null"
            @click="openViewTask(task)"
            class="bg-white rounded-xl p-4 border border-border border-l-4 hover:shadow-lg transition-all cursor-grab active:cursor-grabbing"
            :class="[draggedTask?.id === task.id ? 'opacity-50' : '', TYPE_COLORS[task.rawType ?? ''] || 'border-l-gray-300']">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-xs">{{ TYPE_ICONS[task.rawType ?? ''] || '🧹' }}</span>
                <span class="text-sm font-black text-navy">{{ task.roomNumber }}</span>
              </div>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="priorityBadgeClass(task.priority)">
                {{ task.priority }}
              </span>
            </div>
            <div class="text-[11px] text-text-secondary mb-3">{{ task.type }}</div>
            <div v-if="taskTime(task)" class="text-[10px] text-cyan font-bold mb-2">⏱ {{ taskTime(task) }}</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" :class="staffColor(task.assignedTo)">
                  {{ getInitials(task.assignedTo) }}
                </div>
                <span class="text-[10px] font-medium text-navy">{{ task.assignedTo }}</span>
              </div>
              <span v-if="task.photos.length" class="text-[10px] text-text-muted">📷 {{ task.photos.length }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <!-- Search & Controls -->
      <div class="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="relative">
            <input v-model="listSearch" type="text" placeholder="Buscar habitación, tipo, empleado..." class="pl-9 pr-4 py-2 rounded-xl border border-border text-sm w-64 focus:outline-none focus:border-navy" />
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          </div>
          <select v-model="listPageSize" class="px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
            <option :value="10">10 por página</option>
            <option :value="20">20 por página</option>
            <option :value="50">50 por página</option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          <button @click="exportCsv" class="px-4 py-2 bg-surface rounded-xl text-sm font-bold text-text-secondary hover:bg-surface-dark transition-colors cursor-pointer">📥 Exportar CSV</button>
          <span class="text-xs text-text-muted">{{ filteredTasks.length }} tarea(s)</span>
        </div>
      </div>
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
          <tr v-if="paginatedTasks.length === 0">
            <td colspan="8" class="p-0">
              <div class="flex flex-col items-center justify-center py-16 text-center">
                <span class="text-4xl mb-3 opacity-40">🧹</span>
                <p class="text-sm font-bold text-navy">Sin tareas de housekeeping</p>
                <p class="text-xs text-text-muted mt-1">No hay tareas para los filtros actuales.<br>Creá una nueva tarea o ajustá los filtros.</p>
              </div>
            </td>
          </tr>
          <tr v-for="task in paginatedTasks" :key="task.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4 text-sm font-black text-navy cursor-pointer" @click="openViewTask(task)">{{ task.roomNumber }}</td>
            <td class="p-4 text-sm cursor-pointer" @click="openViewTask(task)">{{ task.type }}</td>
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
            <td class="p-4 text-sm">
              <span v-if="taskTime(task)" class="text-cyan font-bold">{{ taskTime(task) }}</span>
              <span v-else class="text-text-muted">—</span>
            </td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end flex-wrap">
                <button @click="openViewTask(task)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click="openEditTask(task)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
                <button
                  v-if="primaryAction(task)"
                  @click="runPrimary(task)"
                  class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 transition-colors cursor-pointer"
                >{{ primaryAction(task)?.label }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination -->
      <div v-if="totalListPages > 1" class="p-4 border-t border-border flex items-center justify-between">
        <span class="text-xs text-text-muted">{{ filteredTasks.length }} tarea(s) en {{ totalListPages }} página(s)</span>
        <div class="flex items-center gap-1">
          <button @click="listPage = 1" :disabled="listPage <= 1" class="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">«</button>
          <button @click="listPage--" :disabled="listPage <= 1" class="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">‹</button>
          <span class="px-2 text-xs font-bold text-navy">{{ listPage }} / {{ totalListPages }}</span>
          <button @click="listPage++" :disabled="listPage >= totalListPages" class="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">›</button>
          <button @click="listPage = totalListPages" :disabled="listPage >= totalListPages" class="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">»</button>
        </div>
      </div>
    </div>

    <!-- Modal: Ver Tarea -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showViewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-white">
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
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Asignado a</div>
              <div class="text-sm font-bold">{{ selectedTask.assignedTo }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Duración</div>
              <div class="text-sm text-cyan font-bold">{{ selectedTask.time || '—' }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Inicio</div>
              <div class="text-sm">{{ selectedTask.startTime ? formatTime(selectedTask.startTime) : '—' }}</div>
            </div>
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Fin</div>
              <div class="text-sm">{{ selectedTask.endTime ? formatTime(selectedTask.endTime) : '—' }}</div>
            </div>
          </div>
          <div v-if="selectedTask.notes" class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Notas</div>
            <div class="text-sm text-text-secondary">{{ selectedTask.notes }}</div>
          </div>
          <div v-if="selectedTask.items.length" class="bg-surface rounded-xl p-4 mb-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-2">Items de Limpieza</div>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in selectedTask.items" :key="item" class="text-[10px] bg-white px-2 py-1 rounded-full border border-border">
                {{ item }}
              </span>
            </div>
          </div>
          <!-- Fotos -->
          <div class="bg-surface rounded-xl p-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-[10px] font-bold text-text-muted uppercase">Evidencia fotográfica</div>
              <label class="text-[10px] font-bold text-cyan cursor-pointer hover:underline">
                + Subir foto
                <input type="file" accept="image/*" class="hidden" @change="onPhotoSelect" />
              </label>
            </div>
            <div v-if="selectedTask.photos.length" class="grid grid-cols-3 gap-2">
              <div v-for="photo in selectedTask.photos" :key="photo.url" class="relative group">
                <img :src="photo.url" :alt="photo.name" class="w-full h-20 object-cover rounded-lg border border-border" />
                <button
                  @click="onRemovePhoto(photo.url)"
                  class="absolute top-1 right-1 w-5 h-5 bg-red text-white rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >✕</button>
              </div>
            </div>
            <div v-else class="text-[11px] text-text-muted py-2">Sin fotos.</div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border sticky bottom-0 bg-white">
          <button @click="showViewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button
            v-if="primaryAction(selectedTask)"
            @click="runPrimary(selectedTask)"
            class="flex-1 py-2.5 bg-cyan text-navy rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer"
          >{{ primaryAction(selectedTask)?.label }}</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nueva / Editar Tarea -->
    <div v-if="showNewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showNewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">{{ editingId ? 'Editar Tarea' : 'Nueva Tarea' }}</h3>
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
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Asignar a</label>
              <select v-model="newTask.staffId" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option v-for="emp in store.staff" :key="emp.id" :value="emp.id">{{ emp.userName || emp.userId }}</option>
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
          <button @click="saveTask" :disabled="saving" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer disabled:opacity-50">
            {{ saving ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Crear Tarea') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Asignar Tareas Rápidas -->
    <div v-if="showAssignModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showAssignModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Asignar Tareas Rápidas</h3>
          <button @click="showAssignModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="mb-4">
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Seleccionar Personal</label>
            <select v-model="assignStaff" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
              <option value="">Seleccionar...</option>
              <option v-for="emp in store.staff" :key="emp.id" :value="emp.id">{{ emp.userName || emp.userId }} — {{ emp.position || 'Staff' }}</option>
            </select>
          </div>
          <div v-if="assignStaff" class="bg-surface rounded-xl p-4">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-3">Tareas pendientes sin asignar</div>
            <div v-if="assignableTasks.length === 0" class="text-[11px] text-text-muted py-2">No hay tareas pendientes para asignar.</div>
            <div v-else class="space-y-2">
              <label v-for="task in assignableTasks" :key="task.id" class="flex items-center gap-3 bg-white rounded-lg p-3 border border-border cursor-pointer hover:border-navy/30">
                <input type="checkbox" :value="task.id" v-model="assignSelection" class="w-4 h-4 accent-navy" />
                <span class="text-sm font-black text-navy">{{ task.roomNumber }}</span>
                <span class="text-[10px] text-text-muted">{{ task.type }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showAssignModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button
            @click="assignSelected"
            :disabled="assignSelection.length === 0 || !assignStaff"
            class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer disabled:opacity-50"
          >Asignar {{ assignSelection.length || '' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useHousekeepingStore, humanizeMs, type HousekeepingViewTask } from '@/stores/housekeeping.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useNow } from '@/composables/useNow'

const store = useHousekeepingStore()
const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeView = ref('board')
const activeFilter = ref('all')
const showViewModal = ref(false)
const showNewModal = ref(false)
const showAssignModal = ref(false)
const selectedTask = ref<HousekeepingViewTask>(blankTask())
const editingId = ref<string | null>(null)
const saving = ref(false)
const assignStaff = ref('')
const assignSelection = ref<string[]>([])
const statsRangeDays = ref(30)
const draggedTask = ref<HousekeepingViewTask | null>(null)
const dragOverColumn = ref<string | null>(null)

// List view pagination & search
const listPage = ref(1)
const listPageSize = ref(20)
const listSearch = ref('')

// D1/D3 — Ocultar tareas terminadas en la LISTA (no en el Kanban). Default OFF: se ven
// todas por defecto; el toggle es opt-in para reducir ruido cuando hay muchas. Persiste.
const hideCompleted = ref(localStorage.getItem('hk:hideCompleted') === 'true')
watch(hideCompleted, (v) => localStorage.setItem('hk:hideCompleted', String(v)))
// C1 — Reloj reactivo (cada 60s) para mostrar el tiempo transcurrido en vivo en in_progress.
const LIVE_TICK_MS = 60_000
const { now } = useNow(LIVE_TICK_MS)
const COMPLETED_STATUSES = ['completed', 'inspected']

const views = [
  { label: '📋 Tablero', value: 'board' },
  { label: '📝 Lista', value: 'list' },
  { label: '📊 Estadísticas', value: 'stats' },
]

const statusFilters = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En Progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
  { label: 'Inspeccionadas', value: 'inspected' },
]

const statsRanges = [7, 30, 90]

// El Kanban es un flujo de proceso: las 4 columnas representan el pipeline completo
// (Pendiente → En Progreso → Completada → Inspeccionada). Ocultar etapas rompe la
// representación del proceso, así que el tablero SIEMPRE muestra las 4 columnas.
const kanbanColumns = [
  { id: 'pending', title: 'Pendiente', dotColor: 'bg-orange', icon: '📥', emptyHint: 'Las tareas nuevas aparecen acá' },
  { id: 'in_progress', title: 'En Progreso', dotColor: 'bg-cyan', icon: '🧹', emptyHint: 'Arrastrá acá las tareas en limpieza' },
  { id: 'completed', title: 'Completada', dotColor: 'bg-teal', icon: '✅', emptyHint: 'Tareas terminadas' },
  { id: 'inspected', title: 'Inspeccionada', dotColor: 'bg-purple', icon: '🔍', emptyHint: 'Tareas verificadas por supervisión' },
]

const TYPE_ICONS: Record<string, string> = { full_cleaning: '🧹', quick_cleaning: '✨', deep_cleaning: '🧼', inspection: '🔍', maintenance: '🔧' }
const TYPE_COLORS: Record<string, string> = { full_cleaning: 'border-l-4 border-l-cyan-500', quick_cleaning: 'border-l-4 border-l-teal-500', deep_cleaning: 'border-l-4 border-l-blue-600', inspection: 'border-l-4 border-l-purple-500', maintenance: 'border-l-4 border-l-amber-500' }

function blankTask(): HousekeepingViewTask {
  return { id: '', roomNumber: '', type: '', floor: '', status: 'pending', priority: 'Normal', priorityRaw: 'medium', assignedTo: 'Sin asignar', staffId: '', time: '', notes: '', items: [], photos: [] }
}

const stats = computed(() => {
  const t = store.tasks
  const en = (s: string) => t.filter(x => x.status === s).length
  return [
    { label: 'Pendientes', value: en('pending'), color: 'text-orange' },
    { label: 'En Progreso', value: en('in_progress'), color: 'text-cyan' },
    { label: 'Completadas', value: en('completed'), color: 'text-teal' },
    { label: 'Inspeccionadas', value: en('inspected'), color: 'text-purple' },
    { label: 'Total', value: t.length, color: 'text-navy' },
  ]
})

const availableRooms = computed(() =>
  store.rooms.map(r => ({ id: r.id, number: r.number, type: r.type || 'Standard' })),
)

const filteredTasks = computed(() => {
  let tasks = store.tasks
  if (activeFilter.value !== 'all') tasks = tasks.filter(t => t.status === activeFilter.value)
  if (hideCompleted.value) tasks = tasks.filter(t => !COMPLETED_STATUSES.includes(t.status))
  if (listSearch.value) {
    const q = listSearch.value.toLowerCase()
    tasks = tasks.filter(t =>
      t.roomNumber.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.assignedTo.toLowerCase().includes(q) ||
      t.notes?.toLowerCase().includes(q)
    )
  }
  return tasks
})

const paginatedTasks = computed(() => {
  const start = (listPage.value - 1) * listPageSize.value
  return filteredTasks.value.slice(start, start + listPageSize.value)
})

const totalListPages = computed(() => Math.ceil(filteredTasks.value.length / listPageSize.value))

const getColumnTasks = (columnId: string) => store.tasks.filter(t => t.status === columnId)

// Tareas pendientes sin staff asignado → candidatas a asignación rápida.
const assignableTasks = computed(() =>
  store.tasks.filter(t => t.status === 'pending' && !t.staffId),
)

const newTask = ref({ roomNumber: '', type: '', priority: 'medium', staffId: '', notes: '' })

function getInitials(name: string) {
  return (name || '').split(' ').map(n => n[0]).join('').slice(0, 2)
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    pending: 'bg-orange/10 text-orange',
    in_progress: 'bg-cyan/10 text-cyan',
    completed: 'bg-teal/10 text-teal',
    inspected: 'bg-purple/10 text-purple',
  }
  return classes[status] || 'bg-surface text-text-muted'
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    inspected: 'Inspeccionada',
  }
  return labels[status] || status
}

function priorityClass(priority: string) {
  const classes: Record<string, string> = {
    Normal: 'bg-surface text-text-muted', High: 'bg-coral/10 text-coral', Urgent: 'bg-red/10 text-red',
    low: 'bg-surface text-text-muted', medium: 'bg-gold/10 text-gold', high: 'bg-coral/10 text-coral', urgent: 'bg-red/10 text-red',
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

function priorityBadgeClass(priority: string) {
  const classes: Record<string, string> = {
    Normal: 'bg-surface text-text-muted', High: 'bg-coral/10 text-coral', Urgent: 'bg-red text-white',
    low: 'bg-surface text-text-muted', medium: 'bg-gold/10 text-gold', high: 'bg-coral/10 text-coral', urgent: 'bg-red text-white',
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

function staffColor(name: string) {
  const colors = ['bg-cyan', 'bg-teal', 'bg-navy', 'bg-purple', 'bg-coral', 'bg-gold']
  const idx = (name || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length
  return colors[idx]
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleString('es', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) } catch { return iso }
}

// C1 — Tiempo a mostrar: duración fija si ya terminó, o transcurrido en vivo si está in_progress.
// Lee `now` (ref del composable useNow) → el render se re-evalúa cada 60s sin recargar.
function taskTime(task: HousekeepingViewTask): string {
  if (task.time) return task.time
  if (task.status === 'in_progress' && task.startTime) {
    return humanizeMs(now.value - new Date(task.startTime).getTime())
  }
  return ''
}

function staffName(staffId: string) {
  if (staffId === 'unassigned') return 'Sin asignar'
  return store.staff.find(s => s.id === staffId)?.userName || staffId
}

// Acción primaria según el estado (respeta la máquina de estados del backend).
function primaryAction(task: HousekeepingViewTask): { label: string; fn: () => Promise<void>; silent?: boolean } | null {
  switch (task.status) {
    // Sin asignar → guiar a asignar (abre el modal de edición, sin toast). Con asignar → iniciar (arranca el cronómetro).
    case 'pending': return task.staffId
      ? { label: '▶ Iniciar', fn: () => store.startTask(task.id) }
      : { label: 'Asignar', fn: async () => { openEditTask(task) }, silent: true }
    case 'in_progress': return { label: 'Finalizar', fn: () => store.completeTask(task.id) }
    case 'completed': return { label: 'Inspeccionar', fn: () => store.updateTask(task.id, { status: 'inspected' }) }
    case 'inspected': return { label: 'Reabrir', fn: () => store.updateTask(task.id, { status: 'pending' }) }
    default: return null
  }
}

async function runPrimary(task: HousekeepingViewTask) {
  const action = primaryAction(task)
  if (!action) return
  try {
    await action.fn()
    // silent = true para acciones que solo abren un modal (ej. "Asignar") → no son persistentes, no se festejan.
    if (!action.silent) {
      toast.success('Acción realizada', action.label)
      syncSelectedTask(task.id)
    }
  } catch (e: any) { toast.error('No se pudo realizar la acción', e?.message) }
}

function syncSelectedTask(id: string) {
  const updated = store.tasks.find(t => t.id === id)
  if (updated && showViewModal.value) selectedTask.value = updated
}

function openViewTask(task: HousekeepingViewTask) {
  selectedTask.value = task
  showViewModal.value = true
}

function openNewTask() {
  editingId.value = null
  newTask.value = { roomNumber: '', type: '', priority: 'medium', staffId: '', notes: '' }
  showNewModal.value = true
}

function openEditTask(task: HousekeepingViewTask) {
  editingId.value = task.id
  newTask.value = {
    roomNumber: task.roomNumber === '—' ? '' : task.roomNumber,
    type: task.rawType || '',
    priority: task.priorityRaw || 'medium',
    staffId: task.staffId || '',
    notes: task.notes || '',
  }
  showNewModal.value = true
}

function openAssignModal() {
  assignStaff.value = ''
  assignSelection.value = []
  showAssignModal.value = true
}

async function saveTask() {
  if (!newTask.value.roomNumber || !newTask.value.type) {
    toast.error('Faltan datos', 'Habitación y tipo son obligatorios')
    return
  }
  const room = store.rooms.find(r => r.number === newTask.value.roomNumber)
  const roomId = room?.id || newTask.value.roomNumber
  const payload: Record<string, unknown> = {
    roomId,
    roomNumber: newTask.value.roomNumber,
    type: newTask.value.type,
    priority: newTask.value.priority || 'medium',
    notes: newTask.value.notes || '',
    staffId: newTask.value.staffId || '',
  }
  saving.value = true
  try {
    if (editingId.value) {
      await store.updateTask(editingId.value, payload)
      toast.success('Tarea actualizada', `Hab ${newTask.value.roomNumber}`)
    } else {
      payload.hotelId = hotelId.value
      payload.status = 'pending'
      await store.createTask(payload as any)
      toast.success('Tarea creada', `Hab ${newTask.value.roomNumber}`)
    }
    showNewModal.value = false
  } catch (e: any) {
    toast.error('No se pudo guardar la tarea', e?.message)
  } finally {
    saving.value = false
  }
}

async function assignSelected() {
  if (!assignStaff.value || assignSelection.value.length === 0) return
  try {
    await Promise.all(assignSelection.value.map(id => store.updateTask(id, { staffId: assignStaff.value })))
    toast.success('Tareas asignadas', `${assignSelection.value.length} tarea(s)`)
    showAssignModal.value = false
  } catch (e: any) { toast.error('No se pudieron asignar', e?.message) }
}

async function onPhotoSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    await store.uploadPhoto(selectedTask.value.id, file)
    syncSelectedTask(selectedTask.value.id)
    toast.success('Foto subida')
  } catch (err: any) { toast.error('No se pudo subir la foto', err?.message) }
  input.value = ''
}

async function onRemovePhoto(url: string) {
  try {
    await store.removePhoto(selectedTask.value.id, url)
    syncSelectedTask(selectedTask.value.id)
  } catch (e: any) { toast.error('No se pudo eliminar la foto', e?.message) }
}

function exportCsv() {
  const headers = ['Habitación', 'Tipo', 'Piso', 'Estado', 'Prioridad', 'Asignado', 'Inicio', 'Fin', 'Duración', 'Notas', 'Fotos']
  const rows = filteredTasks.value.map(t => [
    t.roomNumber,
    t.type,
    t.floor,
    statusLabel(t.status),
    t.priority,
    t.assignedTo,
    t.startTime || '',
    t.endTime || '',
    t.time || '',
    (t.notes || '').replace(/,/g, ';'),
    t.photos?.length || 0,
  ])
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `housekeeping-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exportado')
}

function switchView(view: string) {
  activeView.value = view
  if (view === 'stats') refreshStats()
}

function changeStatsRange(days: number) {
  statsRangeDays.value = days
  refreshStats()
}

async function refreshStats() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - statsRangeDays.value)
  try { await store.loadStats(from.toISOString(), to.toISOString()) }
  catch (e: any) { toast.error('Error al cargar estadísticas', e?.message) }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────
function onDragStart(e: DragEvent, task: HousekeepingViewTask) {
  draggedTask.value = task
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
  }
}

async function onDrop(_e: DragEvent, newStatus: string) {
  dragOverColumn.value = null
  const task = draggedTask.value
  draggedTask.value = null
  if (!task || task.status === newStatus) return
  try {
    // La transición a in_progress ARRANCA EL CRONÓMETRO: debe ir por start (setea startTime
    // + valida staffId asignado), no por update. Las demás transiciones van por update.
    if (newStatus === 'in_progress') {
      await store.startTask(task.id)
    } else {
      await store.updateTask(task.id, { status: newStatus })
    }
  } catch (err: any) {
    toast.error('No se pudo mover la tarea', err?.message)
  }
}

onMounted(() => store.load(hotelId.value))
</script>

<style scoped>
</style>
