<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-black text-navy">Registro de Viajeros</h2>
        <p class="text-xs text-text-muted mt-0.5">Parte de entradas para autoridades · {{ filtered.length }} huéspedes</p>
      </div>
      <div class="flex gap-2">
        <input v-model="dateFrom" type="date" class="px-4 py-2 rounded-xl border border-border text-sm" />
        <input v-model="dateTo" type="date" class="px-4 py-2 rounded-xl border border-border text-sm" />
        <button @click="print" class="px-4 py-2 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">🖨️ Imprimir</button>
      </div>
    </div>

    <div class="card overflow-hidden">
      <table class="w-full" id="registro-print">
        <thead><tr class="border-b-2 border-navy bg-surface/50">
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Nº</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Nombre</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Documento</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Nacionalidad</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">F. Nacimiento</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Check-in</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Check-out</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Hab.</th>
        </tr></thead>
        <tbody>
          <tr v-for="(g, i) in filtered" :key="g.id" class="border-b border-border hover:bg-surface/30">
            <td class="p-3 text-xs text-text-muted">{{ i + 1 }}</td>
            <td class="p-3 text-sm font-bold text-navy">{{ g.guestName }}</td>
            <td class="p-3 text-sm">{{ g.documentType || '—' }} {{ g.documentNumber || '' }}</td>
            <td class="p-3 text-sm">{{ g.nationality || '—' }}</td>
            <td class="p-3 text-sm">{{ g.birthDate || '—' }}</td>
            <td class="p-3 text-sm">{{ g.checkIn }}</td>
            <td class="p-3 text-sm">{{ g.checkOut }}</td>
            <td class="p-3 text-sm font-bold">{{ g.roomNumber }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { http } from '@/services/http'

const auth = useAuthStore()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const dateFrom = ref(new Date(Date.now() - 30*86400000).toISOString().slice(0,10))
const dateTo = ref(new Date().toISOString().slice(0,10))
const guests = ref<any[]>([])

const filtered = computed(() => {
  if (!dateFrom.value && !dateTo.value) return guests.value
  return guests.value.filter(g => {
    const ci = g.checkIn
    return (!dateFrom.value || ci >= dateFrom.value) && (!dateTo.value || ci <= dateTo.value)
  })
})

async function load() {
  try {
    const { GuestService } = await import('@/services/Guest.service')
    const { RoomService } = await import('@/services/Room.service')
    const { ReservationService } = await import('@/services/Reservation.service')
    const [gst, rom, res] = await Promise.all([
      GuestService.list({ hotelId: hid.value }).catch(() => ({ guests: [], total: 0 })),
      RoomService.list({ hotelId: hid.value }).catch(() => ({ rooms: [], total: 0 })),
      ReservationService.list({ hotelId: hid.value }).catch(() => ({ reservations: [], total: 0 })),
    ])
    const roomMap = new Map((rom.rooms || []).map((r: any) => [r.id, r]))
    const resMap = new Map<string, any>()
    for (const r of (res.reservations || [])) {
      if (r.guestId && !resMap.has(r.guestId)) resMap.set(r.guestId, r)
    }
    guests.value = (gst.guests || []).map((g: any) => {
      const reservation = resMap.get(g.id)
      const room = reservation ? roomMap.get(reservation.roomId) : null
      return {
        id: g.id,
        guestName: g.name || g.firstName || 'Guest',
        documentType: g.documentType || 'Pasaporte',
        documentNumber: g.documentNumber || '',
        nationality: g.nationality || '',
        birthDate: g.birthDate?.slice(0,10) || '',
        checkIn: reservation ? String(reservation.checkIn || '').slice(0,10) : '—',
        checkOut: reservation ? String(reservation.checkOut || '').slice(0,10) : '—',
        roomNumber: room?.number || '—',
      }
    })
  } catch {}
}

function print() { window.print() }

onMounted(load)
</script>
