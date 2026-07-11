<template>
  <div class="min-h-screen bg-surface">
    <!-- Header -->
    <div class="bg-white border-b border-border px-6 py-4">
      <div class="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-black text-navy">Ofertas</h1>
          <p class="text-xs text-text-muted">Paquetes y servicios adicionales para ofrecer a tus huéspedes</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold">
            {{ activeOffers.length }} {{ activeOffers.length === 1 ? 'oferta activa' : 'ofertas activas' }}
          </span>
          <button @click="openCreate()" class="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
            Nueva Oferta
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-6">
      <!-- KPIs — todos derivados del catálogo real -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
              <span class="w-5 h-5 text-navy" v-html="ICON_BOX"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none text-navy truncate">{{ combos.length }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Paquetes</div>
            </div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
              <span class="w-5 h-5 text-cyan" v-html="ICON_LAYERS"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none text-navy truncate">{{ servicios.length }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Servicios Adicionales</div>
            </div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
              <span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none text-teal truncate">${{ avgPrice.toLocaleString() }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Precio Promedio</div>
            </div>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
              <span class="w-5 h-5 text-navy" v-html="ICON_CHART"></span>
            </div>
            <div class="min-w-0">
              <div class="text-xl font-black leading-none text-navy truncate">${{ catalogValue.toLocaleString() }}</div>
              <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Valor del Catálogo</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-white rounded-xl p-1 border border-border mb-6 w-fit">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer"
          :class="activeTab === tab.id ? 'bg-navy text-white' : 'text-text-muted hover:bg-surface'"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loading" class="card p-12 text-center text-sm text-text-muted">Cargando ofertas...</div>

      <!-- Paquetes -->
      <div v-else-if="activeTab === 'combo'" class="grid md:grid-cols-3 gap-4">
        <div v-for="(offer, idx) in combos" :key="offer.id" class="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-md transition-shadow">
          <div class="h-32 bg-gradient-to-br" :class="gradientFor(idx)"></div>
          <div class="p-5">
            <div class="flex items-center justify-between mb-2 gap-2">
              <h3 class="text-sm font-black text-navy truncate">{{ offer.name }}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" :class="offer.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
                {{ offer.active ? 'Activa' : 'Inactiva' }}
              </span>
            </div>
            <p class="text-[10px] text-text-muted mb-3 whitespace-pre-line">{{ offer.description || 'Sin descripción' }}</p>
            <div v-if="offer.contents?.length" class="flex flex-wrap gap-1 mb-3">
              <span v-for="item in offer.contents" :key="item" class="text-[10px] px-2 py-0.5 rounded-full bg-navy/5 text-navy">{{ item }}</span>
            </div>
            <div class="mb-3">
              <span class="text-xl font-black text-navy">${{ offer.price.toLocaleString() }}</span>
            </div>
            <div class="flex gap-2">
              <button @click="openEdit(offer)" class="flex-1 flex items-center justify-center gap-1 py-2 bg-surface text-navy text-[10px] font-bold rounded-lg hover:bg-navy hover:text-white transition-all cursor-pointer">
                <span class="w-3 h-3 shrink-0" v-html="ICON_PENCIL"></span>
                Editar
              </button>
              <button @click="toggleActive(offer)" class="flex-1 flex items-center justify-center gap-1 py-2 bg-surface text-navy text-[10px] font-bold rounded-lg hover:bg-navy hover:text-white transition-all cursor-pointer">
                <span class="w-3 h-3 shrink-0" v-html="ICON_TOGGLE"></span>
                {{ offer.active ? 'Desactivar' : 'Activar' }}
              </button>
              <button @click="confirmTarget = offer" class="flex items-center justify-center py-2 px-2 bg-surface text-coral text-[10px] font-bold rounded-lg hover:bg-coral hover:text-white transition-all cursor-pointer" title="Eliminar">
                <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>
              </button>
            </div>
          </div>
        </div>

        <button @click="openCreate('combo')" class="bg-white rounded-2xl border-2 border-dashed border-border p-6 flex flex-col items-center justify-center min-h-[280px] hover:border-cyan transition-colors cursor-pointer">
          <div class="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-text-muted mb-3">
            <span class="w-6 h-6 shrink-0" v-html="ICON_PLUS"></span>
          </div>
          <div class="text-sm font-bold text-text-muted">Crear Paquete</div>
        </button>
      </div>

      <!-- Servicios adicionales -->
      <div v-else-if="activeTab === 'servicio'" class="bg-white rounded-2xl border border-border p-6">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 class="text-lg font-black text-navy">Servicios Adicionales</h2>
          <button @click="openCreate('servicio')" class="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer">
            <span class="w-3.5 h-3.5 shrink-0" v-html="ICON_PLUS"></span>
            Nuevo Servicio
          </button>
        </div>
        <div v-if="servicios.length === 0" class="text-center py-12">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_TAG"></span>
          <h3 class="font-bold text-navy mb-1">Sin servicios adicionales</h3>
          <p class="text-xs text-text-muted">Agregá extras sueltos para ofrecer a los huéspedes.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Servicio</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Incluye</th>
                <th class="text-right py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Precio</th>
                <th class="text-left py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</th>
                <th class="text-right py-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="offer in servicios" :key="offer.id" class="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td class="py-3">
                  <div class="text-sm font-bold text-navy">{{ offer.name }}</div>
                  <div class="text-[10px] text-text-muted">{{ offer.description }}</div>
                </td>
                <td class="py-3">
                  <span v-if="!offer.contents?.length" class="text-[10px] text-text-muted">—</span>
                  <div v-else class="flex flex-wrap gap-1">
                    <span v-for="item in offer.contents" :key="item" class="text-[10px] px-2 py-0.5 rounded-full bg-navy/5 text-navy">{{ item }}</span>
                  </div>
                </td>
                <td class="py-3 text-sm font-bold text-navy text-right">${{ offer.price.toLocaleString() }}</td>
                <td class="py-3">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" :class="offer.active ? 'bg-teal/10 text-teal' : 'bg-surface text-text-muted'">
                    {{ offer.active ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="py-3 text-right whitespace-nowrap">
                  <button @click="openEdit(offer)" class="inline-flex items-center gap-1 text-[10px] font-bold text-cyan hover:underline cursor-pointer mr-3">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_PENCIL"></span>
                    Editar
                  </button>
                  <button @click="toggleActive(offer)" class="inline-flex items-center gap-1 text-[10px] font-bold text-navy hover:underline cursor-pointer mr-3">
                    {{ offer.active ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button @click="confirmTarget = offer" class="inline-flex items-center gap-1 text-[10px] font-bold text-coral hover:underline cursor-pointer">
                    <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal crear / editar -->
    <Teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h2 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0" v-html="ICON_PLUS"></span>
              {{ editingId ? 'Editar Oferta' : 'Nueva Oferta' }}
            </h2>
            <button @click="showDialog = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Nombre</label>
              <input v-model="form.name" type="text" placeholder="Ej: Fin de semana romántico" class="w-full h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan" />
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Descripción</label>
              <textarea v-model="form.description" rows="2" class="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan resize-none"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Precio</label>
                <input v-model.number="form.price" type="number" min="0" step="0.01" placeholder="0.00" class="w-full h-10 px-4 rounded-xl border border-border text-sm text-right font-bold focus:outline-none focus:border-cyan" />
              </div>
              <div>
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Tipo</label>
                <select v-model="form.type" class="w-full h-10 px-4 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-cyan">
                  <option value="combo">Paquete</option>
                  <option value="servicio">Servicio adicional</option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-2 block">Incluye</label>
              <div class="flex gap-2 mb-2">
                <input
                  v-model="newItem"
                  @keyup.enter="addItem"
                  type="text"
                  placeholder="Ej: Desayuno para dos"
                  class="flex-1 h-10 px-4 rounded-xl border border-border text-sm focus:outline-none focus:border-cyan"
                />
                <button @click="addItem" class="px-4 rounded-xl bg-surface text-navy text-sm font-bold hover:bg-navy hover:text-white transition-all cursor-pointer">Agregar</button>
              </div>
              <div v-if="form.contents.length === 0" class="text-[11px] text-text-muted">Todavía no agregaste nada.</div>
              <div v-else class="flex flex-wrap gap-2">
                <span v-for="(item, idx) in form.contents" :key="idx" class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-navy/5 text-navy">
                  {{ item }}
                  <button @click="form.contents.splice(idx, 1)" class="text-text-muted hover:text-coral cursor-pointer">
                    <span class="w-3 h-3 block" v-html="ICON_X"></span>
                  </button>
                </span>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model.number="form.active" type="checkbox" :true-value="1" :false-value="0" class="w-4 h-4 accent-navy cursor-pointer" />
              <span class="text-sm font-bold text-navy">Activa</span>
            </label>
          </div>
          <div class="flex gap-3 mt-6">
            <button @click="showDialog = false" class="flex-1 py-2.5 bg-surface text-navy text-sm font-bold rounded-xl hover:bg-navy hover:text-white transition-all cursor-pointer">
              Cancelar
            </button>
            <button @click="save" :disabled="submitting" class="flex-1 py-2.5 bg-navy text-white text-sm font-bold rounded-xl hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">
              {{ submitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirmar borrado -->
    <Teleport to="body">
      <div v-if="confirmTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <h2 class="text-lg font-black text-navy mb-2">Eliminar oferta</h2>
          <p class="text-sm text-text-secondary mb-5">
            ¿Seguro que querés eliminar <strong>{{ confirmTarget.name }}</strong>? No se puede deshacer.
          </p>
          <div class="flex gap-3">
            <button @click="confirmTarget = null" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="remove" :disabled="deleting" class="flex-1 py-2.5 bg-coral text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">
              {{ deleting ? 'Eliminando...' : 'Eliminar' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { PackagesService, offerType, type Offer, type OfferType } from '@/services/Packages.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_PENCIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>'
const ICON_TOGGLE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_BOX = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5 12 12m0 0L3.75 7.5M12 12v9m8.25-4.5V7.279a1.5 1.5 0 0 0-.75-1.299l-7.5-4.333a1.5 1.5 0 0 0-1.5 0L3 5.98a1.5 1.5 0 0 0-.75 1.3v8.442a1.5 1.5 0 0 0 .75 1.3l7.5 4.332a1.5 1.5 0 0 0 1.5 0l7.5-4.333a1.5 1.5 0 0 0 .75-1.299Z"/></svg>'
const ICON_LAYERS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Zm-8.5 8 8.5 4.5 8.5-4.5m-17 4 8.5 4.5 8.5-4.5"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CHART = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4"/></svg>'
const ICON_TAG = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.5 9.5a2.25 2.25 0 0 0 3.182 0l4.318-4.318a2.25 2.25 0 0 0 0-3.182l-9.5-9.5A2.25 2.25 0 0 0 9.568 3Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75Z"/></svg>'

const GRADIENTS = ['from-pink-400 to-rose-500', 'from-cyan to-teal', 'from-navy to-navy-light', 'from-blue to-cyan', 'from-purple to-indigo']
const gradientFor = (idx: number) => GRADIENTS[idx % GRADIENTS.length]

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const tabs: Array<{ id: OfferType; label: string }> = [
  { id: 'combo', label: 'Paquetes' },
  { id: 'servicio', label: 'Servicios adicionales' },
]

const offers = ref<Offer[]>([])
const loading = ref(false)
const submitting = ref(false)
const deleting = ref(false)
const activeTab = ref<'combo' | 'servicio'>('combo')
const showDialog = ref(false)
const editingId = ref<string | null>(null)
const confirmTarget = ref<Offer | null>(null)
const newItem = ref('')

const emptyForm = () => ({
  name: '',
  description: '',
  price: 0,
  type: 'combo' as OfferType,
  contents: [] as string[],
  active: 1,
})
const form = reactive(emptyForm())

const combos = computed(() => offers.value.filter((o) => offerType(o.type) === 'combo'))
const servicios = computed(() => offers.value.filter((o) => offerType(o.type) === 'servicio'))
const activeOffers = computed(() => offers.value.filter((o) => o.active))
const catalogValue = computed(() => offers.value.reduce((sum, o) => sum + (o.price || 0), 0))
const avgPrice = computed(() => (offers.value.length ? Math.round(catalogValue.value / offers.value.length) : 0))

onMounted(loadData)

async function loadData() {
  loading.value = true
  try {
    const r = await PackagesService.list(hotelId.value)
    offers.value = (r.data || []).map((o) => ({ ...o, contents: normalizeContents(o.contents) }))
  } catch (e: unknown) {
    toast.error('No se pudieron cargar las ofertas', e instanceof Error ? e.message : undefined)
  } finally {
    loading.value = false
  }
}

/** Las filas viejas guardaron `contents` como lista de objetos `{ label }`. */
function normalizeContents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === 'string' ? item : (item as { label?: string })?.label ?? ''))
    .filter(Boolean)
}

function openCreate(type: OfferType = 'combo') {
  Object.assign(form, emptyForm(), { type })
  editingId.value = null
  newItem.value = ''
  showDialog.value = true
}

function openEdit(offer: Offer) {
  Object.assign(form, {
    name: offer.name,
    description: offer.description ?? '',
    price: offer.price ?? 0,
    type: offerType(offer.type),
    contents: [...(offer.contents ?? [])],
    active: offer.active ? 1 : 0,
  })
  editingId.value = offer.id ?? null
  newItem.value = ''
  showDialog.value = true
}

function addItem() {
  const value = newItem.value.trim()
  if (!value || form.contents.includes(value)) return
  form.contents.push(value)
  newItem.value = ''
}

async function save() {
  if (!form.name.trim()) {
    toast.error('El nombre es obligatorio')
    return
  }
  if (form.price < 0) {
    toast.error('El precio no puede ser negativo')
    return
  }
  submitting.value = true
  try {
    const payload = { ...form, name: form.name.trim(), hotelId: hotelId.value }
    if (editingId.value) {
      await PackagesService.update(editingId.value, payload)
      toast.success('Oferta actualizada')
    } else {
      await PackagesService.create(payload as Omit<Offer, 'id'>)
      toast.success('Oferta creada')
    }
    showDialog.value = false
    await loadData()
  } catch (e: unknown) {
    toast.error('No se pudo guardar la oferta', e instanceof Error ? e.message : undefined)
  } finally {
    submitting.value = false
  }
}

async function toggleActive(offer: Offer) {
  if (!offer.id) return
  try {
    await PackagesService.update(offer.id, { active: offer.active ? 0 : 1 })
    await loadData()
  } catch (e: unknown) {
    toast.error('No se pudo cambiar el estado', e instanceof Error ? e.message : undefined)
  }
}

async function remove() {
  const target = confirmTarget.value
  if (!target?.id) return
  deleting.value = true
  try {
    await PackagesService.remove(target.id, hotelId.value)
    toast.success('Oferta eliminada')
    confirmTarget.value = null
    await loadData()
  } catch (e: unknown) {
    toast.error('No se pudo eliminar la oferta', e instanceof Error ? e.message : undefined)
  } finally {
    deleting.value = false
  }
}
</script>
