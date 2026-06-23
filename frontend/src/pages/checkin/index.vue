<template>
  <div class="min-h-screen bg-surface">
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-full mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-black text-navy">Recepción Digital</h1>
          <p class="text-xs text-text-muted">{{ todayFormatted }} · {{ arrivalsToday }} llegadas · {{ departuresToday }} salidas</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-teal/10 text-teal">{{ inHouse }} en casa</span>
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold">{{ arrivalsToday }} por llegar</span>
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-coral/10 text-coral">{{ departuresToday }} por salir</span>
        </div>
      </div>
    </div>

    <div class="px-6 py-4">
      <!-- Room Grid -->
      <div class="bg-white rounded-2xl border border-border p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-black text-navy">Habitaciones · {{ todayFormatted }}</h2>
          <div class="flex gap-3 text-[10px] font-bold">
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-teal"></span> Disponible ({{ rooms.filter(r => r.status === 'available').length }})</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-coral"></span> Ocupada ({{ rooms.filter(r => r.status === 'occupied').length }})</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-cyan"></span> Limpieza ({{ rooms.filter(r => r.status === 'cleaning').length }})</span>
            <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-gray-400"></span> F/S ({{ rooms.filter(r => r.status === 'out_of_service').length }})</span>
          </div>
        </div>
        <div class="grid grid-cols-6 md:grid-cols-9 lg:grid-cols-12 gap-2">
          <div v-for="room in rooms" :key="room.id"
            @click="selectRoom(room)"
            class="p-3 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md"
            :class="roomCardClass(room)">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-black" :class="roomNumberClass(room)">{{ room.number }}</span>
              <span class="w-2 h-2 rounded-full" :class="roomDotClass(room)"></span>
            </div>
            <div class="text-[9px] font-bold text-text-muted uppercase">{{ room.type }}</div>
            <div v-if="room.guestName" class="text-[10px] font-bold text-navy mt-1 truncate">{{ room.guestName }}</div>
            <div v-else class="text-[9px] text-text-muted mt-1">{{ roomStatusLabel(room) }}</div>
            <div v-if="room.guestName" class="text-[9px] text-text-muted">{{ room.checkDates }}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Arrivals Today -->
        <div class="bg-white rounded-2xl border border-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-black text-navy">Llegadas Hoy</h2>
            <span class="text-xs font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">{{ arrivals.length }}</span>
          </div>
          <div v-if="arrivals.length === 0" class="text-center py-8 text-xs text-text-muted">Sin llegadas hoy</div>
          <div v-for="a in arrivals" :key="a.id" class="flex items-center gap-3 p-3 rounded-xl mb-2" :class="a.checkedIn ? 'bg-teal/5' : 'bg-surface hover:bg-gold/5 cursor-pointer'" @click="!a.checkedIn && openCheckinModal(a)">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" :class="a.channelColor">{{ a.initials }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ a.guestName }}</div>
              <div class="text-[10px] text-text-muted">Hab {{ a.roomNumber }} · {{ a.channelLabel }}</div>
              <div class="text-[10px] text-text-muted">{{ a.checkIn }} → {{ a.checkOut }} · {{ a.nights }}n · ${{ a.totalAmount }}</div>
            </div>
            <button v-if="!a.checkedIn" @click.stop="openCheckinModal(a)" class="px-3 py-1.5 bg-teal text-white text-[10px] font-bold rounded-lg hover:bg-teal/80 transition-colors cursor-pointer">
              Check-in
            </button>
            <span v-else class="text-[10px] font-bold text-teal">✓ Hecho</span>
          </div>
        </div>

        <!-- In House -->
        <div class="bg-white rounded-2xl border border-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-black text-navy">En Casa</h2>
            <span class="text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full">{{ inHouseList.length }}</span>
          </div>
          <div v-if="inHouseList.length === 0" class="text-center py-8 text-xs text-text-muted">Sin huéspedes</div>
          <div v-for="g in inHouseList" :key="g.id" class="flex items-center gap-3 p-3 rounded-xl mb-2 bg-surface cursor-pointer hover:bg-coral/5" @click="openCheckoutModal(g)">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold" :class="g.channelColor">{{ g.initials }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ g.guestName }}</div>
              <div class="text-[10px] text-text-muted">Hab {{ g.roomNumber }} · {{ g.channelLabel }}</div>
              <div class="text-[10px] text-text-muted">Sale: {{ g.checkOut }} · {{ daysUntil(g.checkOut) }}d restantes</div>
            </div>
            <button @click.stop="openCheckoutModal(g)" class="px-3 py-1.5 bg-navy text-white text-[10px] font-bold rounded-lg hover:bg-navy-light transition-colors cursor-pointer">
              Check-out
            </button>
          </div>
        </div>

        <!-- Departures Today -->
        <div class="bg-white rounded-2xl border border-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-black text-navy">Salidas Hoy</h2>
            <span class="text-xs font-bold text-coral bg-coral/10 px-2 py-0.5 rounded-full">{{ departures.length }}</span>
          </div>
          <div v-if="departures.length === 0" class="text-center py-8 text-xs text-text-muted">Sin salidas hoy</div>
          <div v-for="d in departures" :key="d.id" class="flex items-center gap-3 p-3 rounded-xl mb-2" :class="d.checkedOut ? 'bg-gray-100' : 'bg-surface hover:bg-coral/5 cursor-pointer'" @click="!d.checkedOut && openCheckoutModal(d)">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold bg-gray-200 text-gray-500">{{ d.initials }}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-bold text-navy truncate">{{ d.guestName }}</div>
              <div class="text-[10px] text-text-muted">Hab {{ d.roomNumber }} · {{ d.channelLabel }}</div>
            </div>
            <button v-if="!d.checkedOut" @click.stop="openCheckoutModal(d)" class="px-3 py-1.5 bg-coral text-white text-[10px] font-bold rounded-lg hover:bg-coral/80 transition-colors cursor-pointer">
              Check-out
            </button>
            <span v-else class="text-[10px] font-bold text-text-muted">✓ Hecho</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Checkin Modal -->
    <Teleport to="body">
      <div v-if="showCheckinModal && checkinGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCheckinModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border bg-teal/5">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Check-in</h3>
              <button @click="closeCheckinModal" class="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center hover:bg-surface cursor-pointer">✕</button>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" :class="checkinGuest.channelColor">{{ checkinGuest.initials }}</div>
              <div>
                <div class="text-sm font-bold text-navy">{{ checkinGuest.guestName }}</div>
                <div class="text-[10px] text-text-muted">{{ checkinGuest.guestEmail }}</div>
              </div>
            </div>
            <div class="bg-surface rounded-xl p-4 space-y-2">
              <div class="flex justify-between text-xs"><span class="text-text-muted">Habitación</span><span class="font-bold text-navy">{{ checkinGuest.roomNumber }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Check-in</span><span class="font-bold text-navy">{{ checkinGuest.checkIn }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Check-out</span><span class="font-bold text-navy">{{ checkinGuest.checkOut }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Canal</span><span class="font-bold text-navy">{{ checkinGuest.channelLabel }}</span></div>
              <div class="flex justify-between text-xs"><span class="text-text-muted">Total</span><span class="font-bold text-teal">${{ checkinGuest.totalAmount }}</span></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="text-center p-2 bg-surface rounded-lg">
                <div class="text-[10px] text-text-muted">Adultos</div>
                <div class="text-sm font-bold">{{ checkinGuest.adults }}</div>
              </div>
              <div class="text-center p-2 bg-surface rounded-lg">
                <div class="text-[10px] text-text-muted">Niños</div>
                <div class="text-sm font-bold">{{ checkinGuest.children }}</div>
              </div>
            </div>
          </div>
          <div class="p-5 border-t border-border flex gap-2">
            <button @click="closeCheckinModal" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold hover:bg-surface cursor-pointer">Cancelar</button>
            <button @click="confirmCheckin" class="flex-1 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal/80 cursor-pointer">Confirmar Check-in</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Checkout Modal -->
    <Teleport to="body">
      <div v-if="showCheckoutModal && checkoutGuest" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCheckoutModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border bg-coral/5">
            <h3 class="text-lg font-black text-navy">Check-out</h3>
          </div>
          <div class="p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" :class="checkoutGuest.channelColor">{{ checkoutGuest.initials }}</div>
              <div>
                <div class="text-sm font-bold text-navy">{{ checkoutGuest.guestName }}</div>
                <div class="text-[10px] text-text-muted">Hab {{ checkoutGuest.roomNumber }}</div>
              </div>
            </div>
            <div class="bg-surface rounded-xl p-4">
              <div class="flex justify-between text-xs"><span class="text-text-muted">Estancia</span><span class="font-bold">{{ checkoutGuest.checkIn }} → {{ checkoutGuest.checkOut }}</span></div>
              <div class="flex justify-between text-xs mt-1"><span class="text-text-muted">Total</span><span class="font-bold text-teal">${{ checkoutGuest.totalAmount }}</span></div>
            </div>
            <div class="bg-gold/10 border border-gold/20 rounded-xl p-3">
              <div class="text-[10px] font-bold text-gold mb-2">⚠ La habitación pasará a estado "Sucia" y se creará tarea de limpieza</div>
            </div>
          </div>
          <div class="p-5 border-t border-border flex gap-2">
            <button @click="closeCheckoutModal" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold hover:bg-surface cursor-pointer">Cancelar</button>
            <button @click="confirmCheckout" class="flex-1 py-2.5 bg-coral text-white rounded-xl text-sm font-bold hover:bg-coral/80 cursor-pointer">Confirmar Check-out</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { RoomService } from '@/services/Room.service'
import { ReservationService } from '@/services/Reservation.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const showCheckinModal = ref(false)
const showCheckoutModal = ref(false)
const checkinGuest = ref<any>(null)
const checkoutGuest = ref<any>(null)
const checkedIn = ref(new Set<string>())
const checkedOut = ref(new Set<string>())

const rooms = ref<any[]>([])
const allReservations = ref<any[]>([])
const loading = ref(true)

const today = new Date()
const todayStr = today.toISOString().split('T')[0]
const todayFormatted = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

const channelLabels: Record<string, string> = { direct: 'Direct', booking: 'Booking.com', expedia: 'Expedia', airbnb: 'Airbnb', google: 'Google' }
const channelColors: Record<string, string> = { direct: 'bg-teal/10 text-teal', booking: 'bg-cyan/10 text-cyan', expedia: 'bg-gold/10 text-gold', airbnb: 'bg-coral/10 text-coral', google: 'bg-blue/10 text-blue' }

async function loadData() {
  loading.value = true
  try {
    const [roomsResult, planningResult] = await Promise.all([
      RoomService.list({ hotelId: hotelId.value }),
      OperationsService.planning(hotelId.value),
    ])

    const roomsData = roomsResult.rooms || []
    const resData = planningResult.reservas || []
    allReservations.value = resData

    const todayRes = resData.filter((r: any) => {
      const ci = String(r.checkIn || '').slice(0, 10)
      const co = String(r.checkOut || '').slice(0, 10)
      return ci <= todayStr && co >= todayStr
    })

    const roomGuestMap = new Map<string, any>()
    for (const r of todayRes) {
      const rid = r.roomId
      if (!roomGuestMap.has(rid) || String(r.checkIn).slice(0, 10) <= todayStr) {
        roomGuestMap.set(rid, r)
      }
    }

    rooms.value = roomsData.map((r: any) => {
      const res = roomGuestMap.get(r.id)
      return {
        id: r.id,
        number: r.number,
        type: r.type,
        status: res ? 'occupied' : (r.status || 'available'),
        basePrice: r.basePrice,
        guestName: res?.guestName || null,
        channel: res?.channel || null,
        checkIn: res ? String(res.checkIn).slice(0, 10) : null,
        checkOut: res ? String(res.checkOut).slice(0, 10) : null,
        checkDates: res ? `${String(res.checkIn).slice(0, 10)} → ${String(res.checkOut).slice(0, 10)}` : '',
        guestEmail: res?.guestEmail || null,
        resId: res?.id || null,
      }
    })
  } catch (e) {
    console.error('Error loading checkin data', e)
  }
  loading.value = false
}

onMounted(loadData)

const arrivals = computed(() =>
  allReservations.value
    .filter((r: any) => String(r.checkIn).slice(0, 10) === todayStr)
    .map(mapGuest)
)

const inHouseList = computed(() =>
  allReservations.value
    .filter((r: any) => {
      const ci = String(r.checkIn).slice(0, 10)
      const co = String(r.checkOut).slice(0, 10)
      return ci < todayStr && co >= todayStr
    })
    .map(mapGuest)
)

const departures = computed(() =>
  allReservations.value
    .filter((r: any) => String(r.checkOut).slice(0, 10) === todayStr)
    .map(mapGuest)
)

function mapGuest(r: any) {
  const ch = (r.channel || 'direct').toLowerCase()
  const nights = Math.ceil((new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 86400000)
  return {
    id: r.id,
    guestName: r.guestName || 'Guest',
    guestEmail: r.guestEmail || '',
    initials: (r.guestName || 'G').split(' ').map((p: string) => p[0]).slice(0, 2).join(''),
    roomNumber: r.roomNumber || '—',
    roomId: r.roomId,
    checkIn: String(r.checkIn).slice(0, 10),
    checkOut: String(r.checkOut).slice(0, 10),
    nights,
    status: r.status,
    channel: ch,
    channelLabel: channelLabels[ch] || ch,
    channelColor: channelColors[ch] || 'bg-surface text-navy',
    totalAmount: r.totalAmount || 0,
    adults: r.adults || 2,
    children: r.children || 0,
    checkedIn: checkedIn.value.has(r.id),
    checkedOut: checkedOut.value.has(r.id),
  }
}

const arrivalsToday = computed(() => arrivals.value.length)
const departuresToday = computed(() => departures.value.length)
const inHouse = computed(() => inHouseList.value.length)

function daysUntil(dateStr: string) {
  const d = Math.ceil((new Date(dateStr + 'T12:00:00').getTime() - today.getTime()) / 86400000)
  return d > 0 ? d : 0
}

function roomCardClass(room: any) {
  const map: Record<string, string> = {
    available: 'border-teal/20 bg-white hover:border-teal',
    occupied: 'border-coral/20 bg-coral/5 hover:border-coral',
    cleaning: 'border-cyan/20 bg-cyan/5',
    dirty: 'border-gold/20 bg-gold/5',
    out_of_service: 'border-gray-300 bg-gray-50',
  }
  return map[room.status] || ''
}

function roomNumberClass(room: any) {
  const map: Record<string, string> = { available: 'text-teal', occupied: 'text-coral', cleaning: 'text-cyan', dirty: 'text-gold', out_of_service: 'text-gray-400' }
  return map[room.status] || 'text-navy'
}

function roomDotClass(room: any) {
  const map: Record<string, string> = { available: 'bg-teal', occupied: 'bg-coral', cleaning: 'bg-cyan', dirty: 'bg-gold', out_of_service: 'bg-gray-400' }
  return map[room.status] || 'bg-gray-300'
}

function roomStatusLabel(room: any) {
  const map: Record<string, string> = { available: 'Libre', occupied: 'Ocupada', cleaning: 'Limpieza', dirty: 'Sucia', out_of_service: 'F/S' }
  return map[room.status] || room.status
}

function selectRoom(room: any) {
  if (room.resId && room.guestName) {
    const res = allReservations.value.find((r: any) => r.id === room.resId)
    if (res) openCheckinModal(mapGuest(res))
  }
}

function openCheckinModal(guest: any) {
  checkinGuest.value = guest
  showCheckinModal.value = true
}

function closeCheckinModal() {
  showCheckinModal.value = false
  checkinGuest.value = null
}

function openCheckoutModal(guest: any) {
  checkoutGuest.value = guest
  showCheckoutModal.value = true
}

function closeCheckoutModal() {
  showCheckoutModal.value = false
  checkoutGuest.value = null
}

async function doCheckin(guest: any) {
  try {
    await ReservationService.checkin(guest.id)
    checkedIn.value.add(guest.id)
    closeCheckinModal()
    await loadData()
    toast.success('Check-in confirmado', `Hab ${guest.roomNumber}`)
  } catch (e) {
    toast.error('No se pudo hacer el check-in', 'Reintentá en unos segundos')
  }
}

async function confirmCheckin() {
  if (!checkinGuest.value) return
  await doCheckin(checkinGuest.value)
}

async function doCheckout(guest: any) {
  try {
    await ReservationService.checkout(guest.id)
    checkedOut.value.add(guest.id)
    closeCheckoutModal()
    await loadData()
    toast.success('Check-out listo', `${guest.guestName} · Hab ${guest.roomNumber} marcada para limpieza`)
  } catch (e) {
    toast.error('No se pudo hacer el check-out', 'Reintentá en unos segundos')
  }
}

async function confirmCheckout() {
  if (!checkoutGuest.value) return
  await doCheckout(checkoutGuest.value)
}
</script>
