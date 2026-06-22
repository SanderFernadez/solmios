<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-black text-navy">Gestión de Hoteles</h1>
        <p class="text-sm text-text-muted">{{ filteredHotels.length }} hoteles encontrados</p>
      </div>
      <div class="flex gap-2">
        <button @click="viewMode = 'table'" class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer" :class="viewMode === 'table' ? 'bg-navy text-white' : 'bg-white border border-border text-text-muted hover:border-navy/30'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
        </button>
        <button @click="viewMode = 'grid'" class="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer" :class="viewMode === 'grid' ? 'bg-navy text-white' : 'bg-white border border-border text-text-muted hover:border-navy/30'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>
        </button>
        <button @click="openNewHotel" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Hotel</button>
      </div>
    </div>

    <!-- Métricas -->
    <div class="grid grid-cols-5 gap-3 mb-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl p-4 border border-border text-center card-shadow">
        <div class="text-xl font-black" :class="stat.color">{{ stat.value }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Filtros Avanzados -->
    <div class="bg-white rounded-2xl border border-border card-shadow p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold text-text-muted uppercase">Filtros</span>
          <span v-if="activeFiltersCount > 0" class="bg-cyan/20 text-cyan text-[10px] font-bold px-2 py-0.5 rounded-full">{{ activeFiltersCount }} activos</span>
        </div>
        <button v-if="activeFiltersCount > 0" @click="clearAllFilters" class="text-[10px] font-bold text-red hover:text-red/80 transition-colors cursor-pointer">Limpiar todo</button>
      </div>

      <!-- Fila 1: Búsqueda + Estado + Plan -->
      <div class="grid grid-cols-4 gap-3 mb-3">
        <div class="relative">
          <input v-model="searchQuery" type="text" placeholder="Buscar por nombre, email, ubicación..." class="w-full h-10 pl-9 pr-4 rounded-lg border border-border text-sm bg-surface focus:outline-none focus:border-cyan">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <select v-model="activeFilter" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="all">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Suspendido">Suspendido</option>
        </select>
        <select v-model="planFilter" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="all">Todos los planes</option>
          <option value="Enterprise">Enterprise</option>
          <option value="Professional">Professional</option>
          <option value="Starter">Starter</option>
        </select>
        <select v-model="locationFilter" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="all">Todas las ubicaciones</option>
          <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
        </select>
      </div>

      <!-- Fila 2: Ocupación + MRR + Ordenamiento -->
      <div class="grid grid-cols-4 gap-3">
        <select v-model="occupancyFilter" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="all">Cualquier ocupación</option>
          <option value="high">Alta (>80%)</option>
          <option value="medium">Media (50-80%)</option>
          <option value="low">Baja (<50%)</option>
        </select>
        <select v-model="mrrFilter" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="all">Cualquier MRR</option>
          <option value="high">$100+</option>
          <option value="medium">$50-$99</option>
          <option value="low">$49</option>
        </select>
        <select v-model="sortBy" class="h-10 px-4 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
          <option value="name-asc">Nombre (A-Z)</option>
          <option value="name-desc">Nombre (Z-A)</option>
          <option value="mrr-desc">MRR (Mayor)</option>
          <option value="mrr-asc">MRR (Menor)</option>
          <option value="rooms-desc">Habitaciones (Mayor)</option>
          <option value="occupancy-desc">Ocupación (Mayor)</option>
          <option value="registered-desc">Más recientes</option>
        </select>
        <div class="flex gap-2">
          <button @click="exportHotels" class="flex-1 h-10 px-4 bg-surface border border-border rounded-xl text-sm font-bold text-text-secondary hover:bg-surface-dark transition-colors cursor-pointer flex items-center justify-center gap-2">
            <span>📥</span> Exportar
          </button>
        </div>
      </div>
    </div>

    <!-- Vista Tabla -->
    <div v-if="viewMode === 'table'" class="bg-white rounded-2xl border border-border card-shadow overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th @click="toggleSort('name')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">
              <div class="flex items-center gap-1">Hotel <span v-if="sortBy.startsWith('name')" class="text-cyan">{{ sortBy.endsWith('asc') ? '↑' : '↓' }}</span></div>
            </th>
            <th @click="toggleSort('location')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">
              <div class="flex items-center gap-1">Ubicación <span v-if="sortBy.startsWith('location')" class="text-cyan">{{ sortBy.endsWith('asc') ? '↑' : '↓' }}</span></div>
            </th>
            <th @click="toggleSort('plan')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">Plan</th>
            <th @click="toggleSort('rooms')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">
              <div class="flex items-center gap-1">Hab. <span v-if="sortBy.startsWith('rooms')" class="text-cyan">{{ sortBy.endsWith('asc') ? '↑' : '↓' }}</span></div>
            </th>
            <th @click="toggleSort('occupancy')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">
              <div class="flex items-center gap-1">Ocupación <span v-if="sortBy.startsWith('occupancy')" class="text-cyan">{{ sortBy.endsWith('asc') ? '↑' : '↓' }}</span></div>
            </th>
            <th @click="toggleSort('mrr')" class="text-left p-4 text-[10px] font-bold text-text-muted uppercase cursor-pointer hover:text-navy">
              <div class="flex items-center gap-1">MRR <span v-if="sortBy.startsWith('mrr')" class="text-cyan">{{ sortBy.endsWith('asc') ? '↑' : '↓' }}</span></div>
            </th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hotel in filteredHotels" :key="hotel.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4">
              <div class="flex items-center gap-3 cursor-pointer" @click="openViewHotel(hotel)">
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-sm font-bold">{{ hotel.name[0] }}</div>
                <div>
                  <div class="text-sm font-bold text-navy">{{ hotel.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ hotel.email }}</div>
                </div>
              </div>
            </td>
            <td class="p-4 text-sm">{{ hotel.location }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="planClass(hotel.plan)">{{ hotel.plan }}</span></td>
            <td class="p-4 text-sm font-bold">{{ hotel.rooms }}</td>
            <td class="p-4">
              <div class="flex items-center gap-2">
                <div class="w-16 h-2 bg-surface rounded-full"><div class="h-2 rounded-full" :class="hotel.occupancy > 80 ? 'bg-teal' : hotel.occupancy > 50 ? 'bg-orange' : 'bg-red'" :style="{ width: `${hotel.occupancy}%` }"></div></div>
                <span class="text-[10px] font-bold">{{ hotel.occupancy }}%</span>
              </div>
            </td>
            <td class="p-4 text-sm font-black text-navy">${{ hotel.mrr }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(hotel.status)">{{ hotel.status }}</span></td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click="openViewHotel(hotel)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button @click="openEditHotel(hotel)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
                <button @click="openSuspendModal(hotel)" class="px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer" :class="hotel.status === 'Suspendido' ? 'bg-teal/10 text-teal hover:bg-teal/20' : 'bg-red/10 text-red hover:bg-red/20'">{{ hotel.status === 'Suspendido' ? 'Reactivar' : 'Suspender' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredHotels.length === 0" class="p-12 text-center">
        <div class="text-4xl mb-3">🏨</div>
        <div class="text-sm font-bold text-text-muted">No se encontraron hoteles</div>
        <div class="text-[10px] text-text-muted">Intenta ajustar los filtros</div>
      </div>
    </div>

    <!-- Vista Grid -->
    <div v-else class="grid grid-cols-3 gap-4">
      <div v-for="hotel in filteredHotels" :key="hotel.id" class="bg-white rounded-2xl border border-border card-shadow p-5 hover:shadow-lg transition-all">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-lg font-black">{{ hotel.name[0] }}</div>
            <div>
              <div class="text-sm font-bold text-navy">{{ hotel.name }}</div>
              <div class="text-[10px] text-text-muted">{{ hotel.location }}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(hotel.status)">{{ hotel.status }}</span>
        </div>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="text-center"><div class="text-lg font-black text-navy">{{ hotel.rooms }}</div><div class="text-[9px] text-text-muted uppercase">Hab.</div></div>
          <div class="text-center"><div class="text-lg font-black" :class="hotel.occupancy > 80 ? 'text-teal' : hotel.occupancy > 50 ? 'text-orange' : 'text-red'">{{ hotel.occupancy }}%</div><div class="text-[9px] text-text-muted uppercase">Ocup.</div></div>
          <div class="text-center"><div class="text-lg font-black text-navy">${{ hotel.mrr }}</div><div class="text-[9px] text-text-muted uppercase">MRR</div></div>
        </div>
        <div class="flex items-center justify-between mb-4">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="planClass(hotel.plan)">{{ hotel.plan }}</span>
          <span class="text-[10px] text-text-muted">{{ hotel.users }} usuarios</span>
        </div>
        <div class="flex gap-2">
          <button @click="openViewHotel(hotel)" class="flex-1 py-2 bg-surface rounded-lg text-[10px] font-bold text-text-secondary hover:bg-surface-dark transition-colors cursor-pointer">Ver</button>
          <button @click="openEditHotel(hotel)" class="flex-1 py-2 bg-navy/10 rounded-lg text-[10px] font-bold text-navy hover:bg-navy/20 transition-colors cursor-pointer">Editar</button>
          <button @click="openSuspendModal(hotel)" class="py-2 px-3 rounded-lg text-[10px] font-bold transition-colors cursor-pointer" :class="hotel.status === 'Suspendido' ? 'bg-teal/10 text-teal hover:bg-teal/20' : 'bg-red/10 text-red hover:bg-red/20'">
            {{ hotel.status === 'Suspendido' ? '↑' : '↓' }}
          </button>
        </div>
      </div>
      <div v-if="filteredHotels.length === 0" class="col-span-3 p-12 text-center">
        <div class="text-4xl mb-3">🏨</div>
        <div class="text-sm font-bold text-text-muted">No se encontraron hoteles</div>
        <div class="text-[10px] text-text-muted">Intenta ajustar los filtros</div>
      </div>
    </div>

    <!-- Modal: Ver Hotel -->
    <div v-if="showViewModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showViewModal = false">
      <div class="bg-white rounded-2xl w-full max-w-2xl card-shadow max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">Detalle del Hotel</h3>
          <button @click="showViewModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-navy to-cyan flex items-center justify-center text-white text-2xl font-black">{{ selectedHotel.name[0] }}</div>
            <div>
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-black text-navy">{{ selectedHotel.name }}</h2>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(selectedHotel.status)">{{ selectedHotel.status }}</span>
              </div>
              <div class="text-sm text-text-muted">{{ selectedHotel.location }} — {{ selectedHotel.email }}</div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-surface rounded-xl p-4 text-center"><div class="text-2xl font-black text-navy">{{ selectedHotel.rooms }}</div><div class="text-[10px] text-text-muted uppercase">Habitaciones</div></div>
            <div class="bg-surface rounded-xl p-4 text-center"><div class="text-2xl font-black text-teal">{{ selectedHotel.occupancy }}%</div><div class="text-[10px] text-text-muted uppercase">Ocupación</div></div>
            <div class="bg-surface rounded-xl p-4 text-center"><div class="text-2xl font-black text-navy">${{ selectedHotel.mrr }}</div><div class="text-[10px] text-text-muted uppercase">MRR</div></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><div class="text-[10px] font-bold text-text-muted uppercase mb-1">Plan Actual</div><span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="planClass(selectedHotel.plan)">{{ selectedHotel.plan }}</span></div>
            <div><div class="text-[10px] font-bold text-text-muted uppercase mb-1">Usuarios</div><div class="text-sm font-bold">{{ selectedHotel.users }}</div></div>
            <div><div class="text-[10px] font-bold text-text-muted uppercase mb-1">Teléfono</div><div class="text-sm">{{ selectedHotel.phone }}</div></div>
            <div><div class="text-[10px] font-bold text-text-muted uppercase mb-1">Registro</div><div class="text-sm">{{ selectedHotel.registered }}</div></div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showViewModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cerrar</button>
          <button @click="showViewModal = false; openEditHotel(selectedHotel)" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">Editar Hotel</button>
        </div>
      </div>
    </div>

    <!-- Modal: Nuevo/Editar Hotel -->
    <div v-if="showEditModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showEditModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg card-shadow max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">{{ editingHotel.id ? 'Editar Hotel' : 'Registrar Nuevo Hotel' }}</h3>
          <button @click="showEditModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2"><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre del Hotel *</label><input v-model="editingHotel.name" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Email *</label><input v-model="editingHotel.email" type="email" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Teléfono</label><input v-model="editingHotel.phone" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Ubicación *</label><input v-model="editingHotel.location" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Habitaciones</label><input v-model.number="editingHotel.rooms" type="number" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy"></div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Plan *</label>
              <select v-model="editingHotel.plan" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="Starter">Starter — $49/mes</option>
                <option value="Professional">Professional — $99/mes</option>
                <option value="Enterprise">Enterprise — $199/mes</option>
              </select>
            </div>
            <div><label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Estado</label>
              <select v-model="editingHotel.status" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="Activo">Activo</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showEditModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="saveHotel" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer">{{ editingHotel.id ? 'Guardar Cambios' : 'Registrar Hotel' }}</button>
        </div>
      </div>
    </div>

    <!-- Modal: Suspender -->
    <div v-if="showSuspendModal" class="fixed inset-0 bg-navy/50 flex items-center justify-center z-50" @click.self="showSuspendModal = false">
      <div class="bg-white rounded-2xl w-full max-w-md card-shadow">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="text-lg font-black text-navy">{{ selectedHotel.status === 'Suspendido' ? 'Reactivar' : 'Suspender' }} Hotel</h3>
          <button @click="showSuspendModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy transition-colors cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <div class="text-sm font-bold text-navy mb-2">{{ selectedHotel.name }}</div>
          <div class="text-[10px] text-text-muted mb-4">{{ selectedHotel.location }}</div>
          <div v-if="selectedHotel.status !== 'Suspendido'" class="mb-4">
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Motivo de Suspensión *</label>
            <textarea v-model="suspendReason" rows="3" class="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-navy resize-none" placeholder="Ej: Pago no recibido..."></textarea>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showSuspendModal = false" class="flex-1 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark transition-colors cursor-pointer">Cancelar</button>
          <button @click="toggleSuspend" class="flex-1 py-2.5 rounded-xl text-sm font-extrabold hover:shadow-lg transition-colors cursor-pointer" :class="selectedHotel.status === 'Suspendido' ? 'bg-teal text-white' : 'bg-red text-white'">
            {{ selectedHotel.status === 'Suspendido' ? 'Reactivar' : 'Suspender' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { SuperAdminService } from '@/services/SuperAdmin.service'

const activeFilter = ref('all')
const planFilter = ref('all')
const locationFilter = ref('all')
const occupancyFilter = ref('all')
const mrrFilter = ref('all')
const searchQuery = ref('')
const sortBy = ref('name-asc')
const viewMode = ref<'table' | 'grid'>('table')
const showViewModal = ref(false)
const showEditModal = ref(false)
const showSuspendModal = ref(false)
const selectedHotel = ref<any>({})
const editingHotel = ref<any>({})
const suspendReason = ref('')

const PLAN_MRR: Record<string, number> = { enterprise: 199, professional: 99, starter: 49, essential: 49, ultra: 0 }

const stats = computed(() => {
  const list = hotels.value
  const mrr = list.reduce((s, h) => s + (PLAN_MRR[String(h.plan).toLowerCase()] ?? 0), 0)
  return [
    { label: 'Total Hoteles', value: list.length, color: 'text-navy' },
    { label: 'Activos', value: list.filter((h: any) => h.status === 'Activo').length, color: 'text-teal' },
    { label: 'Pendientes', value: list.filter((h: any) => h.status === 'Pendiente').length, color: 'text-orange' },
    { label: 'Suspendidos', value: list.filter((h: any) => h.status === 'Suspendido').length, color: 'text-red' },
    { label: 'MRR Total', value: `$${mrr.toLocaleString()}`, color: 'text-navy' },
  ]
})

const hotels = ref<any[]>([])

onMounted(async () => {
  try {
    const { hotels: data } = await SuperAdminService.hotels()
    hotels.value = data.map((h: any) => ({
      id: h.id,
      name: h.name,
      location: h.address ?? h.location ?? '',
      email: h.email ?? '',
      phone: h.phone ?? '',
      plan: h.plan ? (h.plan.charAt(0).toUpperCase() + h.plan.slice(1)) : 'Starter',
      rooms: h.roomCount ?? 0,
      occupancy: 0,
      mrr: PLAN_MRR[String(h.plan).toLowerCase()] ?? 0,
      users: 0,
      status: h.status === 'pendiente' ? 'Pendiente' : h.status === 'suspendido' ? 'Suspendido' : 'Activo',
      registered: h.createdAt ? String(h.createdAt).slice(0, 10) : '',
    }))
  } catch { /* silent */ }
})

const locations = computed(() => [...new Set(hotels.value.map(h => h.location))].sort())

const activeFiltersCount = computed(() => {
  let count = 0
  if (activeFilter.value !== 'all') count++
  if (planFilter.value !== 'all') count++
  if (locationFilter.value !== 'all') count++
  if (occupancyFilter.value !== 'all') count++
  if (mrrFilter.value !== 'all') count++
  if (searchQuery.value) count++
  return count
})

const filteredHotels = computed(() => {
  let result = [...hotels.value]

  if (activeFilter.value !== 'all') result = result.filter(h => h.status === activeFilter.value)
  if (planFilter.value !== 'all') result = result.filter(h => h.plan === planFilter.value)
  if (locationFilter.value !== 'all') result = result.filter(h => h.location === locationFilter.value)
  if (occupancyFilter.value !== 'all') {
    if (occupancyFilter.value === 'high') result = result.filter(h => h.occupancy > 80)
    else if (occupancyFilter.value === 'medium') result = result.filter(h => h.occupancy >= 50 && h.occupancy <= 80)
    else result = result.filter(h => h.occupancy < 50)
  }
  if (mrrFilter.value !== 'all') {
    if (mrrFilter.value === 'high') result = result.filter(h => h.mrr >= 100)
    else if (mrrFilter.value === 'medium') result = result.filter(h => h.mrr >= 50 && h.mrr < 100)
    else result = result.filter(h => h.mrr < 50)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(h => h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || h.email.toLowerCase().includes(q) || h.phone.includes(q))
  }

  const [field, dir] = sortBy.value.split('-')
  result.sort((a: any, b: any) => {
    const aVal = a[field]
    const bVal = b[field]
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal
    return dir === 'desc' ? -cmp : cmp
  })

  return result
})

const planClass = (plan: string) => ({ 'Enterprise': 'bg-navy/10 text-navy', 'Professional': 'bg-cyan/10 text-cyan', 'Starter': 'bg-teal/10 text-teal' }[plan] || 'bg-surface text-text-muted')
const statusClass = (status: string) => ({ 'Activo': 'bg-teal/10 text-teal', 'Pendiente': 'bg-orange/10 text-orange', 'Suspendido': 'bg-red/10 text-red' }[status] || 'bg-surface text-text-muted')

const toggleSort = (field: string) => {
  if (sortBy.value.startsWith(field)) {
    sortBy.value = sortBy.value.endsWith('asc') ? `${field}-desc` : `${field}-asc`
  } else {
    sortBy.value = `${field}-asc`
  }
}

const clearAllFilters = () => {
  activeFilter.value = 'all'
  planFilter.value = 'all'
  locationFilter.value = 'all'
  occupancyFilter.value = 'all'
  mrrFilter.value = 'all'
  searchQuery.value = ''
}

const exportHotels = () => {
  const headers = ['Nombre', 'Ubicación', 'Plan', 'Habitaciones', 'Ocupación', 'MRR', 'Estado']
  const rows = filteredHotels.value.map(h => [h.name, h.location, h.plan, h.rooms, `${h.occupancy}%`, `$${h.mrr}`, h.status])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hoteles-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const openViewHotel = (hotel: any) => { selectedHotel.value = { ...hotel }; showViewModal.value = true }
const openEditHotel = (hotel: any) => { editingHotel.value = { ...hotel }; showEditModal.value = true }
const openNewHotel = () => { editingHotel.value = { id: null, name: '', email: '', phone: '', location: '', plan: 'Professional', rooms: 0, occupancy: 0, mrr: 0, users: 1, status: 'Pendiente', registered: new Date().toLocaleDateString('es-ES') }; showEditModal.value = true }
const openSuspendModal = (hotel: any) => { selectedHotel.value = { ...hotel }; suspendReason.value = ''; showSuspendModal.value = true }

const saveHotel = () => {
  if (!editingHotel.value.name || !editingHotel.value.email || !editingHotel.value.location) return
  editingHotel.value.mrr = editingHotel.value.plan === 'Starter' ? 49 : editingHotel.value.plan === 'Professional' ? 99 : 199
  if (editingHotel.value.id) {
    const idx = hotels.value.findIndex(h => h.id === editingHotel.value.id)
    if (idx !== -1) hotels.value[idx] = { ...editingHotel.value }
  } else {
    editingHotel.value.id = Date.now()
    hotels.value.unshift({ ...editingHotel.value })
  }
  showEditModal.value = false
}

const toggleSuspend = () => {
  selectedHotel.value.status = selectedHotel.value.status === 'Suspendido' ? 'Activo' : 'Suspendido'
  const idx = hotels.value.findIndex(h => h.id === selectedHotel.value.id)
  if (idx !== -1) hotels.value[idx].status = selectedHotel.value.status
  showSuspendModal.value = false
}
</script>
