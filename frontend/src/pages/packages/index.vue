<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl font-black text-navy">Paquetes &amp; Upsells</h1>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-xs text-text-muted mt-0.5">Servicios adicionales · Ofertas especiales · Revenue extra</p>
      </div>
      <button @click="showCreateModal = true" class="flex items-center gap-1.5 bg-navy text-white text-sm font-extrabold px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo Paquete
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_BOX"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">{{ Math.round(packagesCountAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Paquetes Activos</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_LAYERS"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">{{ new Set(packages.map((p: any) => p.type)).size }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Tipos de Paquete</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-teal truncate">${{ Math.round(avgPriceAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Precio Promedio</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_CHART"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">${{ Math.round(totalCatalogAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Valor Total Catálogo</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
        :class="activeTab === tab.id ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Packages Grid -->
    <div v-if="activeTab === 'packages'" class="grid md:grid-cols-3 gap-4">
      <div v-for="pkg in packages" :key="pkg.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <div class="h-32 bg-gradient-to-br" :class="pkg.gradient"></div>
        <div class="p-5">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-black text-navy">{{ pkg.name }}</h3>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="pkg.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
              {{ pkg.active ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
          <p class="text-[10px] text-text-muted mb-3">{{ pkg.description }}</p>
          <div class="flex items-end justify-between mb-3">
            <div>
              <span class="text-xl font-black text-navy">${{ pkg.price }}</span>
              <span class="text-[10px] text-text-muted"> /{{ pkg.unit }}</span>
            </div>
            <span class="text-[10px] text-teal font-bold">{{ pkg.sold }} vendidos</span>
          </div>
          <div class="flex items-center gap-4 pt-3 border-t border-border">
            <button class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
            <button class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">{{ pkg.active ? 'Desactivar' : 'Activar' }}</button>
          </div>
        </div>
      </div>

      <!-- Add New Package Card -->
      <button @click="showCreateModal = true" class="rounded-[20px] border-2 border-dashed border-border bg-white p-6 flex flex-col items-center justify-center min-h-[280px] hover:border-cyan transition-colors cursor-pointer">
        <div class="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-text-muted mb-3">
          <span class="w-6 h-6 shrink-0" v-html="ICON_PLUS"></span>
        </div>
        <div class="text-sm font-bold text-text-muted">Crear Nuevo Paquete</div>
      </button>
    </div>

    <!-- Upsells List -->
    <div v-if="activeTab === 'upsells'" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 class="text-lg font-black text-navy">Servicios Adicionales</h2>
        <button class="flex items-center gap-1.5 bg-navy text-white text-xs font-extrabold px-4 py-2 rounded-full hover:shadow-lg transition-all cursor-pointer">
          <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_PLUS"></span>
          Nuevo Upsell
        </button>
      </div>
      <div v-if="upsells.length === 0" class="text-center py-12">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_TAG"></span>
        <h3 class="font-bold text-navy mb-1">Sin servicios adicionales</h3>
        <p class="text-xs text-text-muted">Agrega upsells para ofrecer a los huéspedes.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-border">
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Servicio</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Categoría</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Precio</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Vendidos (Mes)</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Ingresos</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
              <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="upsell in upsells" :key="upsell.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
              <td class="py-3">
                <div class="text-sm font-bold text-navy">{{ upsell.name }}</div>
                <div class="text-[10px] text-text-muted">{{ upsell.description }}</div>
              </td>
              <td class="py-3">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="categoryClass(upsell.category)">
                  {{ upsell.category }}
                </span>
              </td>
              <td class="py-3 text-sm font-bold text-navy">${{ upsell.price }}</td>
              <td class="py-3 text-sm text-navy">{{ upsell.sold }}</td>
              <td class="py-3 text-sm font-bold text-teal">${{ upsell.revenue }}</td>
              <td class="py-3">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="upsell.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
                  {{ upsell.active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td class="py-3">
                <button class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top Sellers -->
    <div v-if="activeTab === 'analytics'" class="grid md:grid-cols-2 gap-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="text-sm font-black text-navy mb-4">Top Upsells por Ingresos</h3>
        <div v-if="topSellers.length === 0" class="text-center py-8 text-xs text-text-muted">Sin ventas registradas todavía.</div>
        <div v-else class="divide-y divide-border">
          <div v-for="(item, idx) in topSellers" :key="idx" class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" :class="idx === 0 ? 'bg-gold/20 text-gold' : idx === 1 ? 'bg-gray-200 text-gray-600' : 'bg-coral/20 text-coral'">
              {{ idx + 1 }}
            </div>
            <div class="flex-1">
              <div class="text-sm font-bold text-navy">{{ item.name }}</div>
              <div class="text-[10px] text-text-muted">{{ item.sold }} vendidos</div>
            </div>
            <div class="text-sm font-bold text-navy">${{ item.revenue }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <h3 class="text-sm font-black text-navy mb-4">Ingresos por Categoría</h3>
        <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="flex items-center gap-1.5 text-xs text-navy font-bold"><span class="w-3.5 h-3.5 text-cyan shrink-0" v-html="ICON_UTENSILS"></span>Gastronomía</span>
                <span class="text-xs font-bold text-navy">$1,840 (43%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-cyan rounded-full" style="width: 43%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="flex items-center gap-1.5 text-xs text-navy font-bold"><span class="w-3.5 h-3.5 text-teal shrink-0" v-html="ICON_CAR"></span>Transporte</span>
                <span class="text-xs font-bold text-navy">$1,120 (26%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-teal rounded-full" style="width: 26%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="flex items-center gap-1.5 text-xs text-navy font-bold"><span class="w-3.5 h-3.5 text-purple shrink-0" v-html="ICON_SPARKLE"></span>Bienestar</span>
                <span class="text-xs font-bold text-navy">$780 (18%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-purple rounded-full" style="width: 18%"></div>
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="flex items-center gap-1.5 text-xs text-navy font-bold"><span class="w-3.5 h-3.5 text-gold shrink-0" v-html="ICON_GIFT"></span>Experiencias</span>
                <span class="text-xs font-bold text-navy">$500 (13%)</span>
              </div>
              <div class="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div class="h-full bg-gold rounded-full" style="width: 13%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

    <!-- Create Package Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showCreateModal = false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h2 class="text-lg font-black text-navy">Crear Nuevo Paquete</h2>
              <button @click="showCreateModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>
            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Nombre</label>
                <input v-model="newPackage.name" type="text" placeholder="Ej: Romantique Weekend" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Descripción</label>
                <textarea v-model="newPackage.description" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none"></textarea>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Precio</label>
                  <input v-model="newPackage.price" type="number" placeholder="0.00" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Unidad</label>
                  <select v-model="newPackage.unit" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                    <option value="estancia">Por estancia</option>
                    <option value="noche">Por noche</option>
                    <option value="persona">Por persona</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Incluye</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(item, idx) in newPackage.includes"
                    :key="idx"
                    type="button"
                    @click="newPackage.includes[idx].checked = !newPackage.includes[idx].checked"
                    class="rounded-full px-3.5 py-2 text-[11px] font-bold border transition-all cursor-pointer"
                    :class="item.checked ? 'border-navy bg-navy text-white' : 'border-border text-text-secondary hover:border-navy/30'"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showCreateModal = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="createPackage" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer">Crear Paquete</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useCountUp } from '@/composables/useCountUp'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_BOX = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5 12 12m0 0L3.75 7.5M12 12v9m8.25-4.5V7.279a1.5 1.5 0 0 0-.75-1.299l-7.5-4.333a1.5 1.5 0 0 0-1.5 0L3 5.98a1.5 1.5 0 0 0-.75 1.3v8.442a1.5 1.5 0 0 0 .75 1.3l7.5 4.332a1.5 1.5 0 0 0 1.5 0l7.5-4.333a1.5 1.5 0 0 0 .75-1.299Z"/></svg>'
const ICON_LAYERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Zm-8.5 8 8.5 4.5 8.5-4.5m-17 4 8.5 4.5 8.5-4.5"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_TAG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.5 9.5a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182l-9.5-9.5A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75Z"/></svg>'
const ICON_UTENSILS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v6.75a2.25 2.25 0 0 1-2.25 2.25h0a2.25 2.25 0 0 1-2.25-2.25V3M6 12v9m9.75-18c-1.243 0-2.25 1.917-2.25 4.283 0 1.85 1.156 3.421 2.25 3.966V21"/></svg>'
const ICON_CAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm11.25 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM3.375 15h17.25m-17.25 0L4.5 6.75A1.5 1.5 0 0 1 6 5.25h12a1.5 1.5 0 0 1 1.5 1.5L20.625 15m-17.25 0v2.25a1.5 1.5 0 0 0 1.5 1.5h.75m14.25-3.75v2.25a1.5 1.5 0 0 1-1.5 1.5h-.75"/></svg>'
const ICON_SPARKLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></svg>'
const ICON_GIFT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H4.5a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.25-9.75h16.5a1.125 1.125 0 0 0 1.125-1.125v-2.25A1.125 1.125 0 0 0 20.25 6H3.75a1.125 1.125 0 0 0-1.125 1.125v2.25a1.125 1.125 0 0 0 1.125 1.125Z"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeTab = ref('packages')
const showCreateModal = ref(false)

const tabs = [
  { id: 'packages', label: 'Paquetes' },
  { id: 'upsells', label: 'Servicios Adicionales' },
  { id: 'analytics', label: 'Analytics' },
]

const packages = reactive<any[]>([])

const packagesCount = computed(() => packages.length)
const avgPrice = computed(() => (packages.length ? Math.round(packages.reduce((s: number, p: any) => s + (p.price || 0), 0) / packages.length) : 0))
const totalCatalog = computed(() => packages.reduce((s: number, p: any) => s + (p.price || 0), 0))

const packagesCountAnim = useCountUp(packagesCount)
const avgPriceAnim = useCountUp(avgPrice)
const totalCatalogAnim = useCountUp(totalCatalog)

const upsells = ref<any[]>([])

const topSellers = computed(() =>
  [...upsells.value].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 5).map((u: any) => ({ name: u.name, sold: u.sold ?? 0, revenue: String((u.sold ?? 0) * (u.price ?? 0)) })),
)

onMounted(async () => {
  try {
    const { data } = await OperationsService.paquetes(hotelId.value)
    const all = data.map((p: any, i: number) => ({
      id: p.id, name: p.name, description: p.description ?? '',
      price: p.price, unit: 'noche', sold: 0, active: p.active === 1,
      gradient: ['from-pink-400 to-rose-500','from-cyan to-teal','from-navy to-navy-light','from-blue to-cyan','from-purple to-indigo'][i % 5],
      type: p.type,
    }))
    packages.push(...all.filter((p: any) => p.type === 'combo' || p.type === 'upsell' || !p.type))
    upsells.value = all.filter((p: any) => p.type === 'servicio' || p.type === 'upsell')
  } catch { toast.error("Error al cargar datos") }
})

const newPackage = reactive({
  name: '',
  description: '',
  price: 0,
  unit: 'noche',
  includes: [
    { label: 'Habitación', checked: true },
    { label: 'Desayuno', checked: false },
    { label: 'Cena', checked: false },
    { label: 'Transfer', checked: false },
    { label: 'Spa', checked: false },
    { label: 'Actividades', checked: false },
  ],
})

function categoryClass(category: string) {
  const map: Record<string, string> = {
    'Gastronomía': 'bg-cyan/10 text-cyan',
    'Transporte': 'bg-teal/10 text-teal',
    'Bienestar': 'bg-purple/10 text-purple',
    'Experiencias': 'bg-gold/10 text-gold',
    'Servicios': 'bg-navy/10 text-navy',
  }
  return map[category] || 'bg-surface text-text-muted'
}

function createPackage() {
  packages.push({
    id: packages.length + 1,
    name: newPackage.name,
    description: newPackage.description,
    price: newPackage.price,
    unit: newPackage.unit,
    sold: 0,
    active: true,
    gradient: 'from-cyan to-teal',
  })
  showCreateModal.value = false
  newPackage.name = ''
  newPackage.description = ''
  newPackage.price = 0
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
