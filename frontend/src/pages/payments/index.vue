<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Links de Pago</h2>
        <p class="text-xs text-text-muted mt-0.5">Cobros pendientes enviados a huéspedes — seguimiento de estado</p>
      </div>
      <button @click="openNew" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo Link
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10">
            <span class="w-5 h-5 text-coral" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-coral">{{ stats.pending }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Pendientes</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_CHECK_PLAIN"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal">{{ stats.paid }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Pagados</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">{{ formatMoney(stats.paidAmount) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Cobrado (total)</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_LINK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-gold truncate">{{ formatMoney(stats.pendingAmount) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Por cobrar</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center gap-2 mb-4 flex-wrap">
      <input v-model="search" type="text" placeholder="Buscar por reserva o destinatario..." class="px-4 py-2 rounded-xl border border-border text-sm w-64 focus:outline-none focus:border-navy" />
      <select v-model="filterStatus" class="px-3 py-2 rounded-xl border border-border text-xs font-bold cursor-pointer">
        <option value="">Todos los estados</option>
        <option value="pending">Pendientes</option>
        <option value="paid">Pagados</option>
        <option value="expired">Expirados</option>
        <option value="cancelled">Cancelados</option>
      </select>
      <span class="text-xs text-text-muted ml-auto">{{ filtered.length }} resultados</span>
    </div>

    <!-- Lista -->
    <div v-if="loading" class="card p-12 text-center text-sm text-text-muted">Cargando...</div>
    <div v-else-if="filtered.length === 0" class="card p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_CARD"></span>
      <h3 class="font-bold text-navy mb-1">Sin links de pago</h3>
      <p class="text-xs text-text-muted mb-4">Crea un link para cobrar a un huésped de forma remota</p>
      <button @click="openNew" class="flex items-center gap-1.5 mx-auto px-5 py-2.5 bg-cyan text-navy rounded-xl text-sm font-bold cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Crear link
      </button>
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
              <span class="flex items-center gap-1.5 text-xs text-navy">
                <span class="w-3.5 h-3.5 text-text-muted shrink-0" v-html="channelIcon(p.sentVia)"></span>
                {{ channelLabel(p.sentVia) }}
              </span>
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
                <button v-if="stripeConfigured && p.status === 'pending'" @click="createStripe(p)" title="Crear link de pago Stripe" class="flex items-center gap-1 px-2 py-1 bg-purple/10 text-purple rounded-lg text-[10px] font-bold cursor-pointer hover:bg-purple/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_LINK"></span>
                  Stripe
                </button>
                <button v-if="p.stripePaymentUrl && p.status === 'pending'" @click="copyStripeUrl(p)" title="Copiar URL de pago" class="w-6 h-6 flex items-center justify-center bg-navy/10 text-navy rounded-lg cursor-pointer hover:bg-navy/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_LINK"></span>
                </button>
                <button v-if="p.status === 'pending'" @click="resend(p, 'email')" title="Reenviar email" class="w-6 h-6 flex items-center justify-center bg-navy/10 text-navy rounded-lg cursor-pointer hover:bg-navy/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_ENVELOPE"></span>
                </button>
                <button v-if="p.status === 'pending'" @click="resend(p, 'whatsapp')" title="Reenviar WhatsApp" class="w-6 h-6 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-200">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_CHAT"></span>
                </button>
                <button v-if="p.status === 'pending'" @click="markAsPaid(p)" title="Marcar pagado (manual)" class="w-6 h-6 flex items-center justify-center bg-teal/10 text-teal rounded-lg cursor-pointer hover:bg-teal/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_CHECK_PLAIN"></span>
                </button>
                <button v-if="p.status === 'pending'" @click="cancel(p)" title="Cancelar" class="w-6 h-6 flex items-center justify-center bg-coral/10 text-coral rounded-lg cursor-pointer hover:bg-coral/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_X"></span>
                </button>
                <button @click="remove(p)" title="Eliminar" class="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg cursor-pointer hover:bg-gray-200">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal Nuevo link -->
    <Teleport to="body">
      <div v-if="newModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="flex items-center gap-2 text-lg font-black text-navy mb-4">
            <span class="w-5 h-5 shrink-0" v-html="ICON_LINK"></span>
            Nuevo Link de Pago
          </h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Reserva *</label>
              <select v-model="newForm.reservationId" class="w-full px-3 py-2 rounded-lg border text-sm cursor-pointer focus:outline-none"
                :class="attemptedSubmit && reservationError ? 'border-coral focus:border-coral' : 'border-border focus:border-navy'">
                <option value="">Seleccionar...</option>
                <option v-for="r in reservations" :key="r.id" :value="r.id">
                  {{ r.guestName }} · Hab. {{ r.roomNumber }} · {{ formatDate(r.checkIn) }}
                </option>
              </select>
              <p v-if="attemptedSubmit && reservationError" class="text-[10px] text-coral font-bold mt-1">{{ reservationError }}</p>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Monto *</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">$</span>
                <input v-model="amountDisplay" type="text" inputmode="decimal" placeholder="0.00"
                  @focus="amountFocused = true" @blur="amountFocused = false; roundAmount()"
                  class="w-full pl-7 pr-3 py-2 rounded-lg border text-sm font-bold text-navy text-right focus:outline-none"
                  :class="attemptedSubmit && amountError ? 'border-coral focus:border-coral' : 'border-border focus:border-navy'" />
              </div>
              <p v-if="attemptedSubmit && amountError" class="text-[10px] text-coral font-bold mt-1">{{ amountError }}</p>
              <p v-if="selectedReservation" class="text-[10px] text-text-muted mt-1">
                Pendiente aprox: {{ formatMoney(reservationPendingAmount) }}
                <button @click="newForm.amount = reservationPendingAmount" type="button" class="text-teal hover:underline cursor-pointer ml-2 font-bold">Usar</button>
              </p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Enviar a</label>
                <input v-model="newForm.sentTo" :type="sentToInputType" :placeholder="sentToPlaceholder" autocomplete="off"
                  class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                  :class="attemptedSubmit && sentToError ? 'border-coral focus:border-coral' : 'border-border focus:border-navy'" />
                <p v-if="attemptedSubmit && sentToError" class="text-[10px] text-coral font-bold mt-1">{{ sentToError }}</p>
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Vía</label>
                <select v-model="newForm.sentVia" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="sms">SMS</option>
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

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_CHECK_PLAIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'
const ICON_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5 21 3M16.5 3H21v4.5M10.5 13.5 3 21M7.5 21H3v-4.5"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_ENVELOPE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>'
const ICON_CHAT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"/></svg>'
const ICON_PHONE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>'

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
const newForm = ref<{ reservationId: string; amount: number | null; sentTo: string; sentVia: 'email' | 'whatsapp' | 'sms' }>({
  reservationId: '', amount: null, sentTo: '', sentVia: 'email',
})

const selectedReservation = computed(() => reservations.value.find(r => r.id === newForm.value.reservationId))
const reservationPendingAmount = computed(() => {
  const r = selectedReservation.value
  if (!r) return 0
  return Math.max(0, Math.round(((r.totalAmount || 0) - (r.deposit || 0)) * 100) / 100)
})
const stripeConfigured = ref(false)

// Validación del formulario "Nuevo Link" — solo se muestra tras el primer intento de envío.
const attemptedSubmit = ref(false)
const reservationError = computed(() => (!newForm.value.reservationId ? 'Seleccioná una reserva' : ''))
const amountError = computed(() => {
  const a = newForm.value.amount
  if (a === null || a === undefined || Number.isNaN(a)) return 'Ingresá un monto'
  if (a <= 0) return 'El monto debe ser mayor a $0'
  return ''
})
const sentToError = computed(() => {
  const v = newForm.value.sentTo.trim()
  if (!v) return '' // opcional
  if (newForm.value.sentVia === 'email') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Email inválido'
  }
  return /^[+]?[\d\s()-]{7,}$/.test(v) ? '' : 'Teléfono inválido'
})
const formValid = computed(() => !reservationError.value && !amountError.value && !sentToError.value)

const sentToInputType = computed(() => (newForm.value.sentVia === 'email' ? 'email' : 'tel'))
const sentToPlaceholder = computed(() => (newForm.value.sentVia === 'email' ? 'email@ejemplo.com' : '+1 809 555 0101'))

function roundAmount() {
  if (typeof newForm.value.amount === 'number' && !Number.isNaN(newForm.value.amount)) {
    newForm.value.amount = Math.round(newForm.value.amount * 100) / 100
  }
}

// Campo Monto con separador de miles (5,000.00). Mientras está enfocado se
// edita el número crudo (sin comas, más natural para tipear); al perder el
// foco se muestra formateado. La fuente de verdad sigue siendo newForm.amount.
const amountFocused = ref(false)
const amountDisplay = computed<string>({
  get() {
    const a = newForm.value.amount
    if (a === null || a === undefined || Number.isNaN(a)) return ''
    if (amountFocused.value) return String(a)
    return a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  set(val: string) {
    const cleaned = val.replace(/,/g, '').replace(/[^0-9.]/g, '')
    if (cleaned === '') { newForm.value.amount = null; return }
    const num = Number(cleaned)
    newForm.value.amount = Number.isNaN(num) ? null : num
  },
})

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
  newForm.value = { reservationId: '', amount: null, sentTo: '', sentVia: 'email' }
  attemptedSubmit.value = false
  newModal.value.show = true
  if (reservations.value.length === 0) loadReservations()
}

async function create() {
  attemptedSubmit.value = true
  roundAmount()
  if (!formValid.value) {
    toast.error('Revisá los campos marcados')
    return
  }
  creating.value = true
  try {
    await PaymentsService.create({
      reservationId: newForm.value.reservationId,
      amount: newForm.value.amount as number,
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
  const m: Record<string, string> = { pending: 'Pendiente', paid: 'Pagado', expired: 'Expirado', cancelled: 'Cancelado' }
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
  const m: Record<string, string> = { email: ICON_ENVELOPE, whatsapp: ICON_CHAT, sms: ICON_PHONE }
  return m[c || ''] || ICON_ENVELOPE
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
