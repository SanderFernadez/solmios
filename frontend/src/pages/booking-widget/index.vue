<template>
  <div class="min-h-screen bg-gradient-to-br from-navy via-navy to-blue">
    <!-- Header -->
    <header class="bg-white/10 backdrop-blur-md border-b border-white/10">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-cyan flex items-center justify-center font-black text-navy text-lg">{{ hotelName?.[0] || 'H' }}</div>
          <div>
            <div class="font-black text-white text-lg">{{ hotelName || 'Hotel' }}</div>
            <div class="text-[10px] text-white/50">Reserva en línea</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-[10px] text-white/50">¿Necesitas ayuda?</div>
          <div class="text-sm font-bold text-cyan">+1 (809) 555-0100</div>
        </div>
      </div>
    </header>

    <div class="max-w-6xl mx-auto px-6 py-8">
      <!-- Search Box -->
      <div class="bg-white rounded-2xl shadow-2xl p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Check-in</label>
            <input v-model="checkIn" type="date" :min="today" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Check-out</label>
            <input v-model="checkOut" type="date" :min="checkIn || today" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Huéspedes</label>
            <select v-model="guests" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan cursor-pointer">
              <option v-for="n in 8" :key="n" :value="n">{{ n }} huésped{{ n > 1 ? 'es' : '' }}</option>
            </select>
          </div>
          <button @click="searchAvailability" :disabled="!checkIn || !checkOut || searching" class="h-12 bg-cyan text-navy font-extrabold text-sm rounded-xl hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer">
            {{ searching ? 'Buscando...' : '🔍 Buscar' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="searching" class="text-center py-12">
        <div class="text-4xl mb-4 animate-pulse">🏨</div>
        <div class="text-white/70 font-bold">Buscando disponibilidad...</div>
      </div>

      <!-- Results -->
      <div v-if="!searching && results.length > 0">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-black text-white">{{ results.length }} tipo{{ results.length !== 1 ? 's' : '' }} de habitación disponible{{ results.length !== 1 ? 's' : '' }}</h2>
          <div class="text-sm text-white/50">{{ nights }} noche{{ nights !== 1 ? 's' : '' }}</div>
        </div>

        <div class="grid gap-4">
          <div v-for="rt in results" :key="rt.type" class="bg-white rounded-2xl p-6 hover:shadow-xl transition-all">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-lg font-black text-navy capitalize">{{ rt.type }}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal">{{ rt.count }} disponible{{ rt.count !== 1 ? 's' : '' }}</span>
                </div>
                <div class="text-sm text-text-muted mb-3">
                  Habitación con cama {{ rt.type === 'suite' ? 'king size' : rt.type === 'single' ? 'individual' : 'doble' }}, baño privado, aire acondicionado, WiFi gratuito.
                </div>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-text-muted">
                  <span>👥 Hasta {{ rt.rooms[0]?.capacity || 2 }} huéspedes</span>
                  <span v-for="a in (rt.amenities||[]).slice(0,5)" :key="a">· {{ amenityLabel(a) }}</span>
                </div>
              </div>
              <div class="text-right ml-6">
                <div class="text-2xl font-black text-navy">${{ (rt.price * nights).toLocaleString() }}</div>
                <div class="text-[10px] text-text-muted">${{ rt.price }}/noche × {{ nights }}</div>
                <button @click="selectRoom(rt)" class="mt-3 px-6 py-2.5 bg-navy text-white text-sm font-extrabold rounded-xl hover:shadow-lg transition-all cursor-pointer">
                  Reservar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No results -->
      <div v-if="!searching && searched && results.length === 0" class="text-center py-12">
        <div class="text-4xl mb-4">😔</div>
        <div class="text-white font-bold mb-2">No hay habitaciones disponibles</div>
        <div class="text-white/50 text-sm">Intenta con otras fechas</div>
      </div>
    </div>

    <!-- Booking Modal -->
    <div v-if="showBookingModal" class="fixed inset-0 bg-navy/80 flex items-center justify-center z-50 p-4" @click.self="showBookingModal = false">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 class="text-lg font-black text-navy">Confirmar Reserva</h3>
            <div class="text-sm text-text-muted capitalize">{{ selectedType?.type }} — ${{ selectedType?.price }}/noche</div>
          </div>
          <button @click="showBookingModal = false" class="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-muted hover:text-navy cursor-pointer">✕</button>
        </div>
        <div class="p-6">
          <!-- Reservation Summary -->
          <div class="bg-surface rounded-xl p-4 mb-6">
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div><span class="text-text-muted">Check-in:</span> <span class="font-bold ml-1">{{ checkIn }}</span></div>
              <div><span class="text-text-muted">Check-out:</span> <span class="font-bold ml-1">{{ checkOut }}</span></div>
              <div><span class="text-text-muted">Noches:</span> <span class="font-bold ml-1">{{ nights }}</span></div>
              <div><span class="text-text-muted">Huéspedes:</span> <span class="font-bold ml-1">{{ guests }}</span></div>
            </div>
            <div class="border-t border-border mt-3 pt-3 flex justify-between">
              <span class="font-bold text-navy">Total</span>
              <span class="text-lg font-black text-navy">${{ (selectedType!.price * nights).toLocaleString() }}</span>
            </div>
          </div>

          <!-- Guest Form -->
          <div class="space-y-4">
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Nombre completo *</label>
              <input v-model="form.name" type="text" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="Juan Pérez" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Email *</label>
                <input v-model="form.email" type="email" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="juan@email.com" />
              </div>
              <div>
                <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Teléfono</label>
                <input v-model="form.phone" type="tel" class="w-full h-12 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="+1 (809) 555-0000" />
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-text-muted uppercase mb-2">Notas especiales</label>
              <textarea v-model="form.notes" rows="3" class="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none" placeholder="Solicitudes especiales, alergias, celebraciones..."></textarea>
            </div>
          </div>
        </div>
        <div class="flex gap-3 p-6 border-t border-border">
          <button @click="showBookingModal = false" class="flex-1 h-12 bg-surface text-text-secondary rounded-xl text-sm font-bold hover:bg-surface-dark cursor-pointer">Cancelar</button>
          <button @click="submitBooking" :disabled="submitting || !form.name || !form.email" class="flex-1 h-12 bg-cyan text-navy rounded-xl text-sm font-extrabold hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer">
            {{ submitting ? 'Reservando...' : '✓ Confirmar Reserva' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Success -->
    <div v-if="bookingConfirmed" class="fixed inset-0 bg-navy/80 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl w-full max-w-md p-8 text-center">
        <div class="text-5xl mb-4">✅</div>
        <h3 class="text-xl font-black text-navy mb-2">¡Reserva Confirmada!</h3>
        <p class="text-sm text-text-muted mb-4">Tu reserva ha sido registrada exitosamente. Recibirás un email de confirmación en <strong>{{ form.email }}</strong>.</p>
        <div class="bg-surface rounded-xl p-4 mb-6 text-sm">
          <div class="flex justify-between mb-2"><span class="text-text-muted">Check-in:</span><span class="font-bold">{{ checkIn }}</span></div>
          <div class="flex justify-between mb-2"><span class="text-text-muted">Check-out:</span><span class="font-bold">{{ checkOut }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Total:</span><span class="font-black text-navy">${{ (selectedType!.price * nights).toLocaleString() }}</span></div>
        </div>
        <button @click="resetForm" class="w-full h-12 bg-navy text-white rounded-xl text-sm font-extrabold hover:shadow-lg cursor-pointer">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { http } from '@/services/http'
import { useToast } from '@/composables/useToast'

const toast = useToast()

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const today = new Date().toISOString().split('T')[0]
const checkIn = ref('')
const checkOut = ref('')
const guests = ref(2)
const searching = ref(false)
const searched = ref(false)
const results = ref<any[]>([])
const hotelName = ref('')
const hotelId = ref('')
const showBookingModal = ref(false)
const selectedType = ref<any>(null)
const submitting = ref(false)
const bookingConfirmed = ref(false)

const form = ref({ name: '', email: '', phone: '', notes: '' })

const AMENITY_LABELS: Record<string, string> = {
  ac: 'A/C', heating: 'Calefacción', wifi: 'WiFi', tv: 'TV', safe: 'Caja fuerte', minibar: 'Minibar',
  kitchen: 'Cocina', fridge: 'Nevera', microwave: 'Microondas', coffee_maker: 'Cafetera', washer: 'Lavadora',
  dishwasher: 'Lavavajillas', hair_dryer: 'Secador', iron: 'Plancha', balcony: 'Balcón', bathtub: 'Bañera', work_desk: 'Escritorio',
}
function amenityLabel(key: string) { return AMENITY_LABELS[key] || key }

const nights = computed(() => {
  if (!checkIn.value || !checkOut.value) return 0
  return Math.max(1, Math.round((new Date(checkOut.value).getTime() - new Date(checkIn.value).getTime()) / 86400000))
})

onMounted(async () => {
  if (slug.value) {
    try {
      const data = await http.get<any>(`/public/booking/${slug.value}`)
      hotelName.value = data.hotel?.name || slug.value
      hotelId.value = data.hotel?.id || ''
    } catch { hotelName.value = slug.value }
  }
})

async function searchAvailability() {
  if (!checkIn.value || !checkOut.value) return
  searching.value = true
  searched.value = false
  try {
    // Se envían checkIn/checkOut al backend para que filtre rooms con reserva solapada (sin overbooking).
    const data = await http.get<any>(`/public/booking/${slug.value}?checkIn=${checkIn.value}&checkOut=${checkOut.value}`)
    hotelId.value = data.hotel?.id || ''
    hotelName.value = data.hotel?.name || hotelName.value
    results.value = (data.roomTypes || []).filter((rt: any) => rt.count > 0)
  } catch { results.value = [] }
  searched.value = true
  searching.value = false
}

function selectRoom(rt: any) {
  selectedType.value = rt
  showBookingModal.value = true
}

async function submitBooking() {
  if (!form.value.name || !form.value.email || !selectedType.value) return
  submitting.value = true
  try {
    const room = selectedType.value.rooms[0]
    await http.post('/public/booking', {
      hotelId: hotelId.value,
      roomId: room.id,
      guestName: form.value.name,
      guestEmail: form.value.email,
      guestPhone: form.value.phone,
      checkIn: checkIn.value,
      checkOut: checkOut.value,
      adults: guests.value,
    })
    showBookingModal.value = false
    bookingConfirmed.value = true
  } catch { toast.error('Error al crear reserva') }
  submitting.value = false
}

function resetForm() {
  bookingConfirmed.value = false
  showBookingModal.value = false
  form.value = { name: '', email: '', phone: '', notes: '' }
  selectedType.value = null
}
</script>
