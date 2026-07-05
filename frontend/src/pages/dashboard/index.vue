<template>
  <div class="page-dashboard">
    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
      <div v-for="kpi in kpis" :key="kpi.label" class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <span class="text-2xl">{{ kpi.icon }}</span>
          <span
            class="badge"
            :class="kpi.trend === 'up' ? 'badge-success' : kpi.trend === 'down' ? 'badge-danger' : 'badge-info'"
          >
            {{ kpi.trend === 'up' ? '↑' : kpi.trend === 'down' ? '↓' : '→' }} {{ kpi.change }}
          </span>
        </div>
        <div class="text-2xl font-black text-navy mb-1">{{ kpi.value }}</div>
        <div class="text-[11px] font-semibold text-text-muted uppercase tracking-wide">{{ kpi.label }}</div>
      </div>
    </div>

    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Rack Visual -->
      <div class="lg:col-span-2 card">
        <div class="p-5 border-b border-border">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-extrabold text-navy text-base">Rack de Habitaciones</h2>
              <p class="text-[11px] text-text-muted mt-0.5">Estado en tiempo real</p>
            </div>
            <div class="flex gap-1.5">
              <button
                v-for="filter in statusFilters"
                :key="filter.value"
                @click="activeFilter = filter.value"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                :class="activeFilter === filter.value ? 'bg-navy text-white' : 'bg-surface text-text-secondary hover:bg-surface-dark'"
              >
                {{ filter.label }}
              </button>
            </div>
          </div>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-5 md:grid-cols-10 gap-2">
            <div
              v-for="room in filteredRooms"
              :key="room.id"
              @click="openRoomModal(room)"
              class="room-cell aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border-2"
              :class="roomStatusClass(room.status)"
            >
              <span class="text-xs font-black">{{ room.number }}</span>
              <span class="text-[8px] mt-0.5 opacity-70">{{ roomStatusIcon(room.status) }}</span>
            </div>
          </div>
          <!-- Legend -->
          <div class="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
            <div v-for="legend in legends" :key="legend.status" class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded" :class="legend.color"></div>
              <span class="text-[10px] text-text-muted font-medium">{{ legend.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-5">
        <!-- Llegadas Hoy -->
        <div class="card">
          <div class="p-4 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-navy text-sm">Llegadas Hoy</h3>
              <span class="badge badge-info">{{ arrivals.length }}</span>
            </div>
          </div>
          <div class="p-3">
            <div v-for="arrival in arrivals" :key="arrival.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors">
              <div class="w-9 h-9 rounded-full bg-cyan/10 flex items-center justify-center text-sm font-bold text-cyan flex-shrink-0">
                {{ arrival.guestInitials }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold truncate">{{ arrival.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ arrival.roomNumber }} · {{ arrival.time }}</div>
              </div>
              <button class="text-[10px] font-bold text-cyan hover:underline flex-shrink-0 cursor-pointer">Check-in</button>
            </div>
          </div>
        </div>

        <!-- Salidas Hoy -->
        <div class="card">
          <div class="p-4 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-navy text-sm">Salidas Hoy</h3>
              <span class="badge badge-warning">{{ departures.length }}</span>
            </div>
          </div>
          <div class="p-3">
            <div v-for="departure in departures" :key="departure.id" class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors">
              <div class="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-sm font-bold text-gold flex-shrink-0">
                {{ departure.guestInitials }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold truncate">{{ departure.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ departure.roomNumber }} · {{ departure.time }}</div>
              </div>
              <button class="text-[10px] font-bold text-gold hover:underline flex-shrink-0 cursor-pointer">Check-out</button>
            </div>
          </div>
        </div>

        <!-- Incidencias -->
        <div class="card">
          <div class="p-4 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-navy text-sm">Incidencias</h3>
              <span class="badge" :class="incidents.length > 0 ? 'badge-danger' : 'badge-success'">
                {{ incidents.length }}
              </span>
            </div>
          </div>
          <div class="p-3">
            <div v-for="incident in incidents" :key="incident.id" class="flex items-start gap-3 p-2 rounded-lg hover:bg-surface transition-colors">
              <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" :class="incident.priority === 'high' ? 'bg-coral' : 'bg-gold'"></div>
              <div class="flex-1">
                <div class="text-sm font-bold">{{ incident.title }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ incident.room }} · {{ incident.time }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Room Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedRoom" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeRoomModal">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeRoomModal"></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <!-- Header -->
          <div class="p-5 border-b border-border" :class="modalHeaderClass">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black" :class="modalIconClass">
                  {{ selectedRoom.number }}
                </div>
                <div>
                  <h3 class="text-lg font-black text-navy">Habitación {{ selectedRoom.number }}</h3>
                  <p class="text-sm text-text-secondary capitalize">{{ selectedRoom.type }} · Piso {{ selectedRoom.floor }}</p>
                </div>
              </div>
              <button @click="closeRoomModal" class="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                ✕
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">
            <!-- Status -->
            <div class="flex items-center justify-between p-3 bg-surface rounded-xl">
              <span class="text-sm font-bold text-text-secondary">Estado</span>
              <span class="badge" :class="modalStatusBadge">{{ modalStatusLabel }}</span>
            </div>

            <!-- Guest Info (if occupied) -->
            <div v-if="selectedRoom.status === 'occupied' && roomGuest" class="bg-surface rounded-xl p-4">
              <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-3">Huésped Actual</div>
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-full bg-navy/10 flex items-center justify-center text-sm font-bold text-navy">
                  {{ roomGuest.initials }}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-bold text-navy">{{ roomGuest.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ roomGuest.email }}</div>
                  <div class="text-[10px] text-text-muted">{{ roomGuest.checkIn }} → {{ roomGuest.checkOut }}</div>
                </div>
              </div>
            </div>

            <!-- Pending Guest (if pending) -->
            <div v-if="selectedRoom.status === 'pending' && pendingGuest" class="bg-gold/10 rounded-xl p-4">
              <div class="text-[10px] font-bold text-gold uppercase tracking-wide mb-3">Próximo Huésped</div>
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-full bg-gold/20 flex items-center justify-center text-sm font-bold text-gold">
                  {{ pendingGuest.initials }}
                </div>
                <div class="flex-1">
                  <div class="text-sm font-bold text-navy">{{ pendingGuest.name }}</div>
                  <div class="text-[10px] text-text-muted">Llega: {{ pendingGuest.arrivalTime }}</div>
                </div>
              </div>
            </div>

            <!-- Room Details -->
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-surface rounded-xl p-3 text-center">
                <div class="text-lg font-black text-navy">${{ selectedRoom.basePrice }}</div>
                <div class="text-[10px] text-text-muted">Tarifa/Noche</div>
              </div>
              <div class="bg-surface rounded-xl p-3 text-center">
                <div class="text-lg font-black text-navy">{{ selectedRoom.maxGuests }}</div>
                <div class="text-[10px] text-text-muted">Max. Ocupantes</div>
              </div>
            </div>

            <!-- Amenities -->
            <div>
              <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-2">Amenidades</div>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-secondary">WiFi</span>
                <span class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-secondary">TV</span>
                <span class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-secondary">A/C</span>
                <span class="px-2 py-1 bg-surface rounded-lg text-[10px] font-bold text-text-secondary">Minibar</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-5 border-t border-border bg-surface/50">
            <div class="flex gap-2">
              <button
                v-if="selectedRoom.status === 'available'"
                @click="checkIn"
                class="flex-1 btn-accent cursor-pointer"
              >
                Check-in
              </button>
              <button
                v-if="selectedRoom.status === 'occupied'"
                @click="checkOut"
                class="flex-1 bg-coral text-white font-bold text-sm py-2.5 px-4 rounded-xl hover:bg-coral-light transition-colors cursor-pointer"
              >
                Check-out
              </button>
              <button
                v-if="selectedRoom.status === 'cleaning'"
                @click="markClean"
                class="flex-1 bg-teal text-white font-bold text-sm py-2.5 px-4 rounded-xl hover:bg-teal-light transition-colors cursor-pointer"
              >
                Marcar Limpia
              </button>
              <button
                v-if="selectedRoom.status !== 'out_of_service'"
                @click="markOutOfService"
                class="px-4 py-2.5 bg-surface border border-border rounded-xl text-text-secondary text-sm font-bold hover:border-navy/30 transition-colors cursor-pointer"
              >
                F/S
              </button>
              <button
                @click="closeRoomModal"
                class="px-4 py-2.5 bg-surface border border-border rounded-xl text-text-secondary text-sm font-bold hover:border-navy/30 transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Room, RoomStatus } from '@/types'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useRoomStore } from '@/stores/room.store'
import { useReservationStore } from '@/stores/reservation.store'
import { useAuthStore } from '@/stores/auth.store'

const dashboard = useDashboardStore()
const roomStore = useRoomStore()
const reservationStore = useReservationStore()
const auth = useAuthStore()

const activeFilter = ref<string>('all')
const selectedRoom = ref<Room | null>(null)

function initials(name?: string): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const kpis = computed<{ icon: string; label: string; value: string; trend: 'up' | 'down' | 'stable'; change: string }[]>(() => {
  const s = dashboard.stats as any
  const t = s.trends || { ocupacion: { direction: 'stable', value: 0 }, revenue: { direction: 'stable', value: 0 } }
  return [
    { icon: '🏨', label: 'Ocupación', value: `${s.occupancy}%`, trend: t.ocupacion?.direction || 'stable', change: '' },
    { icon: '📅', label: 'Llegadas Hoy', value: String(s.arrivalsToday), trend: 'stable', change: '' },
    { icon: '🚪', label: 'Salidas Hoy', value: String(s.departuresToday), trend: 'stable', change: '' },
    { icon: '💰', label: 'Ingresos Hoy', value: `$${(s.revenueToday || 0).toLocaleString()}`, trend: t.revenue?.direction || 'stable', change: '' },
  ]
})

const rooms = computed<Room[]>(() => roomStore.rooms)

const roomGuests = computed(() => {
  const map: Record<string, { name: string; initials: string; email: string; checkIn: string; checkOut: string }> = {}
  for (const r of reservationStore.reservations) {
    if (r.status === 'checked_in' && r.roomId) {
      map[r.roomId] = {
        name: r.guestName ?? 'Huésped',
        initials: initials(r.guestName),
        email: r.guestEmail ?? '',
        checkIn: String(r.checkIn ?? '').slice(0, 10),
        checkOut: String(r.checkOut ?? '').slice(0, 10),
      }
    }
  }
  return map
})

const pendingGuests = computed(() => {
  const map: Record<string, { name: string; initials: string; arrivalTime: string }> = {}
  for (const r of reservationStore.reservations) {
    if (r.status === 'confirmed' && r.roomId) {
      map[r.roomId] = { name: r.guestName ?? 'Huésped', initials: initials(r.guestName), arrivalTime: '15:00' }
    }
  }
  return map
})

const today = new Date().toISOString().slice(0, 10)

const arrivals = computed(() =>
  reservationStore.reservations
    .filter(r => String(r.checkIn).slice(0, 10) === today && r.status !== 'cancelled')
    .slice(0, 6)
    .map(r => ({ id: r.id, guestName: r.guestName ?? 'Huésped', roomNumber: r.roomNumber ?? '—', time: '15:00', guestInitials: initials(r.guestName) })),
)

const departures = computed(() =>
  reservationStore.reservations
    .filter(r => String(r.checkOut).slice(0, 10) === today && r.status === 'checked_in')
    .slice(0, 6)
    .map(r => ({ id: r.id, guestName: r.guestName ?? 'Huésped', roomNumber: r.roomNumber ?? '—', time: '11:00', guestInitials: initials(r.guestName) })),
)

const incidents = ref<{ id: string; title: string; room: string; time: string; priority: 'high' | 'medium' }[]>([])

onMounted(async () => {
  await Promise.all([
    dashboard.fetchStats(hotelId.value),
    roomStore.fetchRooms({ hotelId: hotelId.value }),
    reservationStore.fetchReservations({ hotelId: hotelId.value }),
  ])
})

// PC-2.1.4 — recargar data al switchear hotel (el token refresca auth.user.hotelId).
watch(hotelId, async (id) => {
  if (!id) return
  await Promise.all([
    dashboard.fetchStats(id),
    roomStore.fetchRooms({ hotelId: id }),
    reservationStore.fetchReservations({ hotelId: id }),
  ])
})

const statusFilters = [
  { value: 'all', label: 'Todas' },
  { value: 'available', label: 'Libres' },
  { value: 'occupied', label: 'Ocupadas' },
  { value: 'cleaning', label: 'Limpieza' },
]

const legends = [
  { status: 'available', label: 'Disponible', color: 'bg-teal' },
  { status: 'occupied', label: 'Ocupada', color: 'bg-coral' },
  { status: 'pending', label: 'Pendiente', color: 'bg-gold' },
  { status: 'cleaning', label: 'En limpieza', color: 'bg-cyan' },
  { status: 'out_of_service', label: 'F/S', color: 'bg-gray-400' },
]

const filteredRooms = computed(() => {
  if (activeFilter.value === 'all') return rooms.value
  return rooms.value.filter(r => r.status === activeFilter.value)
})

const roomGuest = computed(() => {
  if (!selectedRoom.value) return null
  return roomGuests.value[selectedRoom.value.id] ?? null
})

const pendingGuest = computed(() => {
  if (!selectedRoom.value) return null
  return pendingGuests.value[selectedRoom.value.id] ?? null
})

const modalHeaderClass = computed(() => {
  const classes: Record<RoomStatus, string> = {
    available: 'bg-teal/5',
    occupied: 'bg-coral/5',
    pending: 'bg-gold/5',
    cleaning: 'bg-cyan/5',
    dirty: 'bg-coral/5',
    out_of_service: 'bg-gray-50',
  }
  return selectedRoom.value ? classes[selectedRoom.value.status] : ''
})

const modalIconClass = computed(() => {
  const classes: Record<RoomStatus, string> = {
    available: 'bg-teal/10 text-teal',
    occupied: 'bg-coral/10 text-coral',
    pending: 'bg-gold/10 text-gold',
    cleaning: 'bg-cyan/10 text-cyan',
    dirty: 'bg-coral/10 text-coral',
    out_of_service: 'bg-gray-100 text-gray-400',
  }
  return selectedRoom.value ? classes[selectedRoom.value.status] : ''
})

const modalStatusBadge = computed(() => {
  const classes: Record<RoomStatus, string> = {
    available: 'badge-success',
    occupied: 'badge-danger',
    pending: 'badge-warning',
    cleaning: 'badge-info',
    dirty: 'badge-danger',
    out_of_service: 'bg-gray-100 text-gray-500',
  }
  return selectedRoom.value ? classes[selectedRoom.value.status] : ''
})

const modalStatusLabel = computed(() => {
  const labels: Record<RoomStatus, string> = {
    available: 'Disponible',
    occupied: 'Ocupada',
    pending: 'Pendiente',
    cleaning: 'En limpieza',
    dirty: 'Sucia',
    out_of_service: 'Fuera de servicio',
  }
  return selectedRoom.value ? labels[selectedRoom.value.status] : ''
})

function roomStatusClass(status: RoomStatus) {
  const classes: Record<RoomStatus, string> = {
    available: 'bg-teal/10 border-teal/30 text-teal hover:bg-teal/20',
    occupied: 'bg-coral/10 border-coral/30 text-coral hover:bg-coral/20',
    pending: 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20',
    cleaning: 'bg-cyan/10 border-cyan/30 text-cyan hover:bg-cyan/20',
    dirty: 'bg-coral/10 border-coral/30 text-coral hover:bg-coral/20',
    out_of_service: 'bg-gray-100 border-gray-300 text-gray-400',
  }
  return classes[status]
}

function roomStatusIcon(status: RoomStatus) {
  const icons: Record<RoomStatus, string> = {
    available: '✓',
    occupied: '●',
    pending: '⏳',
    cleaning: '🧹',
    dirty: '🧽',
    out_of_service: '✕',
  }
  return icons[status]
}

function openRoomModal(room: Room) {
  selectedRoom.value = room
}

function closeRoomModal() {
  selectedRoom.value = null
}

async function checkIn() {
  if (!selectedRoom.value) return
  const id = selectedRoom.value.id
  closeRoomModal()
  try {
    await roomStore.updateRoomStatus(id, 'occupied')
  } catch { await roomStore.fetchRooms({ hotelId: hotelId.value }) }
}

async function checkOut() {
  if (!selectedRoom.value) return
  const id = selectedRoom.value.id
  closeRoomModal()
  try {
    await roomStore.updateRoomStatus(id, 'cleaning')
  } catch { await roomStore.fetchRooms({ hotelId: hotelId.value }) }
}

async function markClean() {
  if (!selectedRoom.value) return
  const id = selectedRoom.value.id
  closeRoomModal()
  try {
    await roomStore.updateRoomStatus(id, 'available')
  } catch { await roomStore.fetchRooms({ hotelId: hotelId.value }) }
}

async function markOutOfService() {
  if (!selectedRoom.value) return
  const id = selectedRoom.value.id
  closeRoomModal()
  try {
    await roomStore.updateRoomStatus(id, 'out_of_service')
  } catch { await roomStore.fetchRooms({ hotelId: hotelId.value }) }
}
</script>

<style scoped>
.room-cell {
  transition: all 0.15s ease;
}
.room-cell:hover {
  transform: scale(1.05);
}
</style>
