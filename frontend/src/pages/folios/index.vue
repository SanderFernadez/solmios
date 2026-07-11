<template>
  <div>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Folios In-House</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-xs text-text-muted mt-0.5">Cuentas abiertas de huéspedes con check-in activo — cargos, pagos y facturación</p>
      </div>
      <div class="flex gap-2">
        <button @click="load" :disabled="loading" class="flex items-center gap-1.5 px-4 py-2 border border-border rounded-full text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_REFRESH"></span>
          {{ loading ? 'Cargando...' : 'Refrescar' }}
        </button>
        <button @click="postAllRoomCharges" :disabled="posting"
          class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
          <span class="w-4 h-4 shrink-0" v-html="ICON_BUILDING"></span>
          {{ posting ? 'Posteando...' : 'Postear cargos habitación (todos)' }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_BUILDING"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy">{{ Math.round(foliosCountAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Folios abiertos</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-teal truncate">{{ formatMoney(totalChargesAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total cargos</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_CARD"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-cyan truncate">{{ formatMoney(totalPaymentsAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total pagos</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="totalBalance > 0 ? 'bg-coral/10' : 'bg-teal/10'">
            <span class="w-5 h-5" :class="totalBalance > 0 ? 'text-coral' : 'text-teal'" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums truncate" :class="totalBalance > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(totalBalanceAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Balance pendiente</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista -->
    <div v-if="loading && folios.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center text-sm text-text-muted">Cargando folios...</div>
    <div v-else-if="folios.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center">
      <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
      <h3 class="font-bold text-navy mb-1">Sin folios abiertos</h3>
      <p class="text-xs text-text-muted">Los folios se abren automáticamente al hacer check-in de una reserva.</p>
    </div>
    <div v-else class="space-y-3">
      <div v-for="f in folios" :key="f.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <!-- Header -->
        <div class="px-5 py-4 flex items-center justify-between hover:bg-surface/30 transition-colors cursor-pointer" @click="toggleFolio(f.id)">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-full bg-cyan/10 flex items-center justify-center text-cyan font-black shrink-0">
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
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide">Balance</div>
              <div class="text-sm font-black" :class="(f.balance || 0) > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(f.balance || 0) }}</div>
            </div>
            <span class="w-4 h-4 text-text-muted shrink-0 transition-transform" :class="expanded.has(f.id) ? 'rotate-180' : ''" v-html="ICON_CHEVRON_DOWN"></span>
          </div>
        </div>

        <!-- Detalle expandido -->
        <div v-if="expanded.has(f.id)" class="border-t border-border px-5 py-5">
          <!-- Cargos -->
          <div class="pb-5 border-b border-border">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-[10px] font-bold text-text-muted uppercase tracking-wide">Cargos y pagos</h4>
              <button @click.stop="openChargeModal(f)" class="text-[11px] font-bold text-teal hover:text-navy transition-colors cursor-pointer">+ Agregar cargo</button>
            </div>
            <div v-if="!f.charges || f.charges.length === 0" class="text-xs text-text-muted py-2">Sin movimientos. Postea los cargos de habitación con el botón superior.</div>
            <div v-else class="divide-y divide-border">
              <div v-for="c in f.charges" :key="c.id" class="py-2.5 flex items-center justify-between text-xs">
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
          <div class="grid grid-cols-3 gap-3 py-5 border-b border-border">
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Cargos</div>
              <div class="text-sm font-bold text-navy mt-0.5">{{ formatMoney(f.chargesTotal || 0) }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Pagos</div>
              <div class="text-sm font-bold text-teal mt-0.5">{{ formatMoney(f.paymentsTotal || 0) }}</div>
            </div>
            <div>
              <div class="text-[10px] text-text-muted uppercase tracking-wide">Balance</div>
              <div class="text-sm font-bold mt-0.5" :class="(f.balance || 0) > 0 ? 'text-coral' : 'text-teal'">{{ formatMoney(f.balance || 0) }}</div>
            </div>
          </div>

          <!-- Acciones -->
          <div class="pt-4 flex items-center justify-end gap-4">
            <button @click.stop="openPayModal(f)" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">
              Registrar pago
            </button>
            <button @click.stop="closeAndInvoice(f)" :disabled="closing === f.id"
              class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
              {{ closing === f.id ? 'Cerrando...' : 'Cerrar y facturar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Agregar cargo -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="chargeModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="chargeModal.show=false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Cargo a Folio</h3>
              <button @click="chargeModal.show=false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div class="flex items-center gap-2 pb-4 border-b border-border">
                <span class="text-sm font-bold text-navy">{{ chargeModal.folio?.guestName }}</span>
                <span class="text-text-muted">·</span>
                <span class="text-sm text-text-secondary">Hab. {{ chargeModal.folio?.roomNumber }}</span>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Categoría</label>
                <select v-model="chargeForm.category" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
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
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Descripción</label>
                <input v-model="chargeForm.description" type="text" placeholder="Ej: Cena - menú del día" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Monto unitario</label>
                  <input v-model.number="chargeForm.amount" type="number" min="0" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Cantidad</label>
                  <input v-model.number="chargeForm.quantity" type="number" min="1" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
                </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="chargeModal.show=false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="saveCharge" :disabled="savingCharge" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
                  {{ savingCharge ? 'Guardando...' : 'Agregar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal Registrar pago -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="payModal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="payModal.show=false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Registrar Pago</h3>
              <button @click="payModal.show=false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div class="flex items-center gap-2 pb-4 border-b border-border">
                <span class="text-sm font-bold text-navy">{{ payModal.folio?.guestName }}</span>
                <span class="text-text-muted">·</span>
                <span class="text-sm text-text-secondary">Hab. {{ payModal.folio?.roomNumber }}</span>
                <span class="text-text-muted">·</span>
                <span class="text-sm font-bold" :class="(payModal.folio?.balance || 0) > 0 ? 'text-coral' : 'text-teal'">Balance: {{ formatMoney(payModal.folio?.balance || 0) }}</span>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Método</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="method in paymentMethods"
                    :key="method.value"
                    type="button"
                    @click="payForm.method = method.value"
                    class="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold border transition-all cursor-pointer"
                    :class="payForm.method === method.value ? 'border-navy bg-navy text-white' : 'border-border text-text-secondary hover:border-navy/30'"
                  >
                    <span class="w-3.5 h-3.5 shrink-0" v-html="method.icon"></span>
                    {{ method.label }}
                  </button>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Monto</label>
                <div class="flex gap-2">
                  <input v-model.number="payForm.amount" type="number" min="0" step="0.01" :placeholder="String(payModal.folio?.balance || 0)" class="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
                  <button @click="payForm.amount = payModal.folio?.balance || 0" type="button" class="px-3.5 py-2 rounded-full border border-border text-text-secondary text-xs font-bold hover:border-navy/30 transition-colors cursor-pointer">Total</button>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Referencia (opcional)</label>
                <input v-model="payForm.reference" type="text" placeholder="Ej: TXN-12345" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="payModal.show=false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="savePayment" :disabled="savingPay" class="rounded-full bg-teal text-white text-sm font-extrabold px-5 py-2.5 hover:bg-teal-light transition-colors cursor-pointer disabled:opacity-50">
                  {{ savingPay ? 'Guardando...' : 'Registrar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
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
import { useCountUp } from '@/composables/useCountUp'

const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>'
const ICON_REFRESH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
const ICON_CHEVRON_DOWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
const ICON_CASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>'
const ICON_BANK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>'
const ICON_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'

const paymentMethods = [
  { value: 'cash', label: 'Efectivo', icon: ICON_CASH },
  { value: 'card', label: 'Tarjeta', icon: ICON_CARD },
  { value: 'transfer', label: 'Transferencia', icon: ICON_BANK },
  { value: 'link', label: 'Link de pago', icon: ICON_LINK },
]

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const folios = ref<Folio[]>([])
const loading = ref(false)
const posting = ref(false)
const closing = ref<string | null>(null)
const expanded = ref<Set<string>>(new Set())

const foliosCount = computed(() => folios.value.length)
const totalCharges = computed(() => folios.value.reduce((s, f) => s + (f.chargesTotal || 0), 0))
const totalPayments = computed(() => folios.value.reduce((s, f) => s + (f.paymentsTotal || 0), 0))
const totalBalance = computed(() => folios.value.reduce((s, f) => s + (f.balance || 0), 0))

const foliosCountAnim = useCountUp(foliosCount)
const totalChargesAnim = useCountUp(totalCharges)
const totalPaymentsAnim = useCountUp(totalPayments)
const totalBalanceAnim = useCountUp(totalBalance)

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

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-active .modal-panel, .modal-fade-leave-active .modal-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}
.modal-fade-enter-from .modal-panel, .modal-fade-leave-to .modal-panel {
  opacity: 0; transform: scale(0.95) translateY(12px);
}
</style>
