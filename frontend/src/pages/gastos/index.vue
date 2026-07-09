<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { GastosService, type Gasto, type ExpensePaymentMethod } from '@/services/Gastos.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

const ICON_RECEIPT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_PENCIL = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_ALERT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"/></svg>'

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General',
  supplies: 'Suministros',
  maintenance: 'Mantenimiento',
  cleaning: 'Limpieza',
  staff: 'Personal',
  marketing: 'Marketing',
  utilities: 'Servicios',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
}

const auth = useAuthStore()
const toast = useToast()
const hotelId = computed(() => (auth.user?.hotelId && auth.user.hotelId !== 'platform' ? auth.user.hotelId : undefined))

const gastos = ref<Gasto[]>([])
const loading = ref(false)
const showDialog = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pages = ref(1)
const totalCount = ref(0)
const LIMIT = 20
const confirmTarget = ref<Gasto | null>(null)
const deleting = ref(false)

const emptyForm = () => ({
  concept: '',
  amount: 0,
  category: 'general',
  provider: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  paid: 0,
  paymentMethod: 'cash' as ExpensePaymentMethod,
})
const form = ref(emptyForm())

// Un gasto pagado en efectivo sale del cajón y aparece en el arqueo del turno.
const movesCash = computed(() => form.value.paid === 1 && form.value.paymentMethod === 'cash')

onMounted(() => loadData())

async function loadData(p = page.value) {
  loading.value = true
  try {
    const r = await GastosService.list(hotelId.value, p, LIMIT)
    gastos.value = r.data || []
    totalCount.value = r.total ?? 0
    pages.value = r.pages ?? 1
    page.value = p
  } catch (e: unknown) {
    toast.error('No se pudieron cargar los gastos', e instanceof Error ? e.message : undefined)
  } finally {
    loading.value = false
  }
}

// Suma de importes de la página visible (el total global es un count, no una suma de montos).
const pageTotal = computed(() => gastos.value.reduce((s, g) => s + (g.amount || 0), 0))

function openCreate() {
  form.value = emptyForm()
  editingId.value = null
  showDialog.value = true
}

function openEdit(g: Gasto) {
  form.value = {
    concept: g.concept || '',
    amount: g.amount || 0,
    category: g.category || 'general',
    provider: g.provider || '',
    date: (g.date || '').slice(0, 10) || new Date().toISOString().split('T')[0],
    notes: g.notes || '',
    paid: Number(g.paid) === 1 ? 1 : 0,
    paymentMethod: g.paymentMethod || 'cash',
  }
  editingId.value = g.id ?? null
  showDialog.value = true
}

async function saveGasto() {
  if (!form.value.concept || !form.value.amount) {
    toast.error('Completa concepto e importe')
    return
  }
  submitting.value = true
  try {
    if (editingId.value) {
      await GastosService.update(editingId.value, { ...form.value })
      toast.success('Gasto actualizado')
    } else {
      await GastosService.create({ ...form.value, hotelId: hotelId.value } as Omit<Gasto, 'id'>)
      toast.success('Gasto creado')
    }
    showDialog.value = false
    await loadData(editingId.value ? page.value : 1)
  } catch (e: unknown) {
    toast.error('No se pudo guardar el gasto', e instanceof Error ? e.message : undefined)
  } finally {
    submitting.value = false
  }
}

function askDelete(g: Gasto) {
  confirmTarget.value = g
}

async function confirmDelete() {
  if (!confirmTarget.value?.id) return
  deleting.value = true
  try {
    await GastosService.remove(confirmTarget.value.id, hotelId.value)
    toast.success('Gasto eliminado')
    confirmTarget.value = null
    // Si era el único de la página y no es la primera, retroceder una página.
    if (gastos.value.length === 1 && page.value > 1) await loadData(page.value - 1)
    else await loadData()
  } catch (e: unknown) {
    toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined)
  } finally {
    deleting.value = false
  }
}

function goPrev() { if (page.value > 1) loadData(page.value - 1) }
function goNext() { if (page.value < pages.value) loadData(page.value + 1) }
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="text-xl font-black text-navy">Gastos</h2>
        <p class="text-xs text-text-muted mt-0.5">Egresos operativos del hotel — suministros, mantenimiento, personal y más</p>
      </div>
      <button @click="openCreate" class="flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo gasto
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_RECEIPT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy">{{ totalCount }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Gastos registrados</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10">
            <span class="w-5 h-5 text-coral" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-coral truncate">${{ pageTotal.toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total (página)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card p-6">
      <div class="overflow-x-auto">
        <table class="w-full" v-if="gastos.length">
          <thead><tr class="border-b bg-surface/50">
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Concepto</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Categoría</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Importe</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Pago</th>
            <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Proveedor</th>
            <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="g in gastos" :key="g.id" class="border-b border-border/50 last:border-0">
              <td class="p-3 text-sm font-bold text-navy">{{ g.concept }}</td>
              <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-navy/5 text-navy">{{ CATEGORY_LABEL[g.category || ''] || g.category || '—' }}</span></td>
              <td class="p-3 text-sm text-right font-black text-coral">${{ (g.amount || 0).toLocaleString() }}</td>
              <td class="p-3 text-xs text-text-muted">{{ (g.date || '').slice(0, 10) }}</td>
              <td class="p-3 text-xs whitespace-nowrap">
                <span v-if="Number(g.paid) === 1" class="text-[10px] font-bold px-2 py-1 rounded-full bg-navy/5 text-navy">
                  {{ PAYMENT_METHOD_LABEL[g.paymentMethod || 'other'] }}
                </span>
                <span v-else class="text-[10px] font-bold px-2 py-1 rounded-full bg-coral/10 text-coral">Impago</span>
              </td>
              <td class="p-3 text-xs">{{ g.provider || '—' }}</td>
              <td class="p-3 text-right whitespace-nowrap">
                <button @click="openEdit(g)" class="inline-flex items-center gap-1 px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20 mr-1">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_PENCIL"></span>
                  Editar
                </button>
                <button @click="askDelete(g)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">
                  <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!loading" class="text-center py-12">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_RECEIPT"></span>
          <h3 class="font-bold text-navy mb-1">Sin gastos registrados</h3>
          <p class="text-xs text-text-muted">Registra un gasto para empezar a llevar el control de egresos.</p>
        </div>
        <div v-else class="text-center text-text-muted text-sm py-10">Cargando...</div>
      </div>

      <!-- Paginación -->
      <div v-if="pages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <span class="text-xs text-text-muted">Página {{ page }} de {{ pages }}</span>
        <div class="flex gap-2">
          <button @click="goPrev" :disabled="page <= 1" class="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">‹ Anterior</button>
          <button @click="goNext" :disabled="page >= pages" class="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">Siguiente ›</button>
        </div>
      </div>
    </div>

    <!-- Modal crear/editar gasto -->
    <Teleport to="body">
      <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showDialog = false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0" v-html="editingId ? ICON_PENCIL : ICON_PLUS"></span>
              {{ editingId ? 'Editar gasto' : 'Nuevo gasto' }}
            </h3>
            <button @click="showDialog = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Concepto</label>
              <input v-model="form.concept" placeholder="Ej: Compra de detergentes" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div class="flex gap-3">
              <div class="w-28 shrink-0">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Importe</label>
                <input v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
              </div>
              <div class="w-36 shrink-0">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Categoría</label>
                <select v-model="form.category" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                  <option value="general">General</option><option value="supplies">Suministros</option>
                  <option value="maintenance">Mantenimiento</option><option value="cleaning">Limpieza</option>
                  <option value="staff">Personal</option><option value="marketing">Marketing</option>
                  <option value="utilities">Servicios</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Proveedor</label>
                <input v-model="form.provider" placeholder="Opcional" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Fecha</label>
                <input v-model="form.date" type="date" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div class="flex-1">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Método de pago</label>
                <select v-model="form.paymentMethod" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                  <option value="cash">Efectivo</option><option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option><option value="other">Otro</option>
                </select>
              </div>
            </div>
            <div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model.number="form.paid" type="checkbox" :true-value="1" :false-value="0" class="w-4 h-4 accent-navy cursor-pointer" />
                <span class="text-sm font-bold text-navy">Ya está pagado</span>
              </label>
              <p v-if="movesCash" class="text-[11px] text-text-muted mt-1.5 pl-6">
                Sale del cajón: se registra como egreso en el arqueo del turno abierto.
              </p>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Notas</label>
              <textarea v-model="form.notes" placeholder="Opcional" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" rows="2"></textarea>
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button @click="showDialog = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="saveGasto" :disabled="submitting" class="flex-1 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal confirmar eliminar -->
    <Teleport to="body">
      <div v-if="confirmTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="confirmTarget = null">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div class="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center mb-4">
            <span class="w-6 h-6 text-coral" v-html="ICON_ALERT"></span>
          </div>
          <h3 class="text-lg font-black text-navy mb-2">Eliminar gasto</h3>
          <p class="text-sm text-text-secondary mb-1">¿Seguro que querés eliminar <strong>{{ confirmTarget.concept }}</strong> (${{ (confirmTarget.amount || 0).toLocaleString() }})?</p>
          <p class="text-xs text-text-muted mb-4">Esta acción no se puede deshacer.</p>
          <div class="flex gap-2">
            <button @click="confirmTarget = null" class="flex-1 px-4 py-2 bg-surface text-text-secondary text-sm font-bold rounded-xl border cursor-pointer">Cancelar</button>
            <button @click="confirmDelete" :disabled="deleting" class="flex-1 px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">{{ deleting ? 'Eliminando...' : 'Eliminar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped></style>
