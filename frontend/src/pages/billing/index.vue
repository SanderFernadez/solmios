<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-black text-navy">Facturación</h2>
        <p class="text-sm text-text-muted mt-0.5">Pagos, facturación electrónica LATAM y folios</p>
      </div>
      <div class="flex gap-2">
        <button @click="exportCsv" class="flex items-center gap-1.5 px-4 py-2 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_DOWNLOAD"></span>
          Exportar CSV
        </button>
        <button @click="openNewInvoice" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-xl hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
          Nueva Factura
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">${{ totalMonth.toLocaleString() }}</div>
            <div v-if="formatSecondary(totalMonth)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalMonth) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Ingresos del Mes</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_CHECK_PLAIN"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal truncate">${{ totalToday.toLocaleString() }}</div>
            <div v-if="formatSecondary(totalToday)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalToday) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Cobrado Hoy</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-gold truncate">${{ totalPending.toLocaleString() }}</div>
            <div v-if="formatSecondary(totalPending)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalPending) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Pendiente</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-cyan">{{ invoices.length }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">Facturas Emitidas</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        @click="activeTab = tab.value"
        class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
      >
        <span class="w-4 h-4 shrink-0" v-html="tab.icon"></span>
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
                <button @click.stop="openDeleteModal(inv)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 transition-colors cursor-pointer">Eliminar</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="filteredInvoices.length === 0" class="p-8 text-center">
        <span class="w-9 h-9 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_DOCUMENT"></span>
        <p class="text-sm text-text-muted font-bold">No hay facturas {{ invoiceFilter !== 'all' ? 'con este filtro' : 'registradas' }}</p>
      </div>
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between p-4 border-t border-border">
        <div class="text-[10px] text-text-muted font-bold">{{ totalItems }} factura(s)</div>
        <div class="flex items-center gap-1">
          <button @click="page = 1; loadData()" :disabled="page <= 1" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">«</button>
          <button @click="page--; loadData()" :disabled="page <= 1" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">‹</button>
          <span class="px-2 text-xs font-bold text-navy">{{ page }} / {{ totalPages }}</span>
          <button @click="page++; loadData()" :disabled="page >= totalPages" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">›</button>
          <button @click="page = totalPages; loadData()" :disabled="page >= totalPages" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">»</button>
        </div>
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
        <span class="w-9 h-9 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_CARD"></span>
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
      <div v-if="showViewModal && viewInvoice" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.stop>
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click.stop></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" @click.stop>
          <!-- Header -->
          <div class="sticky top-0 bg-white z-10 p-5 border-b border-border rounded-t-2xl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-lg font-black text-navy">{{ typeLabel(viewInvoice.type) }} #{{ viewInvoice.number }}</h3>
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="invoiceStatusClass(viewInvoice.status)">
                      {{ invoiceStatusLabel(viewInvoice.status) }}
                    </span>
                  </div>
                  <p class="text-xs text-text-muted mt-0.5">Emitida: {{ viewInvoice.date }} {{ viewInvoice.dueDate ? `· Vence: ${viewInvoice.dueDate}` : '' }}</p>
                </div>
              </div>
              <button @click="closeViewModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-4">
            <!-- NCF -->
            <div v-if="viewInvoice.ncf" class="bg-gold/10 border border-gold/20 rounded-xl p-3 flex items-center justify-between">
              <span class="text-[10px] font-bold text-gold uppercase">NCF</span>
              <span class="text-sm font-extrabold text-navy">{{ viewInvoice.ncf }}</span>
            </div>

            <!-- Guest & Room -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-surface rounded-xl p-3">
                <div class="text-[10px] text-text-muted uppercase mb-1">Huésped</div>
                <div class="text-sm font-bold text-navy">{{ viewInvoice.guest || '—' }}</div>
              </div>
              <div class="bg-surface rounded-xl p-3">
                <div class="text-[10px] text-text-muted uppercase mb-1">Habitación</div>
                <div class="text-sm font-bold text-navy">{{ viewInvoice.room || '—' }}</div>
              </div>
              <div class="bg-surface rounded-xl p-3">
                <div class="text-[10px] text-text-muted uppercase mb-1">Moneda</div>
                <div class="text-sm font-bold text-navy">{{ currencySymbol(viewInvoice.currency) }} {{ viewInvoice.currency }}</div>
              </div>
            </div>

            <!-- Items -->
            <div>
              <div class="text-[10px] font-bold text-navy uppercase tracking-wide mb-2">Conceptos Facturados</div>
              <div class="border border-border rounded-xl overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr class="bg-navy/5 border-b border-border">
                      <th class="text-left p-2.5 text-[10px] font-bold text-text-muted uppercase">#</th>
                      <th class="text-left p-2.5 text-[10px] font-bold text-text-muted uppercase">Descripción</th>
                      <th class="text-right p-2.5 text-[10px] font-bold text-text-muted uppercase">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in viewInvoice.items" :key="idx" class="border-b border-border last:border-0">
                      <td class="p-2.5 text-[11px] text-text-muted">{{ Number(idx) + 1 }}</td>
                      <td class="p-2.5 text-sm font-bold text-navy">{{ item.description }}</td>
                      <td class="p-2.5 text-sm font-bold text-navy text-right">{{ currencySymbol(viewInvoice.currency) }}{{ Number(item.amount).toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Financial Summary -->
            <div class="bg-navy/5 rounded-xl p-4 space-y-2.5">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Subtotal</span>
                <span class="font-bold">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.subtotal.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Impuestos ({{ viewInvoice.taxRate }}%)</span>
                <span class="font-bold">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.tax.toFixed(2) }}</span>
              </div>
              <div class="border-t border-border pt-2.5">
                <div class="flex justify-between">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy text-xl">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.total.toFixed(2) }}</span>
                </div>
              </div>
              <div v-if="viewInvoice.amountPaid > 0" class="border-t border-border pt-2.5 space-y-1.5">
                <div class="flex justify-between text-sm text-teal">
                  <span class="font-bold">Pagado</span>
                  <span class="font-bold">-{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.amountPaid.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="font-extrabold text-gold">Saldo Pendiente</span>
                  <span class="font-extrabold text-gold">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.balance.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Payment Method -->
            <div v-if="viewInvoice.method" class="flex items-center gap-3 p-3 bg-surface rounded-xl">
              <span class="w-5 h-5 text-navy shrink-0" v-html="paymentMethodIcon(viewInvoice.method)"></span>
              <div>
                <div class="text-[10px] text-text-muted uppercase">Método de Pago</div>
                <div class="text-sm font-bold text-navy">{{ paymentMethodLabel(viewInvoice.method) }}</div>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="viewInvoice.notes" class="bg-surface rounded-xl p-3">
              <div class="text-[10px] text-text-muted uppercase mb-1">Notas</div>
              <div class="text-sm text-text-secondary whitespace-pre-wrap">{{ viewInvoice.notes }}</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="sticky bottom-0 bg-white border-t border-border p-6 rounded-b-2xl">
            <div class="flex gap-2">
              <button @click="printInvoice" class="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_PRINTER"></span>
                Imprimir
              </button>
              <button @click="emailInvoice" class="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_ENVELOPE"></span>
                Enviar email
              </button>
              <button @click="downloadPdf" class="flex items-center gap-1.5 px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_DOCUMENT"></span>
                PDF
              </button>
              <button v-if="viewInvoice.status === 'pending' || viewInvoice.balance > 0" @click="closeViewModal(); openRecordPayment(viewInvoice)" class="flex-1 px-4 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-light transition-colors cursor-pointer">
                Registrar Pago
              </button>
              <button @click="closeViewModal" class="px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">
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
              <button @click="closePaymentModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
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
                  class="p-3 rounded-xl border text-center transition-all cursor-pointer"
                  :class="paymentForm.method === method.value ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/30'"
                >
                  <span class="w-5 h-5 mx-auto mb-1 block" :class="paymentForm.method === method.value ? 'text-navy' : 'text-text-secondary'" v-html="method.icon"></span>
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
              <button @click="savePayment" :disabled="savingPayment" class="px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-light transition-colors cursor-pointer disabled:opacity-50">{{ savingPayment ? 'Guardando...' : 'Confirmar Pago' }}</button>
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
              <button @click="closeChargeModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
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

    <!-- New Invoice Modal -->
    <Teleport to="body">
      <div v-if="showNewInvoiceModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeNewInvoiceModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeNewInvoiceModal"></div>

        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="sticky top-0 bg-white z-10 p-5 border-b border-border rounded-t-2xl">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Nueva Factura</h3>
              <button @click="closeNewInvoiceModal" class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-secondary hover:text-navy transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div class="p-6 space-y-4">
            <!-- Room Search -->
            <div>
              <label class="flex items-center gap-1.5 text-[11px] font-bold text-navy uppercase tracking-wide mb-2">
                <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_SEARCH"></span>
                Buscar Habitación
              </label>
              <div class="relative">
                <input v-model="newInvoice.roomSearch" @input="filterRooms" @focus="showRoomDropdown = true" @blur="closeRoomDropdown" type="text" placeholder="Escribí número de hab, nombre del huésped..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                <div v-if="showRoomDropdown && filteredRooms.length" class="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  <div v-for="room in filteredRooms" :key="room.id" @mousedown.prevent="selectRoom(room)" class="px-4 py-3 hover:bg-surface cursor-pointer border-b border-border last:border-0">
                    <div class="flex justify-between items-center">
                      <div>
                        <span class="text-sm font-bold text-navy">Hab {{ room.number }}</span>
                        <span class="text-[10px] text-text-muted ml-1.5 px-1.5 py-0.5 bg-surface rounded">{{ room.type }}</span>
                      </div>
                      <div class="text-right">
                        <div v-if="room.guestName" class="text-xs font-bold text-teal">{{ room.guestName }}</div>
                        <div v-else class="text-[10px] text-text-muted">Sin huésped</div>
                        <div class="text-[10px] text-text-muted">${{ room.basePrice }}/noche</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Guest (auto-filled) -->
            <div v-if="newInvoice.guestName" class="flex items-center gap-3 p-3 bg-teal/5 border border-teal/20 rounded-xl">
              <span class="w-5 h-5 text-teal shrink-0" v-html="ICON_USER"></span>
              <div>
                <div class="text-[10px] text-text-muted uppercase">Huésped</div>
                <div class="text-sm font-bold text-navy">{{ newInvoice.guestName }}</div>
              </div>
            </div>

            <!-- Line Items -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="text-[11px] font-bold text-navy uppercase tracking-wide">Conceptos</label>
                <button @click="addInvoiceItem" class="text-[10px] font-bold text-cyan hover:text-navy transition-colors cursor-pointer">+ Agregar</button>
              </div>
              <div class="space-y-2">
                <div v-for="(item, idx) in newInvoice.items" :key="idx" class="flex gap-2 items-start">
                  <select v-model="item.description" class="flex-1 px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                    <option value="">Concepto...</option>
                    <option value="Hospedaje">Hospedaje</option>
                    <option value="Minibar">Minibar</option>
                    <option value="Restaurante">Restaurante</option>
                    <option value="Spa">Spa</option>
                    <option value="Lavandería">Lavandería</option>
                    <option value="Servicio de habitación">Serv. habitación</option>
                    <option value="Telefonía">Telefonía</option>
                    <option value="Otros">Otros</option>
                  </select>
                  <input v-model.number="item.amount" type="number" min="0" step="0.01" placeholder="Monto" class="w-24 px-3 py-2 rounded-xl border border-border text-sm text-right focus:outline-none focus:border-navy" />
                  <button v-if="newInvoice.items.length > 1" @click="removeInvoiceItem(idx)" class="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center hover:bg-coral/20 transition-colors cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-[11px] font-bold text-navy uppercase tracking-wide mb-2">Notas</label>
              <textarea v-model="newInvoice.notes" rows="2" placeholder="Detalle adicional..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
            </div>

            <!-- Total Preview -->
            <div class="bg-navy/5 rounded-xl p-4">
              <div class="flex justify-between text-sm">
                <span class="text-text-secondary">Subtotal</span>
                <span class="font-bold">${{ invoiceSubtotal.toFixed(2) }}</span>
              </div>
              <div v-if="hotelTaxRate > 0" class="flex justify-between text-sm">
                <span class="text-text-secondary">Impuestos ({{ hotelTaxRate }}%)</span>
                <span class="font-bold">${{ invoiceTaxes.toFixed(2) }}</span>
              </div>
              <div class="border-t border-border pt-2 mt-2">
                <div class="flex justify-between">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy text-lg">${{ invoiceTotal.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="sticky bottom-0 bg-white border-t border-border p-6 rounded-b-2xl">
            <div class="flex gap-3 justify-end">
              <button @click="closeNewInvoiceModal" class="px-5 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
              <button @click="saveNewInvoice" :disabled="savingInvoice || invoiceTotal <= 0" class="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
                {{ savingInvoice ? 'Creando...' : 'Crear Factura' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal && deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeDeleteModal">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm" @click="closeDeleteModal"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div class="text-center mb-4">
            <div class="w-11 h-11 mx-auto mb-2 rounded-full bg-coral/10 flex items-center justify-center">
              <span class="w-5 h-5 text-coral" v-html="ICON_ALERT_TRIANGLE"></span>
            </div>
            <h3 class="text-lg font-black text-navy">Eliminar Factura</h3>
            <p class="text-sm text-text-secondary mt-2">¿Estás seguro de eliminar la factura <strong>#{{ deleteTarget.number }}</strong>?</p>
            <p class="text-xs text-text-muted mt-1">Esta acción no se puede deshacer.</p>
          </div>
          <div class="flex gap-3">
            <button @click="closeDeleteModal" class="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary hover:border-navy/30 transition-colors cursor-pointer">Cancelar</button>
            <button @click="confirmDelete" :disabled="deleting" class="flex-1 px-4 py-2.5 bg-coral text-white rounded-xl text-sm font-bold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">
              {{ deleting ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Invoice Print Frame (oculto) -->
    <iframe ref="printFrame" class="hidden" style="position:absolute;width:0;height:0;border:0;"></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { BillingService, type BillingStats } from '@/services/Billing.service'
import { RoomService } from '@/services/Room.service'
import { SettingsService } from '@/services/Settings.service'
import { useCurrency } from '@/composables/useCurrency'
import { FoliosService, type Folio } from '@/services/Folios.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const { formatSecondary, loadCurrencyConfig } = useCurrency()

const activeTab = ref('invoices')
const invoiceFilter = ref('all')
const showViewModal = ref(false)
const showPaymentModal = ref(false)
const showChargeModal = ref(false)
const viewInvoice = ref<any>(null)
const chargeRoom = ref('')

const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_BUILDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 12h.01M3 10h18"/></svg>'
const ICON_CHECK_PLAIN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3"/></svg>'
const ICON_PRINTER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0M6.34 18l-.229 2.523a1.125 1.125 0 0 0 1.12 1.227h9.539a1.125 1.125 0 0 0 1.12-1.227L17.66 18M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0c.646.049 1.288.11 1.913.247C19.232 7.441 20 8.375 20 9.456v6.294A2.25 2.25 0 0 1 17.75 18h-1.09M8.25 7.034V3.375c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Z"/></svg>'
const ICON_ENVELOPE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/></svg>'
const ICON_SEARCH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg>'
const ICON_ALERT_TRIANGLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z"/></svg>'
const ICON_CASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path stroke-linecap="round" d="M6 9v.01M18 15v.01"/></svg>'
const ICON_BANK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10 12 3l9 7M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M9 20v-6h6v6"/></svg>'
const ICON_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5 21 3M16.5 3H21v4.5M10.5 13.5 3 21M7.5 21H3v-4.5"/></svg>'

const tabs = [
  { value: 'invoices', label: 'Facturas', icon: ICON_DOCUMENT },
  { value: 'payments', label: 'Pagos', icon: ICON_CARD },
  { value: 'folios', label: 'Folios', icon: ICON_BUILDING },
]

const paymentMethods = [
  { value: 'card', label: 'Tarjeta', icon: ICON_CARD },
  { value: 'cash', label: 'Efectivo', icon: ICON_CASH },
  { value: 'transfer', label: 'Transferencia', icon: ICON_BANK },
  { value: 'link', label: 'Link de pago', icon: ICON_LINK },
]

const paymentForm = ref({ guest: '', amount: 0, method: 'card', reference: '', notes: '' })
const chargeForm = ref({ description: '', amount: 0, notes: '' })

const invoices = ref<any[]>([])
const payments = ref<any[]>([])
const folios = ref<Folio[]>([])
const stats = ref<BillingStats>({ total: 0, pendingAmount: 0, paid: 0, overdueAmount: 0, cancelled: 0, monthlyRevenue: 0, todayRevenue: 0, totalTax: 0 })
const loading = ref(true)
const page = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const showDeleteModal = ref(false)
const deleteTarget = ref<any>(null)
const deleting = ref(false)
const savingPayment = ref(false)
const paymentTargetId = ref<string | null>(null)
const paymentTargetKind = ref<'invoice' | 'folio'>('invoice')
const chargeFolioId = ref<string | null>(null)

// New Invoice state
const showNewInvoiceModal = ref(false)
const savingInvoice = ref(false)
const rooms = ref<any[]>([])
const hotelTaxRate = ref(0)
const newInvoice = ref({ roomSearch: '', roomId: '', guestId: '', guestName: '', items: [{ description: '', amount: 0 }], notes: '' })
const showRoomDropdown = ref(false)
const filteredRooms = ref<any[]>([])

const invoiceSubtotal = computed(() => newInvoice.value.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0))
const invoiceTaxes = computed(() => Math.round(invoiceSubtotal.value * hotelTaxRate.value / 100 * 100) / 100)
const invoiceTotal = computed(() => Math.round((invoiceSubtotal.value + invoiceTaxes.value) * 100) / 100)

const conceptFor = (inv: any) => {
  if (Array.isArray(inv.items) && inv.items.length && inv.items[0]?.description) return inv.items[0].description
  return ({ invoice: 'Factura', payment: 'Pago', folio: 'Cargo / Folio' } as Record<string, string>)[inv.type] || inv.type
}

async function loadData() {
  loading.value = true
  try {
    const [{ invoices: data, pages, hasNext, hasPrev, total }, statsData] = await Promise.all([
      BillingService.list(hotelId.value, undefined, page.value),
      BillingService.stats().catch(() => null),
    ])
    if (statsData) stats.value = statsData
    totalPages.value = pages
    totalItems.value = total
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
      amountPaid: d.amountPaid || 0,
      balance: d.balance ?? d.total,
      currency: d.currency || 'USD',
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
onMounted(async () => {
  await loadCurrencyConfig(hotelId.value)
  loadData()
})

const filteredInvoices = computed(() => {
  if (invoiceFilter.value === 'all') return invoices.value
  return invoices.value.filter(i => i.status === invoiceFilter.value)
})

const totalMonth = computed(() => stats.value.monthlyRevenue)
const totalToday = computed(() => stats.value.todayRevenue)
const totalPending = computed(() => stats.value.pendingAmount + stats.value.overdueAmount)

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
  const labels: Record<string, string> = { paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida', cancelled: 'Anulada', draft: 'Borrador' }
  return labels[status] ?? status
}

function typeLabel(type: string) {
  const labels: Record<string, string> = { invoice: 'Factura', payment: 'Pago', folio: 'Cargo', receipt: 'Recibo', credit_note: 'Nota de Crédito' }
  return labels[type] ?? type
}

function paymentMethodIcon(method: string) {
  const m = String(method).toLowerCase()
  const icons: Record<string, string> = { tarjeta: ICON_CARD, card: ICON_CARD, efectivo: ICON_CASH, cash: ICON_CASH, transferencia: ICON_BANK, transfer: ICON_BANK, link: ICON_LINK }
  return icons[m] ?? ICON_WALLET
}

function paymentMethodLabel(method: string) {
  const m = String(method).toLowerCase()
  const labels: Record<string, string> = { tarjeta: 'Tarjeta', card: 'Tarjeta', efectivo: 'Efectivo', cash: 'Efectivo', transferencia: 'Transferencia', transfer: 'Transferencia', link: 'Link de pago' }
  return labels[m] ?? method
}

function currencySymbol(currency: string) {
  const symbols: Record<string, string> = { USD: '$', DOP: 'RD$', EUR: '€', COP: '$', MXN: '$', ARS: '$', CLP: '$' }
  return symbols[currency] ?? currency
}

function openViewInvoice(inv: any) {
  viewInvoice.value = { ...inv }
  showViewModal.value = true
}

function closeViewModal() {
  showViewModal.value = false
  viewInvoice.value = null
}

const printFrame = ref<HTMLIFrameElement | null>(null)

async function printInvoice() {
  if (!viewInvoice.value) return
  try {
    const html = await BillingService.print(viewInvoice.value.id)
    if (typeof html === 'string' && html.includes('<!DOCTYPE html>') && printFrame.value) {
      const doc = printFrame.value.contentDocument
      if (doc) {
        doc.open()
        doc.write(html)
        doc.close()
        setTimeout(() => printFrame.value?.contentWindow?.print(), 300)
      }
    }
  } catch { toast.error('Error al generar impresión') }
}

async function emailInvoice() {
  if (!viewInvoice.value) return
  const to = window.prompt('Email del destinatario:', '')
  if (!to) return
  try {
    const res = await BillingService.emailInvoice(viewInvoice.value.id, to)
    if (!res.configured) { toast.warning('El hotel no tiene email configurado (SMTP/Resend). Configurarlo en Settings.'); return }
    toast.success(`Factura enviada a ${to}`)
  } catch { toast.error('Error al enviar la factura') }
}

async function downloadPdf() {
  if (!viewInvoice.value) return
  try {
    const blob = await BillingService.downloadPdf(viewInvoice.value.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${viewInvoice.value.number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch { toast.error('Error al generar el PDF') }
}

function openNewPayment() {
  paymentTargetId.value = null
  paymentForm.value = { guest: '', amount: 0, method: 'card', reference: '', notes: '' }
  showPaymentModal.value = true
}

async function openNewInvoice() {
  newInvoice.value = { roomSearch: '', roomId: '', guestId: '', guestName: '', items: [{ description: '', amount: 0 }], notes: '' }
  showNewInvoiceModal.value = true
  showRoomDropdown.value = false
  // Load rooms + tax rate in parallel
  const [roomsRes, configRes] = await Promise.all([
    RoomService.list().catch(() => null),
    SettingsService.full().catch(() => null),
  ])
  // Rooms — solo habitaciones con huésped (guestId o guestName)
  const roomList = roomsRes?.rooms || []
  rooms.value = (Array.isArray(roomList) ? roomList : [])
    .filter((r: any) => r.guestId || r.guestName)
    .map((r: any) => ({
      id: r.id, number: r.number, type: r.type, status: r.status,
      basePrice: r.basePrice, guestId: r.guestId || null,
      guestName: r.guestName || '', reservationId: r.reservationId || null,
    }))
  filteredRooms.value = rooms.value
  // Tax rate from config
  try {
    const taxes = configRes?.taxes || configRes?.impuestos || []
    const parsed = typeof taxes === 'string' ? JSON.parse(taxes) : taxes
    hotelTaxRate.value = parsed.filter((t: any) => t.activo ?? t.active).reduce((s: number, t: any) => s + Number(t.tasa ?? t.rate ?? 0), 0)
  } catch { hotelTaxRate.value = 0 }
}

function filterRooms() {
  const q = newInvoice.value.roomSearch.toLowerCase()
  filteredRooms.value = rooms.value.filter(r =>
    r.number.toLowerCase().includes(q) || r.guestName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
  )
}

function selectRoom(room: any) {
  newInvoice.value.roomId = room.id
  newInvoice.value.roomSearch = `Hab ${room.number} — ${room.guestName || 'Sin huésped'}`
  newInvoice.value.guestId = room.guestId || ''
  newInvoice.value.guestName = room.guestName || 'Cliente general'
  showRoomDropdown.value = false
}

function closeRoomDropdown() {
  setTimeout(() => { showRoomDropdown.value = false }, 200)
}

function addInvoiceItem() {
  newInvoice.value.items.push({ description: '', amount: 0 })
}

function removeInvoiceItem(idx: number) {
  newInvoice.value.items.splice(idx, 1)
}

function closeNewInvoiceModal() {
  showNewInvoiceModal.value = false
}

async function saveNewInvoice() {
  const validItems = newInvoice.value.items.filter(i => i.description && i.amount > 0)
  if (!validItems.length) { toast.warning('Agregá al menos un concepto con monto'); return }
  savingInvoice.value = true
  try {
    // Items estructurados → se persisten en invoice_items (desglose real en template/PDF).
    // notes queda como texto libre (huésped/hab) para el listado y search.
    const guestTag = newInvoice.value.guestName ? `Huésped: ${newInvoice.value.guestName}` : ''
    const roomTag = newInvoice.value.roomId ? `${guestTag ? ' · ' : ''}Hab: ${newInvoice.value.roomSearch.split('—')[0].trim()}` : ''
    await BillingService.create({
      hotelId: hotelId.value,
      guestId: newInvoice.value.guestId || null,
      reservationId: null,
      type: 'invoice',
      amount: invoiceSubtotal.value,
      items: validItems.map(i => ({ description: i.description, amount: Number(i.amount) })),
      notes: `${guestTag}${roomTag}`.trim() || newInvoice.value.notes || null,
    })
    closeNewInvoiceModal()
    loadData()
    toast.success('Factura creada')
  } catch { toast.error('Error al crear la factura') }
  finally { savingInvoice.value = false }
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
  savingPayment.value = true
  const method = paymentMethods.find(m => m.value === paymentForm.value.method)?.label ?? 'Other'
  try {
    if (paymentTargetKind.value === 'folio' && paymentTargetId.value) {
      await FoliosService.pay(paymentTargetId.value, {
        amount: paymentForm.value.amount, method, reference: paymentForm.value.reference,
      })
    } else if (paymentTargetId.value) {
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
    toast.success('Pago registrado')
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
    // La factura se genera con los datos del folio
    const invoiceData = res?.invoiceData
    if (invoiceData) {
      // Crear la factura via BillingService
      await BillingService.create({
        hotelId: invoiceData.hotelId,
        guestId: invoiceData.guestId,
        reservationId: invoiceData.reservationId,
        type: invoiceData.type,
        amount: invoiceData.amount,
        status: invoiceData.status,
        notes: invoiceData.notes,
      })
      toast.success('Folio cerrado — factura generada')
    } else {
      toast.success('Folio cerrado')
    }
    loadData()
  } catch { toast.error('Error al cerrar el folio') }
}

function exportCsv() {
  BillingService.downloadCsv(invoices.value, `facturas-${new Date().toISOString().split('T')[0]}.csv`)
  toast.success('CSV exportado')
}

function openDeleteModal(inv: any) {
  deleteTarget.value = inv
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await BillingService.remove(deleteTarget.value.id)
    closeDeleteModal()
    loadData()
    toast.success('Factura eliminada')
  } catch { toast.error('Error al eliminar la factura') }
  finally { deleting.value = false }
}
</script>
