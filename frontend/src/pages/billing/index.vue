<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Facturación</h2>
        <p class="text-sm text-text-muted mt-0.5">Pagos, facturación electrónica LATAM y folios</p>
      </div>
      <div class="flex gap-2">
        <button class="px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Exportar</button>
        <button @click="openNewPayment" class="bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">+ Nuevo Pago</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-navy">${{ totalMonth.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Ingresos del Mes</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-teal">${{ totalToday.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Cobrado Hoy</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-gold">${{ totalPending.toLocaleString() }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Pendiente</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-black text-cyan">{{ invoices.length }}</div>
        <div class="text-[10px] text-text-muted font-bold uppercase">Facturas Emitidas</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="activeTab = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
      <span class="ml-3 text-sm text-text-muted font-bold">Cargando datos...</span>
    </div>

    <!-- Invoices Tab -->
    <div v-if="activeTab === 'invoices' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-navy text-sm">Facturas</h3>
          <div class="flex gap-2">
            <select v-model="invoiceFilter" class="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold focus:outline-none focus:border-navy cursor-pointer">
              <option value="all">Todas</option>
              <option value="paid">Pagadas</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidas</option>
            </select>
          </div>
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Factura</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Hab</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Concepto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Total</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="inv in filteredInvoices"
            :key="inv.id"
            @click="openViewInvoice(inv)"
            class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors cursor-pointer"
          >
            <td class="p-4 text-sm font-bold text-navy">#{{ inv.number }}</td>
            <td class="p-4 text-sm font-bold">{{ inv.guest }}</td>
            <td class="p-4 text-sm">{{ inv.room }}</td>
            <td class="p-4 text-sm text-text-secondary">{{ inv.concept }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="invoiceStatusClass(inv.status)">
                {{ invoiceStatusLabel(inv.status) }}
              </span>
            </td>
            <td class="p-4 text-sm text-text-secondary">{{ inv.date }}</td>
            <td class="p-4 text-right text-sm font-extrabold text-navy">${{ inv.total.toLocaleString() }}</td>
            <td class="p-4 text-right">
              <div class="flex gap-1 justify-end">
                <button @click.stop="openViewInvoice(inv)" class="px-2 py-1 bg-cyan/10 text-cyan rounded-lg text-[10px] font-bold hover:bg-cyan/20 transition-colors cursor-pointer">Ver</button>
                <button v-if="inv.status === 'pending'" @click.stop="openRecordPayment(inv)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 transition-colors cursor-pointer">Cobrar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredInvoices.length === 0" class="p-8 text-center">
        <div class="text-3xl mb-2">📄</div>
        <p class="text-sm text-text-muted font-bold">No hay facturas {{ invoiceFilter !== 'all' ? 'con este filtro' : 'registradas' }}</p>
      </div>
    </div>

    <!-- Payments Tab -->
    <div v-if="activeTab === 'payments' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border">
        <h3 class="font-extrabold text-navy text-sm">Pagos Recientes</h3>
      </div>
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Huésped</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Concepto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Método</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Estado</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in payments" :key="payment.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
            <td class="p-4 text-sm font-bold text-navy">{{ payment.guest }}</td>
            <td class="p-4 text-sm">{{ payment.concept }}</td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="methodClass(payment.method)">
                {{ payment.method }}
              </span>
            </td>
            <td class="p-4">
              <span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="payment.status === 'paid' ? 'bg-teal/10 text-teal' : 'bg-gold/10 text-gold'">
                {{ payment.status === 'paid' ? 'Pagado' : 'Pendiente' }}
              </span>
            </td>
            <td class="p-4 text-sm text-text-secondary">{{ payment.date }}</td>
            <td class="p-4 text-right text-sm font-extrabold text-navy">${{ payment.amount }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="payments.length === 0" class="p-8 text-center">
        <div class="text-3xl mb-2">💳</div>
        <p class="text-sm text-text-muted font-bold">No hay pagos registrados</p>
      </div>
    </div>

    <!-- Folios Tab -->
    <div v-if="activeTab === 'folios' && !loading" class="card overflow-hidden">
      <div class="p-4 border-b border-border">
        <h3 class="font-extrabold text-navy text-sm">Folios de Habitación</h3>
        <p class="text-[10px] text-text-muted mt-0.5">Cargos pendientes por habitación</p>
      </div>
      <div class="p-4 space-y-3">
        <div v-if="folios.length === 0" class="p-8 text-center text-text-muted text-sm">No hay folios</div>
        <div v-for="folio in folios" :key="folio.id" class="bg-surface rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center text-sm font-bold text-navy">
                {{ folio.roomNumber || '—' }}
              </div>
              <div>
                <div class="text-sm font-bold text-navy">{{ folio.guestName || 'Huésped' }}</div>
                <div class="text-[10px] text-text-muted">
                  Folio · {{ folio.status === 'open' ? 'Abierto' : 'Cerrado' }}
                  <span v-if="folio.chargeCount"> · {{ folio.chargeCount }} cargo(s)</span>
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-lg font-black text-navy">${{ (folio.chargesTotal || 0).toLocaleString() }}</div>
              <div class="text-[10px] font-bold" :class="(folio.balance || 0) > 0 ? 'text-orange' : 'text-teal'">
                Saldo: ${{ (folio.balance || 0).toLocaleString() }}
              </div>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-border flex justify-end gap-2">
            <button v-if="folio.status === 'open'" @click="openAddCharge(folio)" class="px-3 py-1.5 bg-navy/10 text-navy rounded-lg text-[10px] font-bold hover:bg-navy/20 transition-colors cursor-pointer">+ Cargo</button>
            <button v-if="folio.status === 'open'" @click="openRecordPaymentForFolio(folio)" class="px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-bold hover:bg-teal-light transition-colors cursor-pointer">Registrar Pago</button>
            <button v-if="folio.status === 'open'" @click="closeAndInvoice(folio)" class="px-3 py-1.5 bg-cyan text-navy rounded-lg text-[10px] font-bold hover:shadow-lg transition-colors cursor-pointer">Cerrar y Facturar</button>
            <span v-if="folio.status === 'closed' && folio.invoiceId" class="text-[10px] text-teal font-bold self-center">✓ Facturado</span>
          </div>
        </div>
      </div>
    </div>

    <!-- View Invoice Modal -->
    <Teleport to="body">
      <div v-if="showViewModal && viewInvoice" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeViewModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeViewModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <!-- Header -->
          <div class="p-5 border-b border-border">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-black text-navy">Factura #{{ viewInvoice.number }}</h3>
                <p class="text-sm text-text-secondary">{{ viewInvoice.date }}</p>
              </div>
              <button @click="closeViewModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">✕</button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">
            <!-- Status -->
            <div class="flex items-center justify-between p-4 bg-surface rounded-xl">
              <span class="text-sm text-text-secondary">Estado</span>
              <span class="text-[10px] font-bold px-3 py-1 rounded-full" :class="invoiceStatusClass(viewInvoice.status)">
                {{ invoiceStatusLabel(viewInvoice.status) }}
              </span>
            </div>

            <!-- Guest & Room -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-surface rounded-xl p-4">
                <div class="text-[10px] text-text-muted uppercase mb-1">Huésped</div>
                <div class="text-sm font-bold text-navy">{{ viewInvoice.guest }}</div>
              </div>
              <div class="bg-surface rounded-xl p-4">
                <div class="text-[10px] text-text-muted uppercase mb-1">Habitación</div>
                <div class="text-sm font-bold text-navy">{{ viewInvoice.room }}</div>
              </div>
            </div>

            <!-- Items -->
            <div>
              <div class="text-[10px] font-bold text-navy uppercase tracking-wide mb-2">Detalle</div>
              <div class="space-y-2">
                <div v-for="item in viewInvoice.items" :key="item.description" class="flex items-center justify-between p-3 bg-surface rounded-xl">
                  <span class="text-sm text-text-secondary">{{ item.description }}</span>
                  <span class="text-sm font-bold text-navy">${{ item.amount }}</span>
                </div>
              </div>
            </div>

            <!-- Totals -->
            <div class="bg-navy/5 rounded-xl p-4 space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Subtotal</span>
                <span class="font-bold">${{ viewInvoice.subtotal.toLocaleString() }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Impuestos ({{ viewInvoice.taxRate }}%)</span>
                <span class="font-bold">${{ viewInvoice.tax.toLocaleString() }}</span>
              </div>
              <div class="border-t border-border pt-2 mt-2">
                <div class="flex justify-between">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy text-xl">${{ viewInvoice.total.toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <!-- Electronic Invoice -->
            <div v-if="viewInvoice.eInvoice" class="bg-teal/5 border border-teal/20 rounded-xl p-4">
              <div class="flex items-center gap-2">
                <span class="text-lg">✅</span>
                <div>
                  <div class="text-sm font-bold text-teal">Factura Electrónica Enviada</div>
                  <div class="text-[10px] text-text-muted">{{ viewInvoice.eInvoice }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="p-5 border-t border-border bg-surface/50">
            <div class="flex gap-2">
              <button v-if="viewInvoice.status === 'pending'" @click="closeViewModal(); openRecordPayment(viewInvoice)" class="flex-1 px-4 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-light transition-colors cursor-pointer">
                Registrar Pago
              </button>
              <button @click="closeViewModal" class="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- New Payment Modal -->
    <Teleport to="body">
      <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closePaymentModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closePaymentModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Registrar Pago</h3>
              <button @click="closePaymentModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">✕</button>
            </div>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Huésped</label>
              <input :value="paymentForm.guest" type="text" disabled class="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-surface" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Monto ($)</label>
              <input v-model.number="paymentForm.amount" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Método de Pago</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="method in paymentMethods"
                  :key="method.value"
                  @click="paymentForm.method = method.value"
                  class="p-3 rounded-xl border-2 text-center transition-all cursor-pointer"
                  :class="paymentForm.method === method.value ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/30'"
                >
                  <span class="text-xl block mb-1">{{ method.icon }}</span>
                  <span class="text-[10px] font-bold" :class="paymentForm.method === method.value ? 'text-navy' : 'text-text-secondary'">{{ method.label }}</span>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Referencia</label>
              <input v-model="paymentForm.reference" type="text" placeholder="N° transacción, comprobante, etc." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
              <textarea v-model="paymentForm.notes" rows="2" placeholder="Opcional..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
            </div>
          </div>

          <div class="p-5 border-t border-border bg-surface/50">
            <div class="flex gap-3 justify-end">
              <button @click="closePaymentModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
              <button @click="savePayment" class="px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-light transition-colors cursor-pointer">Confirmar Pago</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Add Charge Modal -->
    <Teleport to="body">
      <div v-if="showChargeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeChargeModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeChargeModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div class="p-5 border-b border-border">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Agregar Cargo — Hab {{ chargeRoom }}</h3>
              <button @click="closeChargeModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">✕</button>
            </div>
          </div>

          <div class="p-5 space-y-4">
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Concepto</label>
              <select v-model="chargeForm.description" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                <option value="">Seleccionar...</option>
                <option value="Minibar">Minibar</option>
                <option value="Servicio de habitación">Servicio de habitación</option>
                <option value="Lavandería">Lavandería</option>
                <option value="Spa">Spa</option>
                <option value="Restaurante">Restaurante</option>
                <option value="Telefonía">Telefonía</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Monto ($)</label>
              <input v-model.number="chargeForm.amount" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
              <textarea v-model="chargeForm.notes" rows="2" placeholder="Detalle del cargo..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
            </div>
          </div>

          <div class="p-5 border-t border-border bg-surface/50">
            <div class="flex gap-3 justify-end">
              <button @click="closeChargeModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
              <button @click="saveCharge" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer">Agregar</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { BillingService } from '@/services/Billing.service'
import { FoliosService, type Folio } from '@/services/Folios.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeTab = ref('invoices')
const invoiceFilter = ref('all')
const showViewModal = ref(false)
const showPaymentModal = ref(false)
const showChargeModal = ref(false)
const viewInvoice = ref<any>(null)
const chargeRoom = ref('')

const tabs = [
  { value: 'invoices', label: '📄 Facturas' },
  { value: 'payments', label: '💳 Pagos' },
  { value: 'folios', label: '🏨 Folios' },
]

const paymentMethods = [
  { value: 'card', label: 'Tarjeta', icon: '💳' },
  { value: 'cash', label: 'Efectivo', icon: '💵' },
  { value: 'transfer', label: 'Transferencia', icon: '🏦' },
  { value: 'link', label: 'Link de pago', icon: '🔗' },
]

const paymentForm = ref({ guest: '', amount: 0, method: 'card', reference: '', notes: '' })
const chargeForm = ref({ description: '', amount: 0, notes: '' })

const invoices = ref<any[]>([])
const payments = ref<any[]>([])
const folios = ref<Folio[]>([])
const loading = ref(true)
const paymentTargetId = ref<string | null>(null)
const paymentTargetKind = ref<'invoice' | 'folio'>('invoice')
const chargeFolioId = ref<string | null>(null)

const conceptFor = (inv: any) => {
  if (Array.isArray(inv.items) && inv.items.length && inv.items[0]?.description) return inv.items[0].description
  return ({ invoice: 'Factura', payment: 'Pago', folio: 'Cargo / Folio' } as Record<string, string>)[inv.type] || inv.type
}

async function loadData() {
  loading.value = true
  try {
    const { invoices: data } = await BillingService.list(hotelId.value)
    const view = data.map(d => ({
      id: d.id,
      number: d.number,
      guest: d.guest || '',
      room: d.room || '',
      concept: conceptFor(d),
      status: d.status,
      type: d.type,
      date: d.issueDate || '',
      dueDate: d.dueDate || '',
      subtotal: d.subtotal,
      taxRate: d.taxRate,
      tax: d.tax,
      total: d.total,
      ncf: d.ncf,
      eInvoice: d.ncf ? `NCF: ${d.ncf}` : null,
      items: (Array.isArray(d.items) && d.items.length) ? d.items : [{ description: conceptFor(d), amount: d.total }],
      method: d.paymentMethod || '',
      notes: d.notes || '',
    }))
    invoices.value = view.filter(i => i.type === 'invoice')
    payments.value = view.filter(i => i.type === 'payment').map(p => ({
      id: p.id, guest: p.guest, concept: p.concept, method: p.method || '—',
      status: p.status, date: p.date, amount: p.total,
    }))
    await loadFolios()
  } catch { toast.error("Error al cargar datos") }
  finally { loading.value = false }
}

async function loadFolios() {
  try {
    folios.value = await FoliosService.list(hotelId.value)
  } catch { folios.value = [] }
}
onMounted(loadData)

const filteredInvoices = computed(() => {
  if (invoiceFilter.value === 'all') return invoices.value
  return invoices.value.filter(i => i.status === invoiceFilter.value)
})

const totalMonth = computed(() => invoices.value.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0))
const todayStr = new Date().toISOString().split('T')[0]
const totalToday = computed(() => payments.value.filter(p => p.status === 'paid' && String(p.date).slice(0, 10) === todayStr).reduce((sum, p) => sum + p.amount, 0))
const totalPending = computed(() => invoices.value.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0))

function methodClass(method: string) {
  const m = String(method).toLowerCase()
  const classes: Record<string, string> = {
    'tarjeta': 'bg-blue-100 text-blue-700', 'card': 'bg-blue-100 text-blue-700',
    'transferencia': 'bg-teal/10 text-teal', 'transfer': 'bg-teal/10 text-teal',
    'efectivo': 'bg-gold/10 text-gold', 'cash': 'bg-gold/10 text-gold',
    'link de pago': 'bg-purple/10 text-purple', 'link': 'bg-purple/10 text-purple',
  }
  return classes[m] ?? 'bg-gray-100 text-gray-500'
}

function invoiceStatusClass(status: string) {
  const classes: Record<string, string> = { paid: 'bg-teal/10 text-teal', pending: 'bg-gold/10 text-gold', overdue: 'bg-coral/10 text-coral' }
  return classes[status] ?? ''
}

function invoiceStatusLabel(status: string) {
  const labels: Record<string, string> = { paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida' }
  return labels[status] ?? status
}

function openViewInvoice(inv: any) {
  viewInvoice.value = { ...inv }
  showViewModal.value = true
}

function closeViewModal() {
  showViewModal.value = false
  viewInvoice.value = null
}

function openNewPayment() {
  paymentTargetId.value = null
  paymentForm.value = { guest: '', amount: 0, method: 'card', reference: '', notes: '' }
  showPaymentModal.value = true
}

function openRecordPayment(inv: any) {
  paymentTargetKind.value = 'invoice'
  paymentTargetId.value = inv.id
  paymentForm.value = { guest: inv.guest, amount: inv.total, method: 'card', reference: '', notes: '' }
  showPaymentModal.value = true
}

function openRecordPaymentForFolio(folio: any) {
  paymentTargetKind.value = 'folio'
  paymentTargetId.value = folio.id ?? null
  paymentForm.value = { guest: folio.guestName || 'Huésped', amount: Math.max(0, folio.balance || 0), method: 'card', reference: '', notes: '' }
  showPaymentModal.value = true
}

function closePaymentModal() {
  showPaymentModal.value = false
}

async function savePayment() {
  if (!paymentForm.value.guest || paymentForm.value.amount <= 0) { toast.warning('Datos incompletos'); return }
  const method = paymentMethods.find(m => m.value === paymentForm.value.method)?.label ?? 'Other'
  try {
    if (paymentTargetKind.value === 'folio' && paymentTargetId.value) {
      // Pago aplicado al folio (reduce el saldo acumulado).
      await FoliosService.pay(paymentTargetId.value, {
        amount: paymentForm.value.amount, method, reference: paymentForm.value.reference,
      })
    } else if (paymentTargetId.value) {
      // Pago aplicado a la factura: el backend la marca como pagada y registra el pago.
      await BillingService.pay(paymentTargetId.value, {
        method, amount: paymentForm.value.amount,
        reference: paymentForm.value.reference, notes: paymentForm.value.notes || undefined,
      })
    } else {
      await BillingService.create({
        hotelId: hotelId.value,
        amount: paymentForm.value.amount,
        type: 'payment',
        status: 'paid',
        paymentMethod: method,
        notes: `Guest: ${paymentForm.value.guest}${paymentForm.value.reference ? ` | Ref: ${paymentForm.value.reference}` : ''}`,
      })
    }
    closePaymentModal()
    closeViewModal()
    loadData()
  } catch { toast.error('Error al guardar el pago') }
}

function openAddCharge(folio: Folio) {
  chargeFolioId.value = folio.id
  chargeRoom.value = folio.roomNumber || '—'
  chargeForm.value = { description: '', amount: 0, notes: '' }
  showChargeModal.value = true
}

function closeChargeModal() {
  showChargeModal.value = false
}

async function saveCharge() {
  if (!chargeFolioId.value || !chargeForm.value.description || chargeForm.value.amount <= 0) { toast.warning('Datos incompletos'); return }
  try {
    await FoliosService.charge(chargeFolioId.value, {
      description: `${chargeForm.value.description}${chargeForm.value.notes ? ` — ${chargeForm.value.notes}` : ''}`,
      amount: chargeForm.value.amount,
    })
    closeChargeModal()
    loadData()
  } catch { toast.error('Error al guardar cargo') }
}

async function closeAndInvoice(folio: Folio) {
  if (!confirm(`¿Cerrar el folio de ${folio.guestName || 'huésped'} y generar factura por $${(folio.chargesTotal || 0).toLocaleString()}?`)) return
  try {
    const res = await FoliosService.closeAndInvoice(folio.id)
    const num = res?.invoice?.invoiceNumber || res?.invoice?.number || ''
    toast.success(`Folio cerrado — factura ${num || 'generada'}`)
    loadData()
  } catch { toast.error('Error al cerrar el folio') }
}
</script>
