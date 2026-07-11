<template>
  <div>
    <div class="flex items-center gap-2.5 mb-6">
      <h2 class="text-xl font-black text-navy">Mantenimiento</h2>
      <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
        <span class="relative flex h-1.5 w-1.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
          <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
        </span>
        En vivo
      </span>
    </div>

    <!-- Toolbar: fila 1 = navegación + acción primaria, fila 2 = filtros -->
    <div class="flex items-center justify-between gap-3 mb-3">
      <div class="flex gap-2">
        <button
          v-for="view in views"
          :key="view.value"
          @click="activeView = view.value"
          class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
          :class="activeView === view.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
        >
          {{ view.label }}
        </button>
      </div>
      <button @click="openNewOrder" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nueva Orden
      </button>
    </div>
    <div class="flex flex-wrap items-center gap-2 mb-6">
      <button
        v-for="filter in statusFilters"
        :key="filter.value"
        @click="activeFilter = filter.value"
        class="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer"
        :class="activeFilter === filter.value ? 'bg-navy/10 text-navy' : 'text-text-secondary hover:bg-surface'"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="rounded-[20px] border border-border bg-white p-4 shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="stat.bg">
            <span class="w-5 h-5" :class="stat.color" v-html="stat.icon"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums" :class="stat.color">{{ stat.value }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">{{ stat.label }}</div>
          </div>
        </div>
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
          <!-- Empty state: columna sin órdenes -->
          <div v-if="getColumnOrders(column.id).length === 0" class="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border/60 rounded-xl">
            <span class="w-7 h-7 mb-2 text-text-muted opacity-50" v-html="column.icon"></span>
            <p class="text-xs font-bold text-text-muted">Sin órdenes</p>
            <p class="text-[10px] text-text-muted/70 mt-1 px-2 leading-tight">{{ column.emptyHint }}</p>
          </div>
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
                {{ PRI_LABELS[order.priority] || order.priority }}
              </span>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(order.category)">
                {{ CAT_LABELS[order.category] || order.category }}
              </span>
            </div>
            <div class="text-sm font-black text-navy mb-1">{{ order.title }}</div>
            <div class="text-[11px] text-text-secondary mb-3">{{ order.location }}</div>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white" :class="staffColor(order.assignedTo)">
                  <span>{{ getInitials(order.assignedTo) }}</span>
                </div>
                <span class="text-[10px] font-medium text-navy">{{ order.assignedToName }}</span>
              </div>
              <span class="text-[10px] text-text-muted">{{ order.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-else class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-12 text-text-muted text-sm">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-navy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Cargando órdenes...
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">ID</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Título</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Ubicación</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Categoría</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Prioridad</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Duración</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Asignado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredOrders.length === 0">
            <td colspan="9" class="p-0">
              <div class="flex flex-col items-center justify-center py-16 text-center">
                <span class="w-10 h-10 mb-3 text-text-muted opacity-40" v-html="ICON_WRENCH"></span>
                <p class="text-sm font-bold text-navy">Sin órdenes de mantenimiento</p>
                <p class="text-xs text-text-muted mt-1">No hay órdenes para los filtros actuales.<br>Creá una nueva orden o ajustá los filtros.</p>
              </div>
            </td>
          </tr>
          <tr v-for="order in filteredOrders" :key="order.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer">
            <td class="p-4 text-sm font-mono text-text-muted">#{{ shortId(order.id) }}</td>
            <td class="p-4 text-sm font-bold text-navy">{{ order.title }}</td>
            <td class="p-4 text-sm">{{ order.location }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="categoryClass(order.category)">
                {{ CAT_LABELS[order.category] || order.category }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="priorityClass(order.priority)">
                {{ PRI_LABELS[order.priority] || order.priority }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(order.status)">
                {{ statusLabel(order.status) }}
              </span>
            </td>
            <td class="p-4">
              <span v-if="order.endTime && order.startTime" class="flex items-center gap-1 text-[10px] font-bold text-teal">
                <span class="w-3 h-3 shrink-0" v-html="ICON_CLOCK"></span>
                {{ formatDuration(order.startTime, order.endTime) }}
              </span>
              <span v-else-if="order.startTime" class="flex items-center gap-1 text-[10px] font-bold text-orange">
                <span class="w-3 h-3 shrink-0" v-html="ICON_CLOCK"></span>
                {{ formatElapsed(order.startTime) }}
              </span>
              <span v-else class="text-[10px] text-text-muted">—</span>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center">
                  <span class="text-[9px] font-bold text-navy">{{ getInitials(order.assignedToName) }}</span>
                </div>
                <span class="text-sm">{{ order.assignedToName }}</span>
              </div>
            </td>
            <td class="p-4 text-right">
              <div class="flex items-center gap-4 justify-end">
                <button @click.stop="openViewOrder(order)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Ver</button>
                <button @click.stop="openEditOrder(order)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
                <button @click.stop="openStatusModal(order)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cambiar Estado</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Ver Orden -->
    <Transition name="modal-fade">
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="modal-panel bg-white rounded-[20px] shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-mono text-text-muted">#{{ shortId(selectedOrder.id) }}</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="statusClass(selectedOrder.status)">{{ statusLabel(selectedOrder.status) }}</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="priorityClass(selectedOrder.priority)">{{ PRI_LABELS[selectedOrder.priority] || selectedOrder.priority }}</span>
            <span v-if="selectedOrder.startTime && !selectedOrder.endTime" class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange/10 text-orange">{{ formatElapsed(selectedOrder.startTime) }}</span>
          </div>
          <button @click="showViewModal = false" class="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-navy transition-colors cursor-pointer shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <!-- Body scrollable -->
        <div class="flex-1 overflow-y-auto px-6 pb-6">
          <div class="text-base font-black text-navy mb-3">{{ selectedOrder.title }}</div>
          <!-- Info grid tipográfico -->
          <div class="grid grid-cols-3 gap-x-3 gap-y-3 pb-5 border-b border-border">
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Ubicación</div>
              <div class="text-xs font-bold text-navy mt-0.5">{{ selectedOrder.location || '—' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Categoría</div>
              <div class="text-xs font-bold text-navy mt-0.5">{{ CAT_LABELS[selectedOrder.category] || selectedOrder.category }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Asignado</div>
              <div class="text-xs font-bold text-navy mt-0.5">{{ selectedOrder.assignedToName }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Fecha</div>
              <div class="text-xs font-bold text-navy mt-0.5">{{ selectedOrder.date || '—' }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Costo</div>
              <div class="text-xs font-bold text-navy mt-0.5">${{ selectedOrder.estimatedCost }}</div>
            </div>
            <div v-if="selectedOrder.endTime">
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Duración</div>
              <div class="text-xs font-bold text-navy mt-0.5">{{ formatDuration(selectedOrder.startTime, selectedOrder.endTime) }}</div>
            </div>
          </div>
          <!-- Descripción -->
          <div v-if="selectedOrder.description" class="py-4 border-b border-border text-xs text-text-secondary">{{ selectedOrder.description }}</div>
          <!-- Notas -->
          <div class="py-4 border-b border-border">
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Notas</div>
            <textarea v-if="selectedOrder.status !== 'closed'" v-model="editingNotes" rows="2" class="w-full px-3 py-2 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-navy resize-none" placeholder="Notas del técnico..."></textarea>
            <div v-else class="text-xs text-text-secondary">{{ selectedOrder.notes || '—' }}</div>
            <button v-if="selectedOrder.status !== 'closed' && editingNotes !== (selectedOrder.notes || '')" @click="saveNotes()" class="mt-1.5 text-[10px] font-bold text-cyan hover:underline cursor-pointer">Guardar notas</button>
          </div>
          <!-- Fotos -->
          <div class="py-4 border-b border-border">
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Fotos</div>
            <div v-if="!selectedOrder.photos || selectedOrder.photos.length === 0" class="text-xs text-text-muted">Sin fotos</div>
            <div v-else class="flex gap-1.5 flex-wrap">
              <div v-for="(photo, i) in selectedOrder.photos" :key="i" class="relative">
                <img :src="photo.url" class="w-12 h-12 object-cover rounded-lg border border-border">
                <span class="absolute -top-1 -right-1 text-[7px] px-1 py-0.5 rounded-full font-bold text-white" :class="photo.type === 'before' ? 'bg-orange' : photo.type === 'after' ? 'bg-teal' : 'bg-navy'">{{ photo.type }}</span>
              </div>
            </div>
            <div v-if="selectedOrder.status !== 'closed'" class="mt-2 flex gap-1.5 items-center flex-wrap">
              <label class="px-2.5 py-1 border border-border rounded-lg text-[10px] font-bold text-text-secondary cursor-pointer hover:border-navy/30 transition-colors">
                + Elegir foto
                <input type="file" accept="image/*" class="hidden" @change="onPhotoSelected($event)">
              </label>
              <select v-model="newPhotoType" class="px-2 py-1 border border-border rounded-lg text-[10px] cursor-pointer">
                <option value="before">Antes</option>
                <option value="during">Durante</option>
                <option value="after">Después</option>
              </select>
              <button v-if="newPhotoFile" @click="uploadPhoto()" class="text-[10px] font-bold text-cyan hover:underline cursor-pointer">Subir</button>
            </div>
          </div>
          <!-- Historial -->
          <div class="pt-4">
            <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5 cursor-pointer hover:text-navy transition-colors" @click="loadAuditHistory()">Historial <span class="font-normal normal-case">(clic para ver)</span></div>
            <div v-if="auditHistory.length === 0" class="text-xs text-text-muted">—</div>
            <div v-else class="space-y-1.5">
              <div v-for="entry in auditHistory" :key="entry.id" class="flex items-center gap-1.5 text-[11px]">
                <div class="w-1 h-1 rounded-full bg-navy/30 flex-shrink-0"></div>
                <span class="font-bold text-navy">{{ auditActionLabel(entry.action) }}</span>
                <span v-if="entry.newValue" class="text-text-muted">→ {{ entry.newValue }}</span>
                <span class="text-text-muted ml-auto">{{ formatDateTime(entry.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Footer -->
        <div class="flex items-center gap-4 justify-end px-6 py-4 border-t border-border shrink-0">
          <button @click="showViewModal = false" class="text-sm font-bold text-text-secondary hover:text-navy cursor-pointer transition-colors">Cerrar</button>
          <button v-if="selectedOrder.status === 'open'" @click="startOrder(selectedOrder)" class="px-4 py-2 bg-teal text-white rounded-full text-xs font-extrabold hover:shadow-lg transition-all cursor-pointer">Iniciar</button>
          <button v-if="selectedOrder.status === 'in_progress' || selectedOrder.status === 'waiting'" @click="completeOrder(selectedOrder)" class="px-4 py-2 bg-cyan text-navy rounded-full text-xs font-extrabold hover:shadow-lg transition-all cursor-pointer">Completar</button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Modal: Nueva Orden -->
    <Transition name="modal-fade">
    <div v-if="showNewModal" class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="modal-panel bg-white rounded-[20px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-7 pt-7 pb-5 shrink-0">
          <h3 class="text-xl font-black text-navy tracking-tight">{{ editingOrder ? 'Editar orden' : 'Nueva orden' }}</h3>
          <button @click="showNewModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-navy transition-colors cursor-pointer shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-7 pb-7 overflow-y-auto flex-1">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Título *</label>
              <input v-model="newOrder.title" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" :class="formErrors.title ? 'border-red' : ''" placeholder="Ej: Aire acondicionado no funciona">
              <p v-if="formErrors.title" class="text-[10px] text-red mt-1">{{ formErrors.title }}</p>
            </div>
            <div class="relative">
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Habitación *</label>
              <div class="relative">
                <input
                  v-model="roomSearch"
                  @focus="roomDropdownOpen = true"
                  @input="roomDropdownOpen = true"
                  @blur="closeDropdown(() => roomDropdownOpen = false)"
                  class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy pr-8"
                  :class="formErrors.roomNumber ? 'border-red' : ''"
                  placeholder="Buscar habitación..."
                >
                <button v-if="newOrder.roomNumber" @mousedown.prevent="clearRoom()" class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy text-xs cursor-pointer">✕</button>
              </div>
              <div v-if="roomDropdownOpen && filteredRooms.length" class="absolute z-10 mt-1 w-full bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                <div
                  v-for="room in filteredRooms"
                  :key="room.id"
                  @mousedown.prevent="selectRoom(room)"
                  class="px-4 py-2.5 text-sm cursor-pointer hover:bg-surface transition-colors"
                  :class="newOrder.roomId === room.id ? 'bg-navy/5 font-bold' : ''"
                >
                  <span class="font-bold text-navy">{{ room.number }}</span>
                  <span class="text-text-muted ml-2">{{ room.name || room.type }}</span>
                </div>
              </div>
              <p v-if="formErrors.roomNumber" class="text-[10px] text-red mt-1">{{ formErrors.roomNumber }}</p>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Categoría *</label>
              <select v-model="newOrder.category" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer" :class="formErrors.category ? 'border-red' : ''">
                <option value="">Seleccionar...</option>
                <option value="electrical">Eléctrico</option>
                <option value="plumbing">Plomería</option>
                <option value="hvac">Aire Acondicionado</option>
                <option value="carpentry">Carpintería</option>
                <option value="painting">Pintura</option>
                <option value="electronics">Electrónica</option>
                <option value="furniture">Muebles</option>
                <option value="appliance">Electrodomésticos</option>
                <option value="pest_control">Control de Plagas</option>
                <option value="general">Limpieza</option>
                <option value="structural">Otro</option>
              </select>
              <p v-if="formErrors.category" class="text-[10px] text-red mt-1">{{ formErrors.category }}</p>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Prioridad *</label>
              <select v-model="newOrder.priority" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="low">Baja</option>
                <option value="medium">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div class="relative">
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Asignar a</label>
              <div class="relative">
                <input
                  v-model="staffSearch"
                  @focus="staffDropdownOpen = true"
                  @input="staffDropdownOpen = true"
                  @blur="closeDropdown(() => staffDropdownOpen = false)"
                  class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy pr-8"
                  placeholder="Buscar empleado..."
                >
                <button v-if="newOrder.assignedTo" @mousedown.prevent="clearStaff()" class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-navy text-xs cursor-pointer">✕</button>
              </div>
              <div v-if="staffDropdownOpen && filteredStaff.length" class="absolute z-10 mt-1 w-full bg-white border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                <div
                  v-for="tech in filteredStaff"
                  :key="tech.id"
                  @mousedown.prevent="selectStaff(tech)"
                  class="px-4 py-2.5 text-sm cursor-pointer hover:bg-surface transition-colors flex items-center gap-2"
                  :class="newOrder.assignedTo === tech.id ? 'bg-navy/5 font-bold' : ''"
                >
                  <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center">
                    <span class="text-[9px] font-bold text-navy">{{ tech.name.split(' ').map((n: string) => n[0]).join('') }}</span>
                  </div>
                  <span class="text-navy">{{ tech.name }}</span>
                </div>
              </div>
            </div>
            <div class="col-span-2">
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Descripción *</label>
              <textarea v-model="newOrder.description" rows="3" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Describa el problema detalladamente..."></textarea>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Costo Estimado</label>
              <input v-model="newOrder.estimatedCost" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy" placeholder="0.00">
            </div>
          </div>
        </div>
        <div class="flex items-center gap-4 justify-end px-7 py-5 border-t border-border shrink-0">
          <button @click="showNewModal = false" class="text-sm font-bold text-text-secondary hover:text-navy cursor-pointer transition-colors">Cancelar</button>
          <button @click="createOrder" :disabled="saving" class="px-5 py-2.5 bg-navy text-white rounded-full text-sm font-extrabold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{{ saving ? 'Guardando...' : (editingOrder ? 'Guardar Cambios' : 'Crear Orden') }}</button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Modal: Cambiar Estado -->
    <Transition name="modal-fade">
    <div v-if="showStatusModal" class="fixed inset-0 bg-navy/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="modal-panel bg-white rounded-[20px] shadow-2xl w-full max-w-md overflow-hidden">
        <div class="flex items-center justify-between px-7 pt-7 pb-5">
          <h3 class="text-xl font-black text-navy tracking-tight">Cambiar estado</h3>
          <button @click="showStatusModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-navy transition-colors cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="px-7 pb-6">
          <div class="mb-5">
            <div class="text-xs font-mono text-text-muted">#{{ shortId(selectedOrder.id) }}</div>
            <div class="text-base font-black text-navy mt-0.5">{{ selectedOrder.title }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="status in availableStatuses"
              :key="status.value"
              @click="changeStatus(status.value)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer"
              :class="selectedOrder.status === status.value ? [statusClass(status.value), statusBorderFromDot(status.dotColor)] : 'border-border text-text-secondary hover:border-navy/30'"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="status.dotColor"></span>
              {{ status.label }}
            </button>
          </div>
        </div>
        <div class="px-7 py-5 border-t border-border">
          <button @click="showStatusModal = false" class="text-sm font-bold text-text-secondary hover:text-navy cursor-pointer transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCountUp } from '@/composables/useCountUp'
import { OperationsService } from '@/services/Operations.service'
import { RoomService } from '@/services/Room.service'
import { EmpleadosService } from '@/services/Empleados.service'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const MS_PER_HOUR = 3_600_000
const MS_PER_MINUTE = 60_000

const activeView = ref('list')
const activeFilter = ref('all')
const showViewModal = ref(false)
const showNewModal = ref(false)
const editingOrder = ref<any>(null)
const showStatusModal = ref(false)
const selectedOrder = ref<any>({})

const ICON_WRENCH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"/></svg>'
const ICON_COG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.241.437-.613.43-.991a7.66 7.66 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK_PLAIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'

const views = [
  { label: 'Lista', value: 'list' },
  { label: 'Tablero', value: 'board' }
]

const statusFilters = [
  { label: 'Todas', value: 'all' },
  { label: 'Abiertas', value: 'open' },
  { label: 'En Progreso', value: 'in_progress' },
  { label: 'Esperando', value: 'waiting' },
  { label: 'Completadas', value: 'closed' }
]

const kanbanColumns = [
  { id: 'open', title: 'Abierta', dotColor: 'bg-orange', icon: ICON_WRENCH, emptyHint: 'Las órdenes nuevas aparecen acá' },
  { id: 'in_progress', title: 'En Progreso', dotColor: 'bg-cyan', icon: ICON_COG, emptyHint: 'Arrastrá acá las órdenes en trabajo' },
  { id: 'waiting', title: 'Esperando', dotColor: 'bg-purple', icon: ICON_CLOCK, emptyHint: 'Órdenes pausadas o esperando repuestos' },
  { id: 'closed', title: 'Completada', dotColor: 'bg-teal', icon: ICON_CHECK_PLAIN, emptyHint: 'Órdenes resueltas' }
]

const availableStatuses = [
  { value: 'open', label: 'Abierta', description: 'Problema reportado, esperando asignación', dotColor: 'bg-orange' },
  { value: 'in_progress', label: 'En Progreso', description: 'Técnico trabajando en la solución', dotColor: 'bg-cyan' },
  { value: 'waiting', label: 'Esperando', description: 'Esperando repuestos o aprobación', dotColor: 'bg-purple' },
  { value: 'closed', label: 'Completada', description: 'Problema resuelto verificado', dotColor: 'bg-teal' }
]

const maintenanceStaff = computed(() =>
  hotelStaff.value.map(e => ({ id: e.userId, name: e.userName || e.position || 'Empleado' }))
)

const orders = ref<any[]>([])

// Fuentes numéricas separadas de `stats` para poder animarlas con useCountUp
// (el composable lee `.value` de inmediato al llamarse, así que debe ir DESPUÉS
// de que `orders` esté declarado — a diferencia de un computed normal, que es perezoso).
const openCount = computed(() => orders.value.filter((x: any) => x.status === 'open').length)
const inProgressCount = computed(() => orders.value.filter((x: any) => x.status === 'in_progress').length)
const unassignedCount = computed(() => orders.value.filter((x: any) => !x.assignedTo && x.status !== 'closed').length)
const closedCount = computed(() => orders.value.filter((x: any) => x.status === 'closed').length)
const totalCostValue = computed(() => orders.value.reduce((s: number, x: any) => s + (x.estimatedCost ?? 0), 0))
const avgHoursValue = computed(() => {
  const closed = orders.value.filter((x: any) => (x.status === 'closed' || x.status === 'resolved') && x.startTime && x.endTime)
  if (closed.length === 0) return 0
  return closed.reduce((sum: number, x: any) => sum + (new Date(x.endTime).getTime() - new Date(x.startTime).getTime()), 0) / closed.length / MS_PER_HOUR
})

const openAnim = useCountUp(openCount)
const inProgressAnim = useCountUp(inProgressCount)
const unassignedAnim = useCountUp(unassignedCount)
const closedAnim = useCountUp(closedCount)
const totalCostAnim = useCountUp(totalCostValue)
const avgHoursAnim = useCountUp(avgHoursValue)

const stats = computed(() => [
  { label: 'Abiertas', value: String(Math.round(openAnim.value)), color: 'text-orange', bg: 'bg-orange/10', icon: ICON_WRENCH },
  { label: 'En Progreso', value: String(Math.round(inProgressAnim.value)), color: 'text-cyan', bg: 'bg-cyan/10', icon: ICON_COG },
  { label: 'Sin Asignar', value: String(Math.round(unassignedAnim.value)), color: 'text-red', bg: 'bg-red/10', icon: ICON_USER },
  { label: 'Completadas', value: String(Math.round(closedAnim.value)), color: 'text-teal', bg: 'bg-teal/10', icon: ICON_CHECK_PLAIN },
  { label: 'Tiempo Prom.', value: avgHoursAnim.value > 0.05 ? `${(Math.round(avgHoursAnim.value * 10) / 10)}h` : '—', color: 'text-navy', bg: 'bg-navy/10', icon: ICON_CLOCK },
  { label: 'Costo Total', value: `$${Math.round(totalCostAnim.value).toLocaleString()}`, color: 'text-navy', bg: 'bg-navy/10', icon: ICON_WALLET },
])

const loading = ref(false)
const saving = ref(false)
const formErrors = ref<Record<string, string>>({})
const hotelRooms = ref<any[]>([])
const hotelStaff = ref<any[]>([])
const staffMap = ref<Record<string, string>>({})
const draggedOrder = ref<any>(null)
const dragOverCol = ref<string | null>(null)

// Autocomplete state — Habitación
const roomSearch = ref('')
const roomDropdownOpen = ref(false)
const filteredRooms = computed(() => {
  const q = roomSearch.value.toLowerCase()
  if (!q) return hotelRooms.value.slice(0, 20)
  return hotelRooms.value.filter(r => r.number.toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q)).slice(0, 20)
})
function selectRoom(room: any) {
  newOrder.value.roomId = room.id
  newOrder.value.roomNumber = room.number
  roomSearch.value = `${room.number} — ${room.name || room.type}`
  roomDropdownOpen.value = false
}
function clearRoom() {
  newOrder.value.roomId = ''
  newOrder.value.roomNumber = ''
  roomSearch.value = ''
}

// Autocomplete state — Asignar a
const staffSearch = ref('')
const staffDropdownOpen = ref(false)
const filteredStaff = computed(() => {
  const q = staffSearch.value.toLowerCase()
  if (!q) return maintenanceStaff.value.slice(0, 20)
  return maintenanceStaff.value.filter(s => s.name.toLowerCase().includes(q)).slice(0, 20)
})
function selectStaff(staff: any) {
  newOrder.value.assignedTo = staff.id
  staffSearch.value = staff.name
  staffDropdownOpen.value = false
}
function clearStaff() {
  newOrder.value.assignedTo = ''
  staffSearch.value = ''
}

function closeDropdown(fn: () => void) {
  setTimeout(fn, 200)
}

const PRI_LABELS: Record<string, string> = { high: 'Alta', medium: 'Normal', low: 'Baja', urgent: 'Urgente' }
const CAT_LABELS: Record<string, string> = { hvac: 'Aire Acond.', plumbing: 'Plomería', electrical: 'Eléctrico', electronics: 'Electrónica', general: 'General', carpentry: 'Carpintería', painting: 'Pintura', structural: 'Estructural', pest_control: 'Plagas', furniture: 'Muebles', appliance: 'Electrodom.' }

onMounted(async () => {
  await Promise.all([loadData(), loadRooms(), loadStaff()])
})

async function loadData() {
  loading.value = true
  try {
    const res = await OperationsService.mantenimiento.list(hotelId.value) as any
    const items = res.data || res
    orders.value = (Array.isArray(items) ? items : []).map((o: any) => ({
      id: o.id,
      title: o.title || 'Sin título',
      location: o.roomNumber ? `Hab ${o.roomNumber}` : '',
      category: o.category || 'general',
      priority: o.priority || 'medium',
      status: o.status || 'open',
      assignedTo: o.assignedTo || 'Sin asignar',
      assignedToName: staffMap.value[o.assignedTo] || o.assignedTo || 'Sin asignar',
      date: o.reportedDate ? String(o.reportedDate).slice(0, 10) : '',
      description: o.description || '',
      estimatedCost: o.estimatedCost || 0,
      roomId: o.roomId || null,
      startTime: o.startTime || null,
      endTime: o.endTime || null,
      notes: o.notes || '',
      photos: o.photos || [],
    }))
  } catch {
    toast.error('Error al cargar órdenes de mantenimiento')
  } finally {
    loading.value = false
  }
}

async function loadRooms() {
  if (!hotelId.value) return
  try {
    const { rooms } = await RoomService.list({ hotelId: hotelId.value, limit: 200 })
    hotelRooms.value = rooms
  } catch { /* silent — rooms are optional for the form */ }
}

async function loadStaff() {
  if (!hotelId.value) return
  try {
    const res = await EmpleadosService.listProfiles({ hotelId: hotelId.value, limit: 100 }) as any
    const items = res.data || res
    hotelStaff.value = Array.isArray(items) ? items : []
    const map: Record<string, string> = {}
    for (const e of hotelStaff.value) {
      if (e.userId) map[e.userId] = e.userName || e.position || 'Empleado'
    }
    staffMap.value = map
  } catch { /* silent — staff is optional */ }
}

const newOrder = ref({
  title: '',
  roomId: '',
  roomNumber: '',
  category: '',
  priority: 'medium',
  assignedTo: '',
  description: '',
  estimatedCost: '',
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

function shortId(id: string): string {
  return id ? id.slice(0, 8).toUpperCase() : ''
}

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    open: 'bg-orange/10 text-orange',
    in_progress: 'bg-cyan/10 text-cyan',
    waiting: 'bg-purple/10 text-purple',
    closed: 'bg-teal/10 text-teal',
    resolved: 'bg-teal/10 text-teal',
  }
  return classes[status] || 'bg-surface text-text-muted'
}

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    open: 'Abierta',
    in_progress: 'En Progreso',
    waiting: 'Esperando',
    closed: 'Completada',
    resolved: 'Resuelta',
  }
  return labels[status] || status
}

const priorityClass = (priority: string) => {
  const classes: Record<string, string> = {
    low: 'bg-surface text-text-muted',
    medium: 'bg-blue/10 text-blue',
    high: 'bg-orange/10 text-orange',
    urgent: 'bg-red/10 text-red'
  }
  return classes[priority] || 'bg-surface text-text-muted'
}

const categoryClass = (category: string) => {
  const classes: Record<string, string> = {
    electrical: 'bg-yellow/10 text-yellow',
    plumbing: 'bg-blue/10 text-blue',
    hvac: 'bg-cyan/10 text-cyan',
    carpentry: 'bg-orange/10 text-orange',
    painting: 'bg-purple/10 text-purple',
    electronics: 'bg-navy/10 text-navy',
    general: 'bg-teal/10 text-teal',
    structural: 'bg-surface text-text-muted',
    pest_control: 'bg-red/10 text-red',
  }
  return classes[category] || 'bg-surface text-text-muted'
}

const openViewOrder = (order: any) => {
  selectedOrder.value = order
  editingNotes.value = order.notes || ''
  showViewModal.value = true
}

const openNewOrder = () => {
  editingOrder.value = null
  formErrors.value = {}
  newOrder.value = { title: '', roomId: '', roomNumber: '', category: '', priority: 'medium', assignedTo: '', description: '', estimatedCost: '' }
  roomSearch.value = ''
  staffSearch.value = ''
  showNewModal.value = true
}

const openEditOrder = (order: any) => {
  editingOrder.value = order
  formErrors.value = {}
  newOrder.value = {
    title: order.title || '',
    roomId: order.roomId || '',
    roomNumber: order.location?.replace('Hab ', '') || '',
    category: order.category || '',
    priority: order.priority || 'medium',
    assignedTo: order.assignedTo === 'Sin asignar' ? '' : order.assignedTo || '',
    description: order.description || '',
    estimatedCost: order.estimatedCost ? String(order.estimatedCost) : '',
  }
  // Set search displays for autocomplete
  const room = hotelRooms.value.find(r => r.number === newOrder.value.roomNumber)
  roomSearch.value = room ? `${room.number} — ${room.name || room.type}` : newOrder.value.roomNumber
  const staff = maintenanceStaff.value.find(s => s.id === newOrder.value.assignedTo)
  staffSearch.value = staff?.name || ''
  showNewModal.value = true
}

const openStatusModal = (order: any) => {
  selectedOrder.value = order
  showStatusModal.value = true
}

const createOrder = async () => {
  formErrors.value = {}
  if (!newOrder.value.title || newOrder.value.title.length < 2) formErrors.value.title = 'Título requerido (mín. 2 caracteres)'
  if (!newOrder.value.roomNumber) formErrors.value.roomNumber = 'Ubicación requerida'
  if (!newOrder.value.category) formErrors.value.category = 'Categoría requerida'
  if (Object.keys(formErrors.value).length > 0) return
  saving.value = true
  // Resolve roomId from selected roomNumber
  const selectedRoom = hotelRooms.value.find(r => r.number === newOrder.value.roomNumber)
  const resolvedRoomId = selectedRoom?.id || newOrder.value.roomId || undefined
  try {
    if (editingOrder.value) {
      await OperationsService.mantenimiento.update(editingOrder.value.id, {
        title: newOrder.value.title,
        category: newOrder.value.category || 'general',
        priority: newOrder.value.priority || 'medium',
        description: newOrder.value.description || '',
        roomId: resolvedRoomId,
        roomNumber: newOrder.value.roomNumber || '',
        assignedTo: newOrder.value.assignedTo || '',
        estimatedCost: newOrder.value.estimatedCost ? parseInt(newOrder.value.estimatedCost) : 0,
      })
      toast.success('Orden actualizada')
    } else {
      await OperationsService.mantenimiento.create({
        title: newOrder.value.title,
        hotelId: hotelId.value,
        category: newOrder.value.category || 'general',
        priority: newOrder.value.priority || 'medium',
        status: 'open',
        description: newOrder.value.description || '',
        roomId: resolvedRoomId,
        roomNumber: newOrder.value.roomNumber || '',
        assignedTo: newOrder.value.assignedTo || '',
        estimatedCost: newOrder.value.estimatedCost ? parseInt(newOrder.value.estimatedCost) : 0,
        reportedDate: new Date().toISOString(),
      })
      toast.success('Orden de mantenimiento creada')
    }
    showNewModal.value = false
    editingOrder.value = null
    await loadData()
  } catch { toast.error(editingOrder.value ? 'Error al actualizar orden' : 'Error al crear orden') }
  finally { saving.value = false }
}

const completeOrder = async (order: any) => {
  try {
    await OperationsService.mantenimiento.post(`${order.id}/complete`, { notes: editingNotes.value || undefined })
    toast.success('Orden completada')
    showViewModal.value = false
    await loadData()
  } catch { toast.error('Error al completar orden') }
}

const startOrder = async (order: any) => {
  try {
    await OperationsService.mantenimiento.post(`${order.id}/start`, {})
    toast.success('Orden iniciada — cronómetro activo')
    showViewModal.value = false
    await loadData()
  } catch { toast.error('Error al iniciar orden') }
}

const editingNotes = ref('')
const auditHistory = ref<any[]>([])
const newPhotoFile = ref<File | null>(null)
const newPhotoType = ref('before')

const onPhotoSelected = (e: Event) => {
  const input = e.target as HTMLInputElement
  newPhotoFile.value = input.files?.[0] || null
}

const uploadPhoto = async () => {
  if (!selectedOrder.value?.id || !newPhotoFile.value) return
  const formData = new FormData()
  formData.append('photo', newPhotoFile.value)
  formData.append('type', newPhotoType.value)
  try {
    await OperationsService.mantenimiento.post(`${selectedOrder.value.id}/photos`, formData)
    newPhotoFile.value = null
    toast.success('Foto subida')
    await loadData()
    const updated = orders.value.find(o => o.id === selectedOrder.value.id)
    if (updated) selectedOrder.value = updated
  } catch { toast.error('Error al subir foto') }
}

const loadAuditHistory = async () => {
  if (!selectedOrder.value?.id) return
  try {
    const res = await OperationsService.mantenimiento.get(`${selectedOrder.value.id}/audit`) as any
    auditHistory.value = Array.isArray(res) ? res : (res.data || [])
  } catch { /* silent */ }
}

const auditActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    created: 'Creada',
    status_change: 'Estado cambiado',
    assignment: 'Asignación',
    notes_added: 'Notas actualizadas',
    photo_added: 'Foto agregada',
    priority_change: 'Prioridad cambiada',
    cost_updated: 'Costo actualizado',
  }
  return labels[action] || action
}

const saveNotes = async () => {
  if (!selectedOrder.value?.id) return
  try {
    await OperationsService.mantenimiento.put(`${selectedOrder.value.id}/notes`, { notes: editingNotes.value })
    const order = orders.value.find(o => o.id === selectedOrder.value.id)
    if (order) order.notes = editingNotes.value
    toast.success('Notas guardadas')
  } catch { toast.error('Error al guardar notas') }
}

// ─── Timer formatting ───────────────────────────────────
function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const hours = Math.floor(ms / MS_PER_HOUR)
  const mins = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

function formatElapsed(start: string): string {
  const ms = Date.now() - new Date(start).getTime()
  const hours = Math.floor(ms / MS_PER_HOUR)
  const mins = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  if (hours > 0) return `${hours}h ${mins}min (en curso)`
  return `${mins}min (en curso)`
}

function formatDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const changeStatus = async (status: string) => {
  if (!selectedOrder.value?.id) return
  if (selectedOrder.value.status === status) { showStatusModal.value = false; return }
  try {
    await OperationsService.mantenimiento.update(selectedOrder.value.id, { status })
    const order = orders.value.find(o => o.id === selectedOrder.value.id)
    if (order) order.status = status
    toast.success(`Estado actualizado a "${statusLabel(status)}"`)
    showStatusModal.value = false
  } catch { toast.error('Error al cambiar estado') }
}

// ─── Drag & Drop Kanban ─────────────────────────────────────────────
function catBorder(cat: string) {
  const map: Record<string, string> = { hvac: 'border-l-cyan-500', plumbing: 'border-l-blue-500', electronics: 'border-l-amber-500', electrical: 'border-l-yellow-500', general: 'border-l-gray-400', carpentry: 'border-l-yellow-600', painting: 'border-l-purple-500', structural: 'border-l-red-500', pest_control: 'border-l-red-500' }
  return map[cat] || 'border-l-gray-300'
}

// Deriva el color de borde a partir del dot de estado (ej. 'bg-orange' → 'border-orange')
// para que el pill seleccionado en "Cambiar Estado" use el acento propio de cada estado.
function statusBorderFromDot(dotColor: string) {
  return dotColor.replace('bg-', 'border-')
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
    toast.success(`Orden movida a "${statusLabel(newStatus)}"`)
  } catch { toast.error('Error al mover orden') }
  draggedOrder.value = null
}
</script>

<style scoped>
/* Entrada/salida de los modales: backdrop se desvanece, el panel además escala y sube levemente. */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.95) translateY(12px);
}
</style>
