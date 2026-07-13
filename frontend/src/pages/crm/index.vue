<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">CRM y Fidelización</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-sm text-text-muted mt-0.5">Segmentación, puntos, cupones y valor de vida del cliente</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin"></div>
    </div>

    <template v-else-if="dashboard">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
              <span class="w-5 h-5 text-navy" v-html="ICON_USERS"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none tabular-nums text-navy truncate">{{ Math.round(totalGuestsAnim) }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total Huéspedes</div>
            </div>
          </div>
        </div>
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
              <span class="w-5 h-5 text-teal" v-html="ICON_CHECK"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none tabular-nums text-teal truncate">{{ Math.round(activeThisMonthAnim) }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Activos Este Mes</div>
            </div>
          </div>
        </div>
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
              <span class="w-5 h-5 text-gold" v-html="ICON_STAR"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none tabular-nums text-gold truncate">{{ Math.round(pointsIssuedAnim).toLocaleString() }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Puntos Emitidos</div>
            </div>
          </div>
        </div>
        <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
              <span class="w-5 h-5 text-cyan" v-html="ICON_WALLET"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none tabular-nums text-cyan truncate">${{ Math.round(avgLtvAnim).toLocaleString() }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">LTV Promedio</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tiers -->
      <div class="mb-6">
        <h3 class="text-sm font-extrabold text-navy mb-3">Distribución por Tier</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div v-for="(count, tier) in dashboard.topTierCounts" :key="tier"
            class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-full flex items-center justify-center shrink-0" :class="tierBg(tier)">
                <span class="w-5 h-5" v-html="tierIcon(tier)"></span>
              </div>
              <div class="min-w-0">
                <div class="text-xl font-black leading-none tabular-nums text-navy">{{ count }}</div>
                <div class="text-[10px] text-text-muted font-bold uppercase tracking-wide mt-1 truncate">{{ tier }}</div>
              </div>
            </div>
            <div class="mt-3 h-1.5 rounded-full bg-surface overflow-hidden">
              <div class="h-full rounded-full transition-all" :class="tierBarColor(tier)" :style="{ width: tierPercent(count) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'">
        <span class="w-4 h-4 shrink-0" v-html="tab.icon"></span>
        {{ tab.label }}
      </button>
    </div>

    <!-- LTV -->
    <div v-if="activeTab === 'ltv' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border"><h3 class="flex items-center gap-2 font-extrabold text-navy text-sm"><span class="w-4 h-4 shrink-0" v-html="ICON_CHART"></span>Valor de Vida del Cliente (LTV)</h3></div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Huésped</th>
              <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tier</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estancias</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Total Gastado</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Promedio</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Puntos</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Última Visita</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">LTV Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in ltv" :key="g.guestId" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
              <td class="px-4 py-3 font-bold text-navy whitespace-nowrap">{{ g.name }}</td>
              <td class="px-4 py-3"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" :class="tierBadge(g.tier)">{{ g.tier }}</span></td>
              <td class="px-4 py-3 text-right text-text-secondary">{{ g.totalStays }}</td>
              <td class="px-4 py-3 text-right font-bold text-navy">${{ g.totalSpent.toLocaleString() }}</td>
              <td class="px-4 py-3 text-right text-text-secondary">${{ g.avgPerStay.toLocaleString() }}</td>
              <td class="px-4 py-3 text-right text-gold font-bold">{{ g.loyaltyPoints }}</td>
              <td class="px-4 py-3 text-right text-text-secondary whitespace-nowrap">
                <span v-if="g.daysSinceLastVisit <= 30" class="inline-flex items-center gap-1"><span class="w-3 h-3 text-coral shrink-0" v-html="ICON_FLAME"></span>{{ g.daysSinceLastVisit }}d</span>
                <span v-else>{{ g.daysSinceLastVisit }}d</span>
              </td>
              <td class="px-4 py-3 text-right font-extrabold" :class="g.ltvScore >= 50 ? 'text-teal' : g.ltvScore >= 30 ? 'text-gold' : 'text-text-secondary'">{{ g.ltvScore }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!ltv.length" class="p-8 text-center text-text-muted text-sm">Cargando LTV...</div>
    </div>

    <!-- Cupones -->
    <div v-if="activeTab === 'coupons' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="flex items-center gap-2 font-extrabold text-navy text-sm"><span class="w-4 h-4 shrink-0" v-html="ICON_TAG"></span>Cupones y Descuentos</h3>
        <button @click="showCouponForm = true" class="flex items-center gap-1.5 rounded-full bg-cyan text-navy text-[11px] font-extrabold px-3.5 py-1.5 hover:shadow-lg transition-all cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo Cupón
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-surface/50">
              <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Código</th>
              <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Valor</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Usos</th>
              <th class="text-left px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Vence</th>
              <th class="text-right px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in coupons" :key="c.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
              <td class="px-4 py-3 font-bold text-navy whitespace-nowrap">{{ c.code }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ c.type === 'percentage' ? '%' : '$' }}</td>
              <td class="px-4 py-3 text-right font-bold text-teal">{{ c.type === 'percentage' ? c.value + '%' : '$' + c.value }}</td>
              <td class="px-4 py-3 text-right text-text-secondary">{{ c.useCount }}{{ c.maxUses ? '/' + c.maxUses : '' }}</td>
              <td class="px-4 py-3 text-text-secondary whitespace-nowrap">{{ c.expiresAt || 'Sin vencimiento' }}</td>
              <td class="px-4 py-3 text-right">
                <button @click="deleteCoupon(c)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!coupons.length" class="p-8 text-center">
        <span class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_TAG"></span>
        <p class="text-text-muted text-sm">No hay cupones. Creá el primero.</p>
      </div>
    </div>

    <!-- Validar cupón -->
    <div v-if="activeTab === 'validate' && !loading" class="max-w-md mx-auto rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <h3 class="flex items-center gap-2 font-extrabold text-navy text-sm mb-4"><span class="w-4 h-4 shrink-0" v-html="ICON_CARD"></span>Validar Cupón</h3>
      <div class="space-y-3">
        <input v-model="validateCode" placeholder="Código del cupón" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
        <input v-model.number="validateAmount" type="number" placeholder="Monto de la compra" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
        <button @click="doValidateCoupon" class="w-full rounded-full bg-teal text-white text-sm font-extrabold py-3 hover:bg-teal-light transition-colors cursor-pointer">Validar</button>
      </div>
      <div v-if="validatedCoupon" class="mt-6 pt-5 border-t border-border">
        <div class="font-extrabold text-teal text-lg">{{ validatedCoupon.code }}</div>
        <div class="text-sm text-text-secondary mt-0.5">Descuento: <b class="text-navy">{{ validatedCoupon.type === 'percentage' ? validatedCoupon.value + '%' : '$' + validatedCoupon.value }}</b></div>
      </div>
    </div>

    <!-- Segmentos -->
    <div v-if="activeTab === 'segments' && !loading" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="flex items-center gap-2 font-extrabold text-navy text-sm"><span class="w-4 h-4 shrink-0" v-html="ICON_TARGET"></span>Segmentos de Huéspedes</h3>
        <button @click="showSegmentForm = true" class="flex items-center gap-1.5 rounded-full bg-cyan text-navy text-[11px] font-extrabold px-3.5 py-1.5 hover:shadow-lg transition-all cursor-pointer">
          <span class="w-3 h-3 shrink-0" v-html="ICON_PLUS"></span>Nuevo
        </button>
      </div>

      <div class="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div v-for="s in segments" :key="s.id" class="rounded-[20px] border border-border p-4">
          <div class="font-extrabold text-navy text-sm mb-1">{{ s.name }}</div>
          <div class="text-[10px] text-text-muted mb-3">{{ s.description || 'Segmento dinámico' }} · {{ s.count }} huéspedes</div>
          <button @click="viewSegmentGuests(s)" class="text-[11px] text-cyan font-bold hover:text-navy transition-colors cursor-pointer">Ver huéspedes →</button>
        </div>
        <div v-if="!segments.length" class="col-span-1 md:col-span-3 p-8 text-center">
          <span class="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50 block" v-html="ICON_TARGET"></span>
          <p class="text-text-muted text-sm">No hay segmentos definidos</p>
        </div>
      </div>
    </div>

    <!-- Modal: Nuevo Cupón -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCouponForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Nuevo Cupón</h3>
              <button @click="showCouponForm = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Código</label>
                <input v-model="couponForm.code" placeholder="Ej: VERANO2026" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Tipo</label>
                  <select v-model="couponForm.type" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                    <option value="percentage">% Descuento</option>
                    <option value="fixed">$ Fijo</option>
                  </select>
                </div>
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Valor</label>
                  <input v-model.number="couponForm.value" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Compra Mín.</label>
                  <input v-model.number="couponForm.minPurchase" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
                </div>
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Vence</label>
                  <input v-model="couponForm.expiresAt" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
                </div>
              </div>
            </div>
            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showCouponForm = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="createCoupon" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer">Crear Cupón</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal: Nuevo Segmento -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showSegmentForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Nuevo Segmento</h3>
              <button @click="showSegmentForm = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Nombre</label>
                <input v-model="segmentForm.name" placeholder="Ej: Huéspedes frecuentes" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Tier</label>
                <select v-model="segmentForm.tier" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                  <option value="">Cualquier tier</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                </select>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Mín. Estancias</label>
                <input v-model.number="segmentForm.minStays" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
              </div>
            </div>
            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showSegmentForm = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="createSegment" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer">Crear Segmento</button>
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
import { CrmService, type Coupon, type GuestSegment, type GuestLTV, type CrmDashboard, type SegmentGuest } from '@/services/Crm.service'
import { useToast } from '@/composables/useToast'
import { useCountUp } from '@/composables/useCountUp'

const ICON_USERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_CHECK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>'
const ICON_STAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="currentColor"><path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.563.563 0 0 0-.586 0L6.982 21.44a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_TAG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.5 9.5a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182l-9.5-9.5A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75Z"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_TARGET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_FLAME = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.048 8.287 8.287 0 0 0 9 9.6a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 1-1.925 3.547 5.975 5.975 0 0 1-2.133 1.001A3.75 3.75 0 0 0 12 18Z"/></svg>'
const ICON_MEDAL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15.75 8.25 21l3.75-2 3.75 2-.75-5.25M15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>'
const ICON_GEM = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m5.25 8.25 6.75 12 6.75-12M5.25 8.25 8 4.5h8l2.75 3.75M5.25 8.25h13.5"/></svg>'
const ICON_CROWN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17h18M4 17l-1-9 5 4 4-6 4 6 5-4-1 9"/></svg>'
const ICON_USER = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>'

const toast = useToast()
const activeTab = ref('ltv')
const loading = ref(true)

const tabs = [
  { value: 'ltv', label: 'LTV', icon: ICON_CHART },
  { value: 'coupons', label: 'Cupones', icon: ICON_TAG },
  { value: 'validate', label: 'Validar', icon: ICON_CARD },
  { value: 'segments', label: 'Segmentos', icon: ICON_TARGET },
]

const dashboard = ref<CrmDashboard | null>(null)
const ltv = ref<GuestLTV[]>([])
const coupons = ref<Coupon[]>([])
const segments = ref<GuestSegment[]>([])

const totalGuestsCount = computed(() => dashboard.value?.totalGuests ?? 0)
const activeThisMonthCount = computed(() => dashboard.value?.activeThisMonth ?? 0)
const pointsIssuedCount = computed(() => dashboard.value?.totalPointsIssued ?? 0)
const avgLtvCount = computed(() => dashboard.value?.avgLTV ?? 0)

const totalGuestsAnim = useCountUp(totalGuestsCount)
const activeThisMonthAnim = useCountUp(activeThisMonthCount)
const pointsIssuedAnim = useCountUp(pointsIssuedCount)
const avgLtvAnim = useCountUp(avgLtvCount)

const showCouponForm = ref(false)
const showSegmentForm = ref(false)
const couponForm = ref({ code: '', type: 'percentage', value: 10, minPurchase: 0, expiresAt: '' })
const segmentForm = ref({ name: '', tier: '', minStays: 0 })
const validateCode = ref('')
const validateAmount = ref(0)
const validatedCoupon = ref<Coupon | null>(null)
const openSegment = ref<GuestSegment | null>(null)
const segmentGuests = ref<SegmentGuest[]>([])
const loadingGuests = ref(false)

function tierIcon(t: string) { return { bronze: ICON_MEDAL, silver: ICON_MEDAL, gold: ICON_MEDAL, platinum: ICON_GEM, diamond: ICON_CROWN }[t] || ICON_USER }
function tierBg(t: string) { return { bronze: 'bg-amber-50 text-amber-600', silver: 'bg-gray-50 text-gray-500', gold: 'bg-gold/10 text-gold', platinum: 'bg-cyan/10 text-cyan', diamond: 'bg-purple/10 text-purple' }[t] || '' }
function tierBadge(t: string) { return { bronze: 'bg-amber-100 text-amber-700', silver: 'bg-gray-200 text-gray-700', gold: 'bg-gold/10 text-gold', platinum: 'bg-cyan/10 text-cyan', diamond: 'bg-purple/10 text-purple' }[t] || '' }
function tierBarColor(t: string) { return { bronze: 'bg-amber-400', silver: 'bg-gray-400', gold: 'bg-gold', platinum: 'bg-cyan', diamond: 'bg-purple' }[t] || 'bg-navy/30' }
function tierPercent(count: number) { const total = dashboard.value?.totalGuests || 0; return total ? Math.round((count / total) * 100) : 0 }

async function loadData() {
  loading.value = true
  try {
    const [d, l, c, s] = await Promise.all([CrmService.getDashboard(), CrmService.getLTV(), CrmService.listCoupons(), CrmService.listSegments()])
    dashboard.value = d; ltv.value = l; coupons.value = c; segments.value = s
  } catch { toast.error('Error al cargar') }
  finally { loading.value = false }
}
onMounted(loadData)

async function createCoupon() {
  if (!couponForm.value.code) { toast.warning('Código requerido'); return }
  try { await CrmService.createCoupon(couponForm.value); toast.success('Cupón creado'); showCouponForm.value = false; couponForm.value = { code: '', type: 'percentage', value: 10, minPurchase: 0, expiresAt: '' }; loadData() }
  catch { toast.error('Error') }
}
async function deleteCoupon(c: Coupon) { try { await CrmService.deleteCoupon(c.id); toast.success('Eliminado'); loadData() } catch { toast.error('Error') } }
async function doValidateCoupon() {
  try { validatedCoupon.value = await CrmService.validateCoupon(validateCode.value, validateAmount.value); toast.success('¡Cupón válido!') }
  catch { validatedCoupon.value = null; toast.error('Cupón inválido o expirado') }
}
async function createSegment() {
  const rules: any = {}
  if (segmentForm.value.tier) rules.tier = segmentForm.value.tier
  if (segmentForm.value.minStays > 0) rules.minStays = segmentForm.value.minStays
  try { await CrmService.createSegment({ name: segmentForm.value.name, rules: JSON.stringify(rules) }); toast.success('Segmento creado'); showSegmentForm.value = false; segmentForm.value = { name: '', tier: '', minStays: 0 }; loadData() }
  catch { toast.error('Error') }
}
async function viewSegmentGuests(s: GuestSegment) {
  openSegment.value = s
  loadingGuests.value = true
  segmentGuests.value = []
  try { segmentGuests.value = await CrmService.getGuestsInSegment(s.id) }
  catch { toast.error('No se pudieron cargar los huéspedes del segmento'); openSegment.value = null }
  finally { loadingGuests.value = false }
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
