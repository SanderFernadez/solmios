<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Folios In-House</h2>
        <p class="text-xs text-text-muted mt-0.5">Cuentas abiertas de huéspedes con check-in activo — cargos, pagos y facturación</p>
      </div>
      <div class="flex gap-2">
        <button @click="load" :disabled="loading" class="flex items-center gap-1.5 px-4 py-2 bg-navy/5 hover:bg-navy/10 text-navy rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_REFRESH"></span>
          {{ loading ? 'Cargando...' : 'Refrescar' }}
        </button>
        <button @click="postAllRoomCharges" :disabled="posting"
          class="flex items-center gap-1.5 px-4 py-2 bg-cyan text-navy font-bold text-sm rounded-xl hover:shadow-lg cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_BUILDING"></span>
          {{ posting ? 'Posteando...' : 'Postear cargos habitación (todos)' }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_BUILDING"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy">{{ folios.length }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Folios abiertos</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal truncate">{{ formatMoney(totalCharges) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total cargos</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_CARD"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-cyan truncate">{{ formatMoney(totalPayments) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total pagos</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="totalBalance > 0 ? 'bg-coral/10' : 'bg-teal/10'">
            <span class="w-5 h-5" :class="totalBalance > 0 ? 'text-coral' : 'text-teal'" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none truncate" :class="totalBalance > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(totalBalance) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Balance pendiente</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista -->
    <div v-if="loading && folios.length === 0" class="card p-12 text-center text-sm text-text-muted">Cargando folios...</div>
    <div v-else-if="folios.length === 0" class="card p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
      <h3 class="font-bold text-navy mb-1">Sin folios abiertos</h3>
      <p class="text-xs text-text-muted">Los folios se abren automáticamente al hacer check-in de una reserva.</p>
    </div>
    <div v-else class="space-y-3">
      <div v-for="f in folios" :key="f.id" class="bg-white rounded-2xl border border-border overflow-hidden">
        <!-- Header -->
        <div class="px-5 py-4 flex items-center justify-between hover:bg-surface/30 cursor-pointer" @click="toggleFolio(f.id)">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan font-black shrink-0">
              {{ f.roomNumber || '?' }}
            </div>
            <div class="min-w-0">
              <div class="text-sm font-black text-navy truncate">{{ f.guestName || `Folio ${f.id.slice(0,8)}` }}</div>
              <div class="text-[10px] text-text-muted">
                Hab. {{ f.roomNumber || '—' }} · Abierto {{ formatDate(f.openedAt) }} · {{ f.chargeCount || 0 }} cargos
              </div>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-[10px] text-text-muted uppercase font-bold">Balance</div>
              <div class="text-sm font-black" :class="(f.balance || 0) > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(f.balance || 0) }}</div>
            </div>
            <span class="w-4 h-4 text-text-muted shrink-0 transition-transform" :class="expanded.has(f.id) ? 'rotate-180' : ''" v-html="ICON_CHEVRON_DOWN"></span>
          </div>
        </div>

        <!-- Detalle expandido -->
        <div v-if="expanded.has(f.id)" class="border-t border-border p-5 space-y-4 bg-surface/30">
          <!-- Cargos -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h4 class="text-xs font-black text-navy uppercase">Cargos y pagos</h4>
              <button @click.stop="openChargeModal(f)" class="text-[10px] font-bold text-teal hover:underline cursor-pointer">+ Agregar cargo</button>
            </div>
            <div v-if="!f.charges || f.charges.length === 0" class="text-xs text-text-muted py-2">Sin movimientos. Postea los cargos de habitación con el botón superior.</div>
            <div v-else class="bg-white rounded-xl border border-border divide-y divide-border">
              <div v-for="c in f.charges" :key="c.id" class="px-3 py-2 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full shrink-0" :class="c.kind === 'payment' ? 'bg-teal' : 'bg-navy/30'"></span>
                  <div class="min-w-0">
                    <div class="font-bold text-navy truncate">{{ c.description || c.category }}</div>
                    <div class="text-[10px] text-text-muted">{{ categoryLabel(c.category) }} · {{ formatDate(c.postedAt) }} · {{ c.source }}</div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="font-bold" :class="c.kind === 'payment' ? 'text-teal' : 'text-navy'">
                    {{ c.kind === 'payment' ? '-' : '+' }}{{ formatMoney(c.total) }}
                  </div>
                  <div v-if="c.quantity > 1" class="text-[10px] text-text-muted">{{ c.quantity }}u × {{ formatMoney(c.amount) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Totales -->
          <div class="grid grid-cols-3 gap-3 text-xs">
            <div class="bg-white rounded-lg p-2 border border-border">
              <div class="text-[10px] text-text-muted uppercase font-bold">Cargos</div>
              <div class="font-black text-navy">{{ formatMoney(f.chargesTotal || 0) }}</div>
            </div>
            <div class="bg-white rounded-lg p-2 border border-border">
              <div class="text-[10px] text-text-muted uppercase font-bold">Pagos</div>
              <div class="font-black text-teal">{{ formatMoney(f.paymentsTotal || 0) }}</div>
            </div>
            <div class="bg-white rounded-lg p-2 border border-border">
              <div class="text-[10px] text-text-muted uppercase font-bold">Balance</div>
              <div class="font-black" :class="(f.balance || 0) > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(f.balance || 0) }}</div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="flex flex-wrap gap-2">
            <button @click.stop="openPayModal(f)" class="flex items-center gap-1.5 px-3 py-2 bg-teal/10 text-teal rounded-lg text-xs font-bold cursor-pointer hover:bg-teal/20">
              <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_CARD"></span>
              Registrar pago
            </button>
            <button @click.stop="closeAndInvoice(f)" :disabled="closing === f.id"
              class="flex items-center gap-1.5 px-3 py-2 bg-navy text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-navy/90 disabled:opacity-50">
              <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_DOCUMENT"></span>
              {{ closing === f.id ? 'Cerrando...' : 'Cerrar y facturar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Agregar cargo -->
    <Teleport to="body">
      <div v-if="chargeModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="flex items-center gap-2 text-lg font-black text-navy mb-4">
            <span class="w-5 h-5 shrink-0" v-html="ICON_PLUS"></span>
            Cargo a folio
          </h3>
          <div class="space-y-3">
            <div class="bg-surface rounded-lg p-2 text-xs text-text-secondary">
              <strong>{{ chargeModal.folio?.guestName }}</strong> · Hab. {{ chargeModal.folio?.roomNumber }}
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Categoría</label>
              <select v-model="chargeForm.category" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                <option value="room">Habitación</option>
                <option value="minibar">Minibar</option>
                <option value="restaurant">Restaurante</option>
                <option value="laundry">Lavandería</option>
                <option value="spa">SPA</option>
                <option value="service">Servicio</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Descripción</label>
              <input v-model="chargeForm.description" type="text" placeholder="Ej: Cena - menú del día" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Monto unitario</label>
                <input v-model.number="chargeForm.amount" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Cantidad</label>
                <input v-model.number="chargeForm.quantity" type="number" min="1" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              </div>
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="chargeModal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="saveCharge" :disabled="savingCharge" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ savingCharge ? 'Guardando...' : 'Agregar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal Registrar pago -->
    <Teleport to="body">
      <div v-if="payModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <h3 class="flex items-center gap-2 text-lg font-black text-navy mb-4">
            <span class="w-5 h-5 shrink-0" v-html="ICON_CARD"></span>
            Registrar pago
          </h3>
          <div class="space-y-3">
            <div class="bg-surface rounded-lg p-2 text-xs text-text-secondary">
              <strong>{{ payModal.folio?.guestName }}</strong> · Hab. {{ payModal.folio?.roomNumber }} · Balance: {{ formatMoney(payModal.folio?.balance || 0) }}
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Método</label>
              <select v-model="payForm.method" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
                <option value="link">Link de pago</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Monto</label>
              <div class="flex gap-2">
                <input v-model.number="payForm.amount" type="number" min="0" step="0.01" :placeholder="String(payModal.folio?.balance || 0)" class="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right" />
                <button @click="payForm.amount = payModal.folio?.balance || 0" type="button" class="px-3 py-2 bg-navy/5 text-navy rounded-lg text-xs font-bold cursor-pointer">Total</button>
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Referencia (opcional)</label>
              <input v-model="payForm.reference" type="text" placeholder="Ej: TXN-12345" class="w-full px-3 py-2 rounded-lg border border-border text-sm" />
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="payModal.show=false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="savePayment" :disabled="savingPay" class="flex-1 py-2.5 bg-teal text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ savingPay ? 'Guardando...' : 'Registrar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FoliosService } from '@/services/Folios.service'
import type { Folio } from '@/services/Folios.service'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>'
const ICON_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const folios = ref<Folio[]>([])
const loading = ref(false)
const posting = ref(false)
const closing = ref<string | null>(null)
const expanded = ref<Set<string>>(new Set())

const totalCharges = computed(() => folios.value.reduce((s, f) => s + (f.chargesTotal || 0), 0))
const totalPayments = computed(() => folios.value.reduce((s, f) => s + (f.paymentsTotal || 0), 0))
const totalBalance = computed(() => folios.value.reduce((s, f) => s + (f.balance || 0), 0))

async function load() {
  loading.value = true
  try {
    folios.value = await FoliosService.list(hotelId.value, 'open')
  } catch (e: any) {
    toast.error(e.message || 'Error al cargar folios')
    folios.value = []
  } finally {
    loading.value = false
  }
}

function toggleFolio(id: string) {
  const s = new Set(expanded.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expanded.value = s
  // Cargar detalle del folio si no tiene charges
  const f = folios.value.find(x => x.id === id)
  if (s.has(id) && f && (!f.charges || f.charges.length === 0)) {
    FoliosService.get(id).then(detail => {
      const idx = folios.value.findIndex(x => x.id === id)
      if (idx >= 0) folios.value[idx] = { ...folios.value[idx], ...detail }
    }).catch(() => {})
  }
}

async function postAllRoomCharges() {
  if (posting.value) return
  posting.value = true
  try {
    await OperationsService.nightAuditRun(hotelId.value)
    toast.success('Cargos de habitación posteados a folios in-house')
    await load()
  } catch (e: any) {
    toast.error(e.message || 'Error al postear cargos')
  } finally {
    posting.value = false
  }
}

// Modal cargo
const chargeModal = ref<{ show: boolean; folio: Folio | null }>({ show: false, folio: null })
const chargeForm = ref<{ category: string; description: string; amount: number; quantity: number }>({ category: 'service', description: '', amount: 0, quantity: 1 })
const savingCharge = ref(false)

function openChargeModal(f: Folio) {
  chargeModal.value = { show: true, folio: f }
  chargeForm.value = { category: 'service', description: '', amount: 0, quantity: 1 }
}

async function saveCharge() {
  if (!chargeModal.value.folio) return
  if (!chargeForm.value.amount || chargeForm.value.amount <= 0) {
    toast.error('Monto debe ser mayor a 0')
    return
  }
  savingCharge.value = true
  try {
    await FoliosService.charge(chargeModal.value.folio.id, {
      description: chargeForm.value.description,
      amount: chargeForm.value.amount,
      category: chargeForm.value.category,
      quantity: chargeForm.value.quantity,
    })
    toast.success('Cargo agregado')
    chargeModal.value.show = false
    // Recargar el folio específico
    const detail = await FoliosService.get(chargeModal.value.folio.id)
    const idx = folios.value.findIndex(f => f.id === detail.id)
    if (idx >= 0) folios.value[idx] = detail
  } catch (e: any) {
    toast.error(e.message || 'Error')
  } finally {
    savingCharge.value = false
  }
}

// Modal pago
const payModal = ref<{ show: boolean; folio: Folio | null }>({ show: false, folio: null })
const payForm = ref<{ method: string; amount: number; reference: string }>({ method: 'cash', amount: 0, reference: '' })
const savingPay = ref(false)

function openPayModal(f: Folio) {
  payModal.value = { show: true, folio: f }
  payForm.value = { method: 'cash', amount: f.balance || 0, reference: '' }
}

async function savePayment() {
  if (!payModal.value.folio) return
  if (!payForm.value.amount || payForm.value.amount <= 0) {
    toast.error('Monto debe ser mayor a 0')
    return
  }
  savingPay.value = true
  try {
    await FoliosService.pay(payModal.value.folio.id, {
      amount: payForm.value.amount,
      method: payForm.value.method,
      reference: payForm.value.reference,
    })
    toast.success('Pago registrado')
    payModal.value.show = false
    const detail = await FoliosService.get(payModal.value.folio.id)
    const idx = folios.value.findIndex(f => f.id === detail.id)
    if (idx >= 0) folios.value[idx] = detail
  } catch (e: any) {
    toast.error(e.message || 'Error')
  } finally {
    savingPay.value = false
  }
}

async function closeAndInvoice(f: Folio) {
  if (!confirm(`¿Cerrar folio de ${f.guestName} y generar factura?`)) return
  closing.value = f.id
  try {
    await FoliosService.closeAndInvoice(f.id)
    toast.success('Folio cerrado y factura generada')
    folios.value = folios.value.filter(x => x.id !== f.id)
  } catch (e: any) {
    toast.error(e.message || 'Error al cerrar folio')
  } finally {
    closing.value = null
  }
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0)
}

function formatDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function categoryLabel(c: string): string {
  const m: Record<string, string> = { room: 'Habitación', minibar: 'Minibar', restaurant: 'Restaurante', laundry: 'Lavandería', spa: 'SPA', service: 'Servicio', other: 'Otro' }
  return m[c] || c
}

onMounted(load)
</script>
