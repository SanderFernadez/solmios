<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div class="flex items-center gap-2.5">
        <h2 class="text-xl font-black text-navy">Grupos &amp; Blocks</h2>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
          </span>
          En vivo
        </span>
      </div>
      <button @click="openNewGroup" class="flex items-center gap-1.5 bg-cyan text-navy font-extrabold text-sm px-5 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo Grupo
      </button>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div class="flex gap-2">
        <button
          v-for="view in views"
          :key="view.value"
          @click="activeView = view.value"
          class="px-4 py-2 rounded-full text-sm font-bold transition-all cursor-pointer"
          :class="activeView === view.value ? 'bg-navy text-white' : 'bg-white text-text-secondary border border-border hover:border-navy/30'"
        >
          {{ view.label }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_USERS_GROUP"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">{{ Math.round(groupsCountAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Grupos Activos</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_BED"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-cyan truncate">{{ Math.round(blockedRoomsAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Habitaciones Bloqueadas</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-teal truncate">${{ Math.round(potentialRevenueAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Ingresos Potenciales</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gold/10">
            <span class="w-5 h-5 text-gold" v-html="ICON_CLOCK"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-gold truncate">{{ Math.round(pendingAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Pendiente Confirmar</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Lista de Grupos -->
    <div v-if="activeView === 'list'" class="space-y-4">
      <div v-if="groups.length === 0" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-12 text-center">
        <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_USERS_GROUP"></span>
        <h3 class="font-bold text-navy mb-1">Sin grupos registrados</h3>
        <p class="text-xs text-text-muted">Crea un grupo o block para reservas colectivas.</p>
      </div>
      <div v-for="group in groups" :key="group.id" class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
        <div class="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-lg font-black text-navy">{{ group.name }}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(group.status)">
                {{ group.status }}
              </span>
            </div>
            <div class="text-sm text-text-muted">{{ group.contact }} — {{ group.company }}</div>
          </div>
          <div class="flex items-center gap-4">
            <button @click.stop="openViewGroup(group)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Ver Detalles</button>
            <button @click.stop="openEditGroup(group)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Fechas</div>
            <div class="text-sm font-bold">{{ group.checkIn }} — {{ group.checkOut }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Noches</div>
            <div class="text-sm font-bold">{{ group.nights }}</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Habitaciones</div>
            <div class="text-sm font-bold">{{ group.rooms }} habitaciones</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Huéspedes</div>
            <div class="text-sm font-bold">{{ group.guests }} personas</div>
          </div>
          <div>
            <div class="text-[10px] font-bold text-text-muted uppercase">Total</div>
            <div class="text-sm font-black text-navy">${{ group.total.toLocaleString() }}</div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t border-border flex-wrap gap-2">
          <div class="flex gap-2">
            <span v-for="tag in group.tags" :key="tag" class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface text-text-muted">
              {{ tag }}
            </span>
          </div>
          <div class="text-[10px] text-text-muted">
            Deposits: ${{ group.deposit.toLocaleString() }} / Restante: ${{ (group.total - group.deposit).toLocaleString() }}
          </div>
        </div>
      </div>
    </div>

    <!-- Calendar View -->
    <div v-else class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between">
        <button @click="prevWeek" class="px-3 py-1.5 rounded-full text-sm font-bold text-text-secondary hover:bg-surface transition-colors cursor-pointer">← Anterior</button>
        <h3 class="text-sm font-black text-navy">{{ currentWeekLabel }}</h3>
        <button @click="nextWeek" class="px-3 py-1.5 rounded-full text-sm font-bold text-text-secondary hover:bg-surface transition-colors cursor-pointer">Siguiente →</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[800px]">
          <thead>
            <tr class="border-b border-border">
              <th class="p-3 text-[10px] font-bold text-text-muted uppercase text-left w-40">Grupo</th>
              <th v-for="day in weekDays" :key="day.date" class="p-3 text-[10px] font-bold text-text-muted uppercase text-center">
                {{ day.label }}
                <div class="text-text-secondary font-normal">{{ day.date }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="group in groups" :key="group.id" class="border-b border-border last:border-0">
              <td class="p-3">
                <div class="text-sm font-bold text-navy">{{ group.name }}</div>
                <div class="text-[10px] text-text-muted">{{ group.rooms }} hab.</div>
              </td>
              <td v-for="day in weekDays" :key="day.date" class="p-1">
                <div
                  v-if="isGroupActive(group, day.date)"
                  class="h-10 rounded-lg flex items-center justify-center text-[10px] font-bold cursor-pointer"
                  :class="getGroupDayClass(group, day.date)"
                >
                  {{ group.rooms }} Hab
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal: Ver Grupo -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showViewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-6 border-b border-border flex items-center justify-between">
              <div class="flex items-center gap-3">
                <h2 class="text-xl font-black text-navy">{{ selectedGroup.name }}</h2>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="statusClass(selectedGroup.status)">
                  {{ selectedGroup.status }}
                </span>
              </div>
              <button @click="showViewModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
              <div class="grid grid-cols-2 gap-x-6 gap-y-3 pb-6 border-b border-border">
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Contacto</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.contact }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Empresa</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.company }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Teléfono</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.phone }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Email</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.email }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Check-in / Check-out</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.checkIn }} — {{ selectedGroup.checkOut }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Noches / Habitaciones</div>
                  <div class="text-sm font-bold text-navy mt-0.5">{{ selectedGroup.nights }} noches · {{ selectedGroup.rooms }} hab.</div>
                </div>
              </div>

              <div class="py-5 border-b border-border space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">{{ selectedGroup.rooms }} hab. × {{ selectedGroup.nights }} noches × ${{ selectedGroup.rate }}</span>
                  <span class="font-bold text-navy">${{ (selectedGroup.rooms * selectedGroup.nights * selectedGroup.rate).toLocaleString() }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-text-secondary">Impuestos (18%)</span>
                  <span class="font-bold text-navy">${{ Math.round(selectedGroup.total * 0.18).toLocaleString() }}</span>
                </div>
                <div class="flex justify-between text-sm pt-2 border-t border-border">
                  <span class="font-extrabold text-navy">Total</span>
                  <span class="font-extrabold text-navy">${{ selectedGroup.total.toLocaleString() }}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-x-6 gap-y-3 py-5" :class="{ 'border-b border-border': selectedGroup.notes }">
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Depósito Recibido</div>
                  <div class="text-lg font-black text-teal mt-0.5">${{ selectedGroup.deposit.toLocaleString() }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-text-muted uppercase tracking-wide">Pendiente de Pago</div>
                  <div class="text-lg font-black text-gold mt-0.5">${{ (selectedGroup.total - selectedGroup.deposit).toLocaleString() }}</div>
                </div>
              </div>

              <div v-if="selectedGroup.notes" class="pt-5">
                <div class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Notas</div>
                <div class="text-sm text-text-secondary">{{ selectedGroup.notes }}</div>
              </div>
            </div>
            <div class="shrink-0 border-t border-border p-6">
              <div class="flex items-center justify-end gap-4">
                <button @click="showViewModal = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cerrar</button>
                <button class="flex items-center gap-1.5 rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer">
                  <span class="w-4 h-4 shrink-0" v-html="ICON_DOCUMENT"></span>
                  Exportar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal: Nuevo Grupo -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showNewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-[20px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-6 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Nuevo Grupo / Block</h3>
              <button @click="showNewModal = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Nombre del Grupo *</label>
                  <input v-model="newGroup.name" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="Ej: Conferencia Tech Summit 2026">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Contacto *</label>
                  <input v-model="newGroup.contact" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="Nombre del contacto">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Empresa</label>
                  <input v-model="newGroup.company" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="Nombre de la empresa">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Teléfono</label>
                  <input v-model="newGroup.phone" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="+1 234 567 890">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Email</label>
                  <input v-model="newGroup.email" type="email" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="email@empresa.com">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Fecha Check-in *</label>
                  <input v-model="newGroup.checkIn" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Fecha Check-out *</label>
                  <input v-model="newGroup.checkOut" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Habitaciones *</label>
                  <input v-model.number="newGroup.rooms" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="10">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Tarifa por Noche *</label>
                  <input v-model.number="newGroup.rate" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="150">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Depósito</label>
                  <input v-model.number="newGroup.deposit" type="number" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" placeholder="0">
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Tipo de Evento</label>
                  <select v-model="newGroup.eventType" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy cursor-pointer">
                    <option value="">Seleccionar...</option>
                    <option value="Conferencia">Conferencia</option>
                    <option value="Boda">Boda</option>
                    <option value="Corporativo">Corporativo</option>
                    <option value="Turismo Grupal">Turismo Grupal</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label class="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Notas</label>
                  <textarea v-model="newGroup.notes" rows="3" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none" placeholder="Instrucciones especiales, requerimientos..."></textarea>
                </div>
              </div>
            </div>
            <div class="shrink-0 border-t border-border p-6">
              <div class="flex items-center justify-end gap-4">
                <button @click="showNewModal = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="createGroup" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer">Crear Grupo</button>
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
import { OperationsService } from '@/services/Operations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useCountUp } from '@/composables/useCountUp'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_USERS_GROUP = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>'
const ICON_BED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m5-2h4a1 1 0 0 1 1 1v2"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CLOCK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>'

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const activeView = ref('list')
const showViewModal = ref(false)
const showNewModal = ref(false)
const selectedGroup = ref<any>({})

const views = [
  { label: 'Lista', value: 'list' },
  { label: 'Calendario', value: 'calendar' }
]

const groups = ref<any[]>([])

const groupsCount = computed(() => groups.value.length)
const blockedRooms = computed(() => groups.value.reduce((s: number, x: any) => s + (x.rooms ?? 0), 0))
const potentialRevenue = computed(() => groups.value.reduce((s: number, x: any) => s + (x.total ?? 0), 0))
const pendingCount = computed(() => groups.value.filter((x: any) => x.status === 'Pendiente').length)

const groupsCountAnim = useCountUp(groupsCount)
const blockedRoomsAnim = useCountUp(blockedRooms)
const potentialRevenueAnim = useCountUp(potentialRevenue)
const pendingAnim = useCountUp(pendingCount)

async function loadData() {
  try {
    const { data } = await OperationsService.grupos.list(hotelId.value)
    groups.value = data.map((g: any) => {
      const ci = String(g.checkIn || '').slice(5, 10)
      const co = String(g.checkOut || '').slice(5, 10)
      const nights = ci && co ? Math.ceil((new Date(g.checkOut).getTime() - new Date(g.checkIn).getTime()) / 86400000) : 0
      const rate = g.totalRooms ? Math.round(g.totalAmount / Math.max(g.totalRooms, 1) / Math.max(nights, 1)) : 0
      return {
        id: g.id, name: g.name, contact: '', company: '', phone: '', email: '',
        checkIn: ci, checkOut: co, nights, rooms: g.totalRooms, guests: (g.totalRooms ?? 0) * 2,
        rate, total: g.totalAmount, deposit: 0, status: g.status || 'pending',
        tags: [], notes: g.notes || '',
      }
    })
  } catch { }
}
onMounted(loadData)

const newGroup = ref({
  name: '',
  contact: '',
  company: '',
  phone: '',
  email: '',
  checkIn: '',
  checkOut: '',
  rooms: 1,
  rate: 150,
  deposit: 0,
  eventType: '',
  notes: ''
})

const currentWeek = ref(new Date())
const currentWeekLabel = computed(() => {
  const start = new Date(currentWeek.value)
  start.setDate(start.getDate() - start.getDay() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.getDate()} ${start.toLocaleString('es', { month: 'short' })} — ${end.getDate()} ${end.toLocaleString('es', { month: 'short' })}`
})

const weekDays = computed(() => {
  const start = new Date(currentWeek.value)
  start.setDate(start.getDate() - start.getDay() + 1)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return {
      label: date.toLocaleString('es', { weekday: 'short' }),
      date: `${date.getDate()}/${date.getMonth() + 1}`
    }
  })
})

const prevWeek = () => {
  const d = new Date(currentWeek.value)
  d.setDate(d.getDate() - 7)
  currentWeek.value = d
}

const nextWeek = () => {
  const d = new Date(currentWeek.value)
  d.setDate(d.getDate() + 7)
  currentWeek.value = d
}

const isGroupActive = (group: any, day: string) => {
  if (!group.checkIn || !group.checkOut || !day) return false
  const d = new Date(day).getTime()
  const ci = new Date(group.checkIn).getTime()
  const co = new Date(group.checkOut).getTime()
  return d >= ci && d <= co
}

const getGroupDayClass = (group: any, day: string) => {
  const s = String(group.status).toLowerCase()
  if (s === 'confirmado' || s === 'confirmed') return 'bg-teal/20 text-teal'
  if (s === 'pendiente' || s === 'pending') return 'bg-gold/20 text-gold'
  return 'bg-gray-100 text-gray-500'
}

const statusClass = (status: string) => {
  const classes: Record<string, string> = {
    'Confirmado': 'bg-teal/10 text-teal',
    'Pendiente': 'bg-gold/10 text-gold',
    'Cancelado': 'bg-coral/10 text-coral'
  }
  return classes[status] || 'bg-surface text-text-muted'
}

const openViewGroup = (group: any) => {
  selectedGroup.value = group
  showViewModal.value = true
}

const openNewGroup = () => {
  newGroup.value = { name: '', contact: '', company: '', phone: '', email: '', checkIn: '', checkOut: '', rooms: 1, rate: 150, deposit: 0, eventType: '', notes: '' }
  showNewModal.value = true
}

const openEditGroup = (group: any) => {
  selectedGroup.value = group
  showNewModal.value = true
}

const createGroup = async () => {
  if (!newGroup.value.name) return
  try {
    const nights = Math.ceil((new Date(newGroup.value.checkOut || Date.now()).getTime() - new Date(newGroup.value.checkIn || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
    await OperationsService.grupos.create({
      name: newGroup.value.name,
      hotelId: hotelId.value,
      totalRooms: newGroup.value.rooms || 1,
      checkIn: newGroup.value.checkIn,
      checkOut: newGroup.value.checkOut,
      status: 'pending',
      totalAmount: (newGroup.value.rooms || 1) * (nights > 0 ? nights : 1) * (newGroup.value.rate || 0),
      notes: newGroup.value.email ? `Contacto: ${newGroup.value.contact} / ${newGroup.value.email}` : '',
    })
    showNewModal.value = false
    await loadData()
  } catch { toast.error('Error al crear grupo') }
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
