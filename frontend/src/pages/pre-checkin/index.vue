<template>
  <div class="min-h-screen bg-surface flex items-center justify-center p-4">
    <div v-if="!submitted" class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
      <div class="text-center mb-6">
        <div class="text-3xl mb-2">🛎️</div>
        <h2 class="text-2xl font-black text-navy">Pre Check-in</h2>
        <p class="text-sm text-text-muted mt-1">{{ hotelName }}</p>
        <div class="bg-teal/10 rounded-xl p-3 mt-4 text-sm">
          <div class="flex justify-between"><span class="text-text-secondary">Check-in:</span><span class="font-bold text-navy">{{ checkIn }}</span></div>
          <div class="flex justify-between"><span class="text-text-secondary">Check-out:</span><span class="font-bold text-navy">{{ checkOut }}</span></div>
          <div class="flex justify-between"><span class="text-text-secondary">Habitación:</span><span class="font-bold text-navy">{{ roomNumber }}</span></div>
        </div>
      </div>

      <div v-if="error" class="mb-4 px-4 py-2 rounded-lg bg-coral/10 text-coral text-xs font-bold">{{ error }}</div>

      <div class="space-y-4">
        <div>
          <label class="block text-[11px] font-bold text-navy uppercase mb-2">Nombre Completo *</label>
          <input v-model="form.name" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Email</label><input v-model="form.email" type="email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
          <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Teléfono</label><input v-model="form.phone" type="tel" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[11px] font-bold text-navy uppercase mb-2">Tipo Documento</label>
            <select v-model="form.documentType" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
              <option value="passport">Pasaporte</option><option value="dni">Cédula / DNI</option><option value="other">Licencia / Otro</option>
            </select>
          </div>
          <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Nº Documento</label><input v-model="form.document" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Nacionalidad</label><input v-model="form.nationality" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
          <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Fecha Nacimiento</label><input v-model="form.birthDate" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-navy uppercase mb-2">Acompañantes</label>
          <div class="space-y-2">
            <div v-for="(c,i) in form.companions" :key="i" class="flex items-center gap-2 bg-surface rounded-lg p-2">
              <input v-model="c.name" placeholder="Nombre" class="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs" />
              <input v-model="c.documentNumber" placeholder="Doc." class="w-28 px-3 py-1.5 rounded-lg border border-border text-xs" />
              <button @click="form.companions.splice(i,1)" class="text-coral text-xs font-bold cursor-pointer">✕</button>
            </div>
            <button @click="form.companions.push({name:'',documentNumber:''})" class="text-xs font-bold text-teal hover:underline cursor-pointer">+ Agregar</button>
          </div>
        </div>
        <div class="flex items-start gap-3 bg-surface rounded-xl p-4">
          <input v-model="form.acceptTerms" type="checkbox" class="mt-1 w-4 h-4 rounded text-cyan" />
          <div class="text-xs text-text-secondary">Acepto las políticas de privacidad y condiciones del hotel. Autorizo el tratamiento de mis datos personales para el registro de hospedaje.</div>
        </div>
      </div>
      <button @click="submit" :disabled="saving" class="w-full mt-6 py-3 bg-teal text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-teal/80 disabled:opacity-50">
        {{ saving ? 'Enviando...' : 'Completar Check-in' }}
      </button>
    </div>

    <div v-else class="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
      <div class="text-5xl mb-4">✅</div>
      <h2 class="text-xl font-black text-navy mb-2">¡Check-in Completado!</h2>
      <p class="text-sm text-text-secondary mb-4">{{ form.name }}, tu registro fue recibido. Te esperamos el {{ checkIn }}.</p>
      <div class="bg-surface rounded-xl p-3 text-xs text-text-secondary">
        Recibirás los códigos de acceso el día de tu llegada.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { http } from '@/services/http'

const route = useRoute()
const hash = computed(() => route.params.hash as string || route.query.hash as string || '')

const saving = ref(false)
const submitted = ref(false)
const error = ref('')

const hotelName = ref('')
const roomNumber = ref('')
const checkIn = ref('')
const checkOut = ref('')
const reservationId = ref('')

const form = ref({
  name: '', email: '', phone: '', documentType: 'passport', document: '',
  nationality: '', birthDate: '', companions: [] as { name: string; documentNumber: string }[],
  acceptTerms: false,
})

onMounted(async () => {
  if (!hash.value) { error.value = 'Link inválido'; return }
  try {
    const data = await http.get<any>(`/public/pre-checkin/${hash.value}`)
    if (!data || data.error) { error.value = data?.error || 'Reserva no encontrada'; return }
    hotelName.value = data.hotelName || ''
    roomNumber.value = data.roomNumber || ''
    checkIn.value = String(data.checkIn || '').slice(0, 10)
    checkOut.value = String(data.checkOut || '').slice(0, 10)
    reservationId.value = data.reservationId || data.id || ''
    form.value.name = data.name || data.guestName || ''
    form.value.email = data.email || ''
  } catch { error.value = 'Error al cargar datos de la reserva' }
})

async function submit() {
  if (!form.value.name) { error.value = 'Nombre requerido'; return }
  if (!form.value.acceptTerms) { error.value = 'Debes aceptar las políticas'; return }
  saving.value = true; error.value = ''
  try {
    await http.post(`/public/pre-checkin/${hash.value}`, { ...form.value, reservationId: reservationId.value })
    submitted.value = true
  } catch (e: any) { error.value = e.message || 'Error al enviar' }
  saving.value = false
}
</script>
