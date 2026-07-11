<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Facturación</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
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
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">${{ Math.round(totalMonthAnim).toLocaleString() }}</div>
            <div v-if="formatSecondary(totalMonth)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalMonth) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Ingresos del Mes</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_CHECK_PLAIN"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-teal truncate">${{ Math.round(totalTodayAnim).toLocaleString() }}</div>
            <div v-if="formatSecondary(totalToday)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalToday) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Cobrado Hoy</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-gold truncate">${{ Math.round(totalPendingAnim).toLocaleString() }}</div>
            <div v-if="formatSecondary(totalPending)" class="text-[10px] text-text-muted truncate">{{ formatSecondary(totalPending) }}</div>
            <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-0.5 truncate">Pendiente</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-cyan">{{ Math.round(totalInvoicesAnim) }}</div>
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
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
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
    <div v-if="activeTab === 'invoices' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border">
        <div class="flex items-center justify-between">
          <h3 class="font-extrabold text-navy text-sm">Facturas</h3>
          <div class="flex gap-2">
            <select v-model="invoiceFilter" @change="applyInvoiceFilter" class="px-3 py-1.5 rounded-lg border border-border text-[11px] font-bold focus:outline-none focus:border-navy cursor-pointer">
              <option value="all">Todas</option>
              <option value="paid">Pagadas</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidas</option>
              <option value="cancelled">Anuladas</option>
            </select>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[720px]">
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
              v-for="inv in invoices"
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
                  <button v-if="inv.balance > 0 && inv.status !== 'cancelled'" @click.stop="openRecordPayment(inv)" class="px-2 py-1 bg-teal/10 text-teal rounded-lg text-[10px] font-bold hover:bg-teal/20 transition-colors cursor-pointer">Cobrar</button>
                  <!-- Una factura con efectos contables se anula, no se borra. -->
                  <button v-if="inv.deletable" @click.stop="openDeleteModal(inv)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold hover:bg-coral/20 transition-colors cursor-pointer">Eliminar</button>
                  <button v-else-if="inv.status !== 'cancelled'" @click.stop="openCreditNoteModal(inv)" class="px-2 py-1 bg-gold/10 text-gold rounded-lg text-[10px] font-bold hover:bg-gold/20 transition-colors cursor-pointer">Anular</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="invoices.length === 0" class="p-8 text-center">
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
    <div v-if="activeTab === 'payments' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border">
        <h3 class="font-extrabold text-navy text-sm">Pagos Recientes</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px]">
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
      </div>
      <div v-if="payments.length === 0" class="p-8 text-center">
        <span class="w-9 h-9 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_CARD"></span>
        <p class="text-sm text-text-muted font-bold">No hay pagos registrados</p>
      </div>
    </div>

    <!-- Folios Tab -->
    <div v-if="activeTab === 'folios' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border">
        <h3 class="font-extrabold text-navy text-sm">Folios de Habitación</h3>
        <p class="text-[10px] text-text-muted mt-0.5">Cargos pendientes por habitación</p>
      </div>
      <div class="px-5">
        <div v-if="folios.length === 0" class="py-8 text-center text-text-muted text-sm">No hay folios</div>
        <div v-for="folio in folios" :key="folio.id" class="py-5 border-b border-border last:border-0">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-navy">Hab {{ folio.roomNumber || '—' }}</span>
                <span class="text-text-muted">·</span>
                <span class="text-sm font-bold text-navy truncate">{{ folio.guestName || 'Huésped' }}</span>
              </div>
              <div class="text-[10px] text-text-muted mt-0.5">
                {{ folio.status === 'open' ? 'Abierto' : 'Cerrado' }}
                <span v-if="folio.chargeCount"> · {{ folio.chargeCount }} cargo(s)</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-lg font-black text-navy">${{ (folio.chargesTotal || 0).toLocaleString() }}</div>
              <div class="text-[10px] font-bold" :class="(folio.balance || 0) > 0 ? 'text-orange' : 'text-teal'">
                Saldo: ${{ (folio.balance || 0).toLocaleString() }}
              </div>
            </div>
          </div>
          <div class="mt-3 flex justify-end items-center gap-4">
            <template v-if="folio.status === 'open'">
              <button @click="openAddCharge(folio)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">+ Cargo</button>
              <button @click="openRecordPaymentForFolio(folio)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Registrar Pago</button>
              <button @click="openCloseFolioModal(folio)" class="rounded-full bg-cyan text-navy text-[11px] font-extrabold px-4 py-1.5 hover:shadow-lg transition-all cursor-pointer">Cerrar y Facturar</button>
            </template>
            <span v-else-if="folio.status === 'closed' && folio.invoiceId" class="text-[10px] text-teal font-bold">✓ Facturado</span>
          </div>
        </div>
      </div>
    </div>

    <!-- View Invoice Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showViewModal && viewInvoice" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-lg font-black text-navy">{{ typeLabel(viewInvoice.type) }} #{{ viewInvoice.number }}</h3>
                  <span class="text-[10px] font-bold px-2.5 py-1 rounded-full" :class="invoiceStatusClass(viewInvoice.status)">
                    {{ invoiceStatusLabel(viewInvoice.status) }}
                  </span>
                </div>
                <p class="text-xs text-text-muted mt-0.5">Emitida: {{ viewInvoice.date }} {{ viewInvoice.dueDate ? `· Vence: ${viewInvoice.dueDate}` : '' }}</p>
              </div>
              <button @click="closeViewModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="p-6 overflow-y-auto flex-1">
              <!-- NCF -->
              <div v-if="viewInvoice.ncf" class="flex items-center justify-between pb-5 border-b border-border">
                <span class="text-[10px] font-bold text-text-muted uppercase tracking-wide">NCF</span>
                <span class="text-sm font-extrabold text-navy">{{ viewInvoice.ncf }}</span>
              </div>

              <!-- Guest & Room -->
              <div class="grid grid-cols-3 gap-3 py-5 border-b border-border">
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Huésped</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ viewInvoice.guest || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Habitación</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ viewInvoice.room || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Moneda</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ currencySymbol(viewInvoice.currency) }} {{ viewInvoice.currency }}</div>
                </div>
              </div>

              <!-- Items -->
              <div class="py-5 border-b border-border">
                <div class="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-3">Conceptos Facturados</div>
                <div class="divide-y divide-border">
                  <div v-for="(item, idx) in viewInvoice.items" :key="idx" class="flex items-center justify-between py-2">
                    <span class="text-sm font-bold text-navy">{{ item.description }}</span>
                    <span class="text-sm font-bold text-navy">{{ currencySymbol(viewInvoice.currency) }}{{ Number(item.amount).toFixed(2) }}</span>
                  </div>
                </div>
              </div>

              <!-- Financial Summary -->
              <div class="py-5 border-b border-border space-y-2.5">
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Subtotal</span>
                  <span class="font-bold text-navy">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.subtotal.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Impuestos ({{ viewInvoice.taxRate }}%)</span>
                  <span class="font-bold text-navy">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.tax.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between pt-2.5 border-t border-border">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy text-xl">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.total.toFixed(2) }}</span>
                </div>
                <template v-if="viewInvoice.amountPaid > 0">
                  <div class="flex justify-between text-sm text-teal pt-2.5 border-t border-border">
                    <span class="font-bold">Pagado</span>
                    <span class="font-bold">-{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.amountPaid.toFixed(2) }}</span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span class="font-extrabold text-gold">Saldo Pendiente</span>
                    <span class="font-extrabold text-gold">{{ currencySymbol(viewInvoice.currency) }}{{ viewInvoice.balance.toFixed(2) }}</span>
                  </div>
                </template>
              </div>

              <!-- Payment Method -->
              <div v-if="viewInvoice.method" class="flex items-center gap-3 py-5 border-b border-border">
                <span class="w-5 h-5 text-navy shrink-0" v-html="paymentMethodIcon(viewInvoice.method)"></span>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Método de Pago</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ paymentMethodLabel(viewInvoice.method) }}</div>
                </div>
              </div>

              <!-- Notes -->
              <div v-if="viewInvoice.notes" class="pt-5">
                <div class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Notas</div>
                <div class="text-sm text-text-secondary whitespace-pre-wrap">{{ viewInvoice.notes }}</div>
              </div>
            </div>

            <!-- Actions -->
            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center gap-4">
                <button @click="printInvoice" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Imprimir</button>
                <button @click="emailInvoice" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Enviar email</button>
                <button @click="downloadPdf" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">PDF</button>
                <div class="flex-1"></div>
                <button v-if="viewInvoice.status === 'pending' || viewInvoice.balance > 0" @click="closeViewModal(); openRecordPayment(viewInvoice)" class="rounded-full bg-teal text-white text-sm font-extrabold px-5 py-2.5 hover:bg-teal-light transition-colors cursor-pointer">
                  Registrar Pago
                </button>
                <button @click="closeViewModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New Payment Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Registrar Pago</h3>
              <button @click="closePaymentModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Huésped</label>
                <input :value="paymentForm.guest" type="text" disabled class="w-full px-4 py-2.5 rounded-xl border border-border text-sm bg-surface" />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Monto ($)</label>
                <input v-model.number="paymentForm.amount" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Método de Pago</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="method in paymentMethods"
                    :key="method.value"
                    @click="paymentForm.method = method.value"
                    class="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold border transition-all cursor-pointer"
                    :class="paymentForm.method === method.value ? 'border-navy bg-navy text-white' : 'border-border text-text-secondary hover:border-navy/30'"
                  >
                    <span class="w-3.5 h-3.5 shrink-0" v-html="method.icon"></span>
                    {{ method.label }}
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Referencia</label>
                <input v-model="paymentForm.reference" type="text" placeholder="N° transacción, comprobante, etc." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Notas</label>
                <textarea v-model="paymentForm.notes" rows="2" placeholder="Opcional..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="closePaymentModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="savePayment" :disabled="savingPayment" class="rounded-full bg-teal text-white text-sm font-extrabold px-5 py-2.5 hover:bg-teal-light transition-colors cursor-pointer disabled:opacity-50">{{ savingPayment ? 'Guardando...' : 'Confirmar Pago' }}</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Add Charge Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showChargeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Agregar Cargo — Hab {{ chargeRoom }}</h3>
              <button @click="closeChargeModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Concepto</label>
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
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Monto ($)</label>
                <input v-model.number="chargeForm.amount" type="number" min="0" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Notas</label>
                <textarea v-model="chargeForm.notes" rows="2" placeholder="Detalle del cargo..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="closeChargeModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="saveCharge" :disabled="savingCharge" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">{{ savingCharge ? 'Agregando...' : 'Agregar' }}</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- New Invoice Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showNewInvoiceModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>

          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Nueva Factura</h3>
              <button @click="closeNewInvoiceModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div class="p-6 space-y-4 overflow-y-auto flex-1">
              <!-- Room Search -->
              <div>
                <label class="flex items-center gap-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">
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
              <div v-if="newInvoice.guestName" class="flex items-center gap-3 py-3 border-b border-border">
                <span class="w-5 h-5 text-teal shrink-0" v-html="ICON_USER"></span>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Huésped</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ newInvoice.guestName }}</div>
                </div>
              </div>

              <!-- Line Items -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide">Conceptos</label>
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
                    <button v-if="newInvoice.items.length > 1" @click="removeInvoiceItem(idx)" class="w-8 h-8 rounded-full bg-coral/10 text-coral flex items-center justify-center hover:bg-coral/20 transition-colors cursor-pointer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Notas</label>
                <textarea v-model="newInvoice.notes" rows="2" placeholder="Detalle adicional..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>

              <!-- Total Preview -->
              <div class="pt-4 border-t border-border">
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Subtotal</span>
                  <span class="font-bold text-navy">${{ invoiceSubtotal.toFixed(2) }}</span>
                </div>
                <div v-if="hotelTaxRate > 0" class="flex justify-between text-sm mt-1.5">
                  <span class="text-text-secondary">Impuestos ({{ hotelTaxRate }}%)</span>
                  <span class="font-bold text-navy">${{ invoiceTaxes.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between pt-2.5 mt-2 border-t border-border">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy text-lg">${{ invoiceTotal.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="closeNewInvoiceModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="saveNewInvoice" :disabled="savingInvoice || invoiceTotal <= 0" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
                  {{ savingInvoice ? 'Creando...' : 'Crear Factura' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showDeleteModal && deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div class="text-center mb-4">
              <div class="w-11 h-11 mx-auto mb-2 rounded-full bg-coral/10 flex items-center justify-center">
                <span class="w-5 h-5 text-coral" v-html="ICON_ALERT_TRIANGLE"></span>
              </div>
              <h3 class="text-lg font-black text-navy">Eliminar Factura</h3>
              <p class="text-sm text-text-secondary mt-2">¿Estás seguro de eliminar la factura <strong>#{{ deleteTarget.number }}</strong>?</p>
              <p class="text-xs text-text-muted mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <div class="flex items-center justify-center gap-4">
              <button @click="closeDeleteModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="confirmDelete" :disabled="deleting" class="rounded-full bg-coral text-white text-sm font-extrabold px-5 py-2.5 hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">
                {{ deleting ? 'Eliminando...' : 'Eliminar' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Close Folio + Invoice Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCloseFolioModal && closeFolioTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div class="text-center mb-4">
              <div class="w-11 h-11 mx-auto mb-2 rounded-full bg-cyan/10 flex items-center justify-center">
                <span class="w-5 h-5 text-cyan" v-html="ICON_DOCUMENT"></span>
              </div>
              <h3 class="text-lg font-black text-navy">Cerrar y Facturar</h3>
              <p class="text-sm text-text-secondary mt-2">
                Se cerrará el folio de <strong>{{ closeFolioTarget.guestName || 'huésped' }}</strong> y se emitirá la factura por
                <strong>${{ (closeFolioTarget.chargesTotal || 0).toLocaleString() }}</strong>.
              </p>
              <p class="text-xs text-text-muted mt-1">El folio no admite más cargos después de cerrarse.</p>
            </div>
            <div class="flex items-center justify-center gap-4">
              <button @click="closeCloseFolioModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="confirmCloseAndInvoice" :disabled="closingFolio" class="rounded-full bg-cyan text-navy text-sm font-extrabold px-5 py-2.5 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
                {{ closingFolio ? 'Facturando...' : 'Cerrar y Facturar' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Credit Note Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCreditNoteModal && creditNoteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div class="p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Anular Factura #{{ creditNoteTarget.number }}</h3>
              <button @click="closeCreditNoteModal" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div class="p-5 space-y-4">
              <p class="text-sm text-text-secondary">
                Esta factura ya tiene efectos contables, así que no se elimina: se emite una
                <strong>nota de crédito</strong> por ${{ creditNoteTarget.total.toLocaleString() }} que la anula dejando el rastro.
              </p>
              <div>
                <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Motivo de la anulación</label>
                <textarea v-model="creditNoteReason" rows="3" placeholder="Ej: error en el monto facturado, servicio no prestado..." class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>
            </div>
            <div class="p-5 border-t border-border">
              <div class="flex items-center justify-end gap-4">
                <button @click="closeCreditNoteModal" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="confirmCreditNote" :disabled="issuingCreditNote" class="rounded-full bg-gold text-white text-sm font-extrabold px-5 py-2.5 hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">
                  {{ issuingCreditNote ? 'Emitiendo...' : 'Emitir Nota de Crédito' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Invoice Print Frame (oculto) -->
    <iframe ref="printFrame" class="hidden" style="position:absolute;width:0;height:0;border:0;"></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { BillingService, isDeletable, type BillingStats, type Invoice, type InvoiceStatus } from '@/services/Billing.service'
import { RoomService } from '@/services/Room.service'
import { SettingsService } from '@/services/Settings.service'
import { useCurrency } from '@/composables/useCurrency'
import { useCountUp } from '@/composables/useCountUp'
import { FoliosService, type Folio } from '@/services/Folios.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))
const { formatSecondary, loadCurrencyConfig } = useCurrency()

/** Cuántos pagos recientes trae el tab "Pagos" (no está paginado). */
const PAYMENTS_PAGE_SIZE = 20

const activeTab = ref('invoices')
const invoiceFilter = ref<InvoiceStatus | 'all'>('all')
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
const savingCharge = ref(false)
const paymentTargetId = ref<string | null>(null)
const paymentTargetKind = ref<'invoice' | 'folio'>('invoice')
const chargeFolioId = ref<string | null>(null)

// Cerrar folio + facturar
const showCloseFolioModal = ref(false)
const closeFolioTarget = ref<Folio | null>(null)
const closingFolio = ref(false)

// Nota de crédito — la vía para anular una factura ya emitida
const showCreditNoteModal = ref(false)
const creditNoteTarget = ref<any>(null)
const creditNoteReason = ref('')
const issuingCreditNote = ref(false)

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

/** Vista de fila a partir del DTO del backend. */
function toRow(d: Invoice) {
  return {
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
    items: (Array.isArray(d.items) && d.items.length) ? d.items : [{ description: conceptFor(d), amount: d.total }],
    method: d.paymentMethod || '',
    notes: d.notes || '',
    deletable: isDeletable(d),
  }
}

/**
 * Facturas y pagos son tipos distintos de documento en la misma tabla: se piden por separado
 * (`type=invoice` / `type=payment`). Antes se traía una página mezclada y se separaba con
 * `.filter()`, así que la paginación contaba pagos como facturas y el filtro de estado solo
 * miraba la página actual.
 */
async function loadData() {
  loading.value = true
  try {
    const [invoiceRes, paymentRes, statsData] = await Promise.all([
      BillingService.list({
        hotelId: hotelId.value,
        type: 'invoice',
        status: invoiceFilter.value === 'all' ? undefined : invoiceFilter.value,
        page: page.value,
      }),
      BillingService.list({ hotelId: hotelId.value, type: 'payment', limit: PAYMENTS_PAGE_SIZE }).catch(() => null),
      BillingService.stats().catch(() => null),
    ])
    if (statsData) stats.value = statsData
    totalPages.value = invoiceRes.pages
    totalItems.value = invoiceRes.total
    invoices.value = invoiceRes.invoices.map(toRow)
    payments.value = (paymentRes?.invoices ?? []).map(toRow).map(p => ({
      id: p.id, guest: p.guest, concept: p.concept, method: p.method || '—',
      status: p.status, date: p.date, amount: p.total,
    }))
    await loadFolios()
  } catch { toast.error("Error al cargar datos") }
  finally { loading.value = false }
}

/** El filtro de estado se resuelve en el servidor: hay que volver a la página 1. */
function applyInvoiceFilter() {
  page.value = 1
  loadData()
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

const totalMonth = computed(() => stats.value.monthlyRevenue)
const totalToday = computed(() => stats.value.todayRevenue)
const totalPending = computed(() => stats.value.pendingAmount + stats.value.overdueAmount)
const totalInvoices = computed(() => stats.value.total)

const totalMonthAnim = useCountUp(totalMonth)
const totalTodayAnim = useCountUp(totalToday)
const totalPendingAnim = useCountUp(totalPending)
const totalInvoicesAnim = useCountUp(totalInvoices)

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
  const classes: Record<string, string> = {
    paid: 'bg-teal/10 text-teal',
    pending: 'bg-gold/10 text-gold',
    overdue: 'bg-coral/10 text-coral',
    cancelled: 'bg-gray-100 text-gray-500',
    draft: 'bg-navy/10 text-navy',
  }
  return classes[status] ?? 'bg-gray-100 text-gray-500'
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
  // El saldo, no el total: una factura con pago parcial ya tiene plata aplicada.
  const outstanding = Math.max(0, inv.balance ?? inv.total)
  paymentForm.value = { guest: inv.guest, amount: outstanding, method: 'card', reference: '', notes: '' }
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
  // El código canónico ('cash'), no la etiqueta en español: la API tiene un enum cerrado y la DB
  // habla inglés. Mandar "Efectivo" hacía que el pago cayera en `other` y no llegara a la caja.
  const method = paymentForm.value.method
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
  finally { savingPayment.value = false }
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
  if (savingCharge.value) return
  savingCharge.value = true
  try {
    await FoliosService.charge(chargeFolioId.value, {
      description: `${chargeForm.value.description}${chargeForm.value.notes ? ` — ${chargeForm.value.notes}` : ''}`,
      amount: chargeForm.value.amount,
    })
    closeChargeModal()
    loadData()
    toast.success('Cargo agregado')
  } catch { toast.error('Error al guardar cargo') }
  finally { savingCharge.value = false }
}

function openCloseFolioModal(folio: Folio) {
  closeFolioTarget.value = folio
  showCloseFolioModal.value = true
}

function closeCloseFolioModal() {
  showCloseFolioModal.value = false
  closeFolioTarget.value = null
}

/** El backend cierra el folio, emite la factura y las vincula en una sola operación. */
async function confirmCloseAndInvoice() {
  const folio = closeFolioTarget.value
  if (!folio || closingFolio.value) return
  closingFolio.value = true
  try {
    const { invoice } = await FoliosService.closeAndInvoice(folio.id)
    closeCloseFolioModal()
    loadData()
    toast.success(`Folio cerrado — factura ${invoice?.invoiceNumber ?? ''} generada`.trim())
  } catch { toast.error('Error al cerrar el folio') }
  finally { closingFolio.value = false }
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
  } catch (e) {
    // El backend rechaza con 409 si la factura ya tiene efectos contables.
    const msg = e instanceof Error && e.message ? e.message : 'Error al eliminar la factura'
    toast.error(msg)
  }
  finally { deleting.value = false }
}

function openCreditNoteModal(inv: any) {
  creditNoteTarget.value = inv
  creditNoteReason.value = ''
  showCreditNoteModal.value = true
}

function closeCreditNoteModal() {
  showCreditNoteModal.value = false
  creditNoteTarget.value = null
}

async function confirmCreditNote() {
  if (!creditNoteTarget.value || issuingCreditNote.value) return
  if (!creditNoteReason.value.trim()) { toast.warning('Indicá el motivo de la anulación'); return }
  issuingCreditNote.value = true
  try {
    await BillingService.creditNote(creditNoteTarget.value.id, creditNoteReason.value.trim())
    closeCreditNoteModal()
    closeViewModal()
    loadData()
    toast.success('Nota de crédito emitida')
  } catch { toast.error('Error al emitir la nota de crédito') }
  finally { issuingCreditNote.value = false }
}
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
