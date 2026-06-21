<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-xl font-black text-navy">Caja</h2>
        <p class="text-xs text-text-muted mt-0.5">Registro de cobros y movimientos</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Registrar Cobro</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div class="card p-4 text-center"><div class="text-xl font-black text-navy">${{ stats.today }}</div><div class="text-[10px] text-text-muted uppercase font-bold">Cobrado Hoy</div></div>
      <div class="card p-4 text-center"><div class="text-xl font-black text-teal">${{ stats.week }}</div><div class="text-[10px] text-text-muted uppercase font-bold">Esta Semana</div></div>
      <div class="card p-4 text-center"><div class="text-xl font-black text-cyan">${{ stats.month }}</div><div class="text-[10px] text-text-muted uppercase font-bold">Este Mes</div></div>
      <div class="card p-4 text-center"><div class="text-xl font-black text-purple">{{ stats.count }}</div><div class="text-[10px] text-text-muted uppercase font-bold">Movimientos</div></div>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <table class="w-full">
        <thead><tr class="border-b border-border bg-surface/50">
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Concepto</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Método</th>
          <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hab.</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Monto</th>
          <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase"></th>
        </tr></thead>
        <tbody>
          <tr v-for="m in movimientos" :key="m.id" class="border-b border-border last:border-0 hover:bg-surface/50">
            <td class="p-4 text-xs text-text-secondary">{{ m.date?.slice(0,10) }}</td>
            <td class="p-4 text-sm font-bold text-navy">{{ m.guestName }}</td>
            <td class="p-4 text-sm">{{ m.concept }}</td>
            <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-teal/10 text-teal">{{ m.method }}</span></td>
            <td class="p-4 text-sm font-bold">{{ m.roomNumber || '—' }}</td>
            <td class="p-4 text-right text-sm font-extrabold text-navy">${{ m.amount }}</td>
            <td class="p-4 text-right"><button @click="deleteMovement(m)" class="text-coral text-[10px] font-bold cursor-pointer hover:underline">🗑️</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- New Movement Modal -->
    <Teleport to="body">
      <div v-if="modal.show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="modal.show=false">
        <div class="bg-white rounded-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-4">Registrar Cobro</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Fecha</label><input v-model="form.date" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Monto $</label><input v-model.number="form.amount" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy" /></div>
            </div>
            <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Huésped</label><input v-model="form.guestName" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Concepto</label>
                <select v-model="form.concept" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="Reserva">Reserva</option><option value="Depósito">Depósito</option><option value="Anticipo">Anticipo</option><option value="Extra">Servicio Extra</option><option value="Minibar">Minibar</option><option value="Otro">Otro</option>
                </select>
              </div>
              <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Método</label>
                <select v-model="form.method" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer">
                  <option value="Efectivo">Efectivo</option><option value="Tarjeta">Tarjeta</option><option value="Transferencia">Transferencia</option><option value="PayPal">PayPal</option><option value="Link de Pago">Link de Pago</option>
                </select>
              </div>
            </div>
            <div><label class="block text-[11px] font-bold text-navy uppercase mb-2">Habitación</label><input v-model="form.roomNumber" type="text" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm" /></div>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="modal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="save" :disabled="saving" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer">{{ saving?'Guardando...':'Registrar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hid = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const movimientos = ref<any[]>([])
const saving = ref(false)
const modal = ref({ show: false })
const form = ref({ date: new Date().toISOString().slice(0,10), amount: 0, guestName: '', concept: 'Reserva', method: 'Efectivo', roomNumber: '' })

const stats = computed(() => {
  const today = new Date().toISOString().slice(0,10)
  const weekStart = new Date(Date.now() - 7*86400000).toISOString().slice(0,10)
  const monthStart = new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
  return {
    today: movimientos.value.filter(m => m.date?.slice(0,10) === today).reduce((s,m) => s + (m.amount||0), 0),
    week: movimientos.value.filter(m => m.date?.slice(0,10) >= weekStart).reduce((s,m) => s + (m.amount||0), 0),
    month: movimientos.value.filter(m => m.date?.slice(0,10) >= monthStart).reduce((s,m) => s + (m.amount||0), 0),
    count: movimientos.value.length,
  }
})

async function load() {
  try {
    const r = await http.get<any>('/caja')
    movimientos.value = Array.isArray(r) ? r : (r?.data || [])
  } catch { movimientos.value = [] }
}

function openNew() {
  form.value = { date: new Date().toISOString().slice(0,10), amount: 0, guestName: '', concept: 'Reserva', method: 'Efectivo', roomNumber: '' }
  modal.value.show = true
}

async function save() {
  saving.value = true
  try {
    const r = await http.post('/caja', { ...form.value, hotelId: hid.value })
    movimientos.value.push(r || { id: Date.now(), ...form.value })
    toast.success('Cobro registrado')
    modal.value.show = false
  } catch { toast.error('Error') }
  saving.value = false
}

async function deleteMovement(m: any) {
  try { await http.delete(`/caja/${m.id}`); movimientos.value = movimientos.value.filter(x => x.id !== m.id); toast.success('Eliminado') }
  catch { toast.error('Error') }
}

onMounted(load)
</script>
