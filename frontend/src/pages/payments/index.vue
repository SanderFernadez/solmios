<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Links de Pago</h2>
        <p class="text-xs text-text-muted mt-0.5">Cobros pendientes enviados a huéspedes — seguimiento de estado</p>
      </div>
      <button @click="openNew" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">+ Nuevo Link</button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-coral">{{ stats.pending }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Pendientes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">{{ stats.paid }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Pagados</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">{{ formatMoney(stats.paidAmount) }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Cobrado (total)</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-gold">{{ formatMoney(stats.pendingAmount) }}</div>
        <div class="text-[10px] text-text-muted uppercase font-bold">Por cobrar</div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar por reserva o destinatario..." class="px-4 py-2 rounded-xl border border-border text-sm w-64 focus:outline-none focus:border-navy" />
      <select v-model="filterStatus" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los estados</option>
        <option value="pending">⏳ Pendientes</option>
        <option value="paid">✅ Pagados</option>
        <option value="expired">⌛ Expirados</option>
        <option value="cancelled">❌ Cancelados</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} resultados</span>
    </div>

    <!-- Lista -->
    <div v-if="loading" class="card p-12 text-center text-sm text-text-muted">Cargando...</div>
    <div v-else-if="filtered.length === 0" class="card p-12 text-center">
      <div class="text-4xl mb-3 opacity-50">💳</div>
      <h3 class="font-bold text-navy mb-1">Sin links de pago</h3>
      <p class="text-xs text-text-muted mb-4">Crea un link para cobrar a un huésped de forma remota</p>
      <button @click="openNew" class="px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold cursor-pointer">+ Crear link</button>
    </div>
    <div v-else class="bg-white rounded-2xl border border-border overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Reserva</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Destinatario</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Monto</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Enviado vía</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id" class="border-b border-border/50 last:border-0 hover:bg-surface/30">
            <td class="p-3">
              <div class="text-xs font-bold text-navy">{{ p.reservationId?.slice(0, 8) || '—' }}</div>
              <div v-if="p.guestName" class="text-[10px] text-text-muted">{{ p.guestName }}</div>
            </td>
            <td class="p-3">
              <div class="text-xs text-navy">{{ p.sentTo || '—' }}</div>
            </td>
            <td class="p-3 text-right">
              <div class="text-sm font-black text-navy">{{ formatMoney(p.amount) }}</div>
              <div class="text-[10px] text-text-muted">{{ p.currency || 'USD' }}</div>
            </td>
            <td class="p-3">
              <span class="text-xs">{{ channelIcon(p.sentVia) }} {{ channelLabel(p.sentVia) }}</span>
            </td>
            <td class="p-3">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="statusClass(p.status)">{{ statusLabel(p.status) }}</span>
            </td>
            <td class="p-3">
              <div class="text-[11px] text-navy">{{ formatDate(p.createdAt) }}</div>
              <div v-if="p.paidAt" class="text-[10px] text-teal">Pagado {{ formatDate(p.paidAt) }}</div>
            </td>
            <td class="p-3 text-right" @click.stop>
              <div class="flex gap-1 justify-end flex-wrap">
                <button v-if="stripeConfigured && p.status === 'pending'" @click="createStripe(p)" title="Crear link de pago Stripe" class="px-2 py-1 bg-purple/10 text-purple rounded-lg text-[10px] font-bold cursor-pointer hover:bg-purple/20">💳</button>
                <button v-if="p.stripePaymentUrl && p.status === 'pending'" @click="copyStripeUrl(p)" title="Copiar URL de pago" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20">🔗</button>
                <button v-if="p.status === 'pending'" @click="resend(p, 'email')" title="Reenviar email" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20">📧</button>
                <button v-if="p.status === 'pending'" @click="resend(p, 'whatsapp')" title="Reenviar WhatsApp" class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-emerald-200">💬</button>
                <button v-if="p.status === 'pending'" @click="markAsPaid(p)" title="Marcar pagado (manual)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold cursor-pointer hover:bg-teal/20">✓</button>
                <button v-if="p.status === 'pending'" @click="cancel(p)" title="Cancelar" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">✕</button>
                <button @click="remove(p)" title="Eliminar" class="px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-gray-200">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Nuevo link -->
    <Teleport to="body">
      <div v-if="newModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="newModal.show=false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="text-lg font-black text-navy mb-4">+ Nuevo Link de Pago</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Reserva *</label>
              <select v-model="newForm.reservationId" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                <option value="">Seleccionar...</option>
                <option v-for="r in reservations" :key="r.id" :value="r.id">
                  {{ r.guestName }} · Hab. {{ r.roomNumber }} · {{ formatDate(r.checkIn) }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Monto *</label>
              <input v-model.number="newForm.amount" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              <p v-if="selectedReservation" class="text-[10px] text-text-muted mt-1">
                Pendiente aprox: {{ formatMoney((selectedReservation.totalAmount || 0) - (selectedReservation.deposit || 0)) }}
                <button @click="newForm.amount = Math.max(0, (selectedReservation.totalAmount || 0) - (selectedReservation.deposit || 0))" type="button" class="text-teal hover:underline cursor-pointer ml-2 font-bold">Usar</button>
              </p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Enviar a</label>
                <input v-model="newForm.sentTo" type="text" placeholder="email o teléfono" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Vía</label>
                <select v-model="newForm.sentVia" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                  <option value="email">📧 Email</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="sms">📱 SMS</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="newModal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="create" :disabled="creating" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ creating ? 'Creando...' : 'Crear link' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { PaymentsService } from '@/services/Payments.service'
import type { PaymentRequest } from '@/services/Payments.service'
import { ReservationService } from '@/services/Reservation.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const payments = ref<PaymentRequest[]>([])
const reservations = ref<any[]>([])
const loading = ref(true)
const creating = ref(false)
const search = ref('')
const filterStatus = ref('')

const newModal = ref({ show: false })
const newForm = ref<{ reservationId: string; amount: number; sentTo: string; sentVia: 'email' | 'whatsapp' | 'sms' }>({
  reservationId: '', amount: 0, sentTo: '', sentVia: 'email',
})

const selectedReservation = computed(() => reservations.value.find(r => r.id === newForm.value.reservationId))
const stripeConfigured = ref(false)

async function checkStripeStatus() {
  try {
    const s = await PaymentsService.status()
    stripeConfigured.value = s.configured
  } catch { stripeConfigured.value = false }
}

async function createStripe(p: PaymentRequest) {
  if (!p.id) return
  try {
    const r = await PaymentsService.createStripeCheckout(p.id)
    p.stripePaymentUrl = r.url
    p.stripeSessionId = r.sessionId
    // Abrir en nueva ventana
    window.open(r.url, '_blank')
    toast.success('Sesión de pago Stripe creada')
  } catch (e: any) {
    toast.error(e.message || 'Error al crear sesión Stripe')
  }
}

async function copyStripeUrl(p: PaymentRequest) {
  if (!p.stripePaymentUrl) return
  try {
    await navigator.clipboard.writeText(p.stripePaymentUrl)
    toast.success('URL copiada al portapapeles')
  } catch {
    toast.error('No se pudo copiar')
  }
}

const stats = computed(() => {
  const pending = payments.value.filter(p => p.status === 'pending')
  const paid = payments.value.filter(p => p.status === 'paid')
  return {
    pending: pending.length,
    paid: paid.length,
    pendingAmount: pending.reduce((s, p) => s + (p.amount || 0), 0),
    paidAmount: paid.reduce((s, p) => s + (p.amount || 0), 0),
  }
})

const filtered = computed(() => {
  let list = [...payments.value]
  if (filterStatus.value) list = list.filter(p => p.status === filterStatus.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      (p.reservationId || '').toLowerCase().includes(q) ||
      (p.sentTo || '').toLowerCase().includes(q) ||
      (p.guestName || '').toLowerCase().includes(q)
    )
  }
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
})

async function load() {
  loading.value = true
  try {
    const r = await PaymentsService.list()
    payments.value = (r.data || []) as PaymentRequest[]
  } catch {
    payments.value = []
  } finally {
    loading.value = false
  }
}

async function loadReservations() {
  try {
    const r = await ReservationService.list({ hotelId: hotelId.value })
    reservations.value = (r.reservations || []).map((x: any) => ({
      id: x.id,
      guestName: x.guestName || '—',
      roomNumber: x.roomNumber || '—',
      checkIn: x.checkIn,
      totalAmount: x.totalAmount,
      deposit: x.deposit,
    }))
  } catch { reservations.value = [] }
}

function openNew() {
  newForm.value = { reservationId: '', amount: 0, sentTo: '', sentVia: 'email' }
  newModal.value.show = true
  if (reservations.value.length === 0) loadReservations()
}

async function create() {
  if (!newForm.value.reservationId || !newForm.value.amount || newForm.value.amount <= 0) {
    toast.error('Reserva y monto son obligatorios')
    return
  }
  creating.value = true
  try {
    await PaymentsService.create({
      reservationId: newForm.value.reservationId,
      amount: newForm.value.amount,
      sentTo: newForm.value.sentTo,
      sentVia: newForm.value.sentVia,
    })
    toast.success('Link de pago creado')
    newModal.value.show = false
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error')
  } finally {
    creating.value = false
  }
}

async function markAsPaid(p: PaymentRequest) {
  try {
    await PaymentsService.update(p.id!, { status: 'paid', paidAt: new Date().toISOString() })
    p.status = 'paid'
    p.paidAt = new Date().toISOString()
    toast.success('Marcado como pagado')
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

async function cancel(p: PaymentRequest) {
  if (!confirm('¿Cancelar este link de pago?')) return
  try {
    await PaymentsService.update(p.id!, { status: 'cancelled' })
    p.status = 'cancelled'
    toast.success('Cancelado')
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

async function remove(p: PaymentRequest) {
  if (!confirm('¿Eliminar este link?')) return
  try {
    await PaymentsService.remove(p.id!)
    payments.value = payments.value.filter(x => x.id !== p.id)
    toast.success('Eliminado')
  } catch (e: any) {
    toast.error(e.message || 'Error')
  }
}

function resend(p: PaymentRequest, channel: 'email' | 'whatsapp') {
  const dest = p.sentTo || ''
  if (!dest) { toast.error('Sin destinatario'); return }
  const text = `Link de pago: ${formatMoney(p.amount)} ${p.currency || 'USD'}`
  if (channel === 'email') {
    window.open(`mailto:${dest}?subject=${encodeURIComponent('Link de pago')}&body=${encodeURIComponent(text)}`)
  } else {
    const clean = dest.replace(/[^0-9]/g, '')
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`)
  }
  toast.success(`Reenviado por ${channel}`)
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0)
}
function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}
function statusLabel(s: string): string {
  const m: Record<string, string> = { pending: '⏳ Pendiente', paid: '✅ Pagado', expired: '⌛ Expirado', cancelled: '❌ Cancelado' }
  return m[s] || s
}
function statusClass(s: string): string {
  const m: Record<string, string> = {
    pending: 'bg-gold/10 text-gold',
    paid: 'bg-teal/10 text-teal',
    expired: 'bg-gray-100 text-gray-500',
    cancelled: 'bg-coral/10 text-coral',
  }
  return m[s] || 'bg-gray-100 text-gray-500'
}
function channelIcon(c?: string): string {
  const m: Record<string, string> = { email: '📧', whatsapp: '💬', sms: '📱' }
  return m[c || ''] || '📨'
}
function channelLabel(c?: string): string {
  const m: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS' }
  return m[c || ''] || (c || '—')
}

onMounted(() => {
  load()
  checkStripeStatus()
})
</script>
