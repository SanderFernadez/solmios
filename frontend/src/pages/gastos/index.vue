<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { GastosService, type Gasto } from '@/services/Gastos.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'
import { useCountUp } from '@/composables/useCountUp'

const ICON_RECEIPT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
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
})
const form = ref(emptyForm())

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
const totalCountAnim = useCountUp(totalCount)
const pageTotalAnim = useCountUp(pageTotal)

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
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Gastos</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-xs text-text-muted mt-0.5">Egresos operativos del hotel — suministros, mantenimiento, personal y más</p>
      </div>
      <button @click="openCreate" class="flex items-center gap-1.5 bg-navy text-white text-sm font-extrabold px-5 py-2.5 rounded-full cursor-pointer hover:shadow-lg transition-all">
        <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
        Nuevo gasto
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-4">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_RECEIPT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy">{{ Math.round(totalCountAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Gastos registrados</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-coral/10">
            <span class="w-5 h-5 text-coral" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-coral truncate">${{ Math.round(pageTotalAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Total (página)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full" v-if="gastos.length">
          <thead><tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Concepto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Categoría</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Importe</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Proveedor</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acciones</th>
          </tr></thead>
          <tbody>
            <tr v-for="g in gastos" :key="g.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
              <td class="p-4 text-sm font-bold text-navy">{{ g.concept }}</td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full bg-navy/5 text-navy">{{ CATEGORY_LABEL[g.category || ''] || g.category || '—' }}</span></td>
              <td class="p-4 text-sm text-right font-black text-coral">${{ (g.amount || 0).toLocaleString() }}</td>
              <td class="p-4 text-xs text-text-muted">{{ (g.date || '').slice(0, 10) }}</td>
              <td class="p-4 text-xs">{{ g.provider || '—' }}</td>
              <td class="p-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-4">
                  <button @click="openEdit(g)" class="text-[11px] font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Editar</button>
                  <button @click="askDelete(g)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Eliminar</button>
                </div>
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
      <div v-if="pages > 1" class="flex items-center justify-between p-4 border-t border-border">
        <span class="text-[10px] text-text-muted font-bold">Página {{ page }} de {{ pages }}</span>
        <div class="flex items-center gap-1">
          <button @click="goPrev" :disabled="page <= 1" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">‹</button>
          <button @click="goNext" :disabled="page >= pages" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">›</button>
        </div>
      </div>
    </div>

    <!-- Modal crear/editar gasto -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showDialog = false">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">{{ editingId ? 'Editar Gasto' : 'Nuevo Gasto' }}</h3>
              <button @click="showDialog = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Concepto</label>
                <input v-model="form.concept" placeholder="Ej: Compra de detergentes" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Importe</label>
                  <input v-model.number="form.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
                </div>
                <div class="col-span-2">
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Categoría</label>
                  <select v-model="form.category" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                    <option value="general">General</option><option value="supplies">Suministros</option>
                    <option value="maintenance">Mantenimiento</option><option value="cleaning">Limpieza</option>
                    <option value="staff">Personal</option><option value="marketing">Marketing</option>
                    <option value="utilities">Servicios</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Proveedor</label>
                <input v-model="form.provider" placeholder="Opcional" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Fecha</label>
                <input v-model="form.date" type="date" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Notas</label>
                <textarea v-model="form.notes" placeholder="Opcional" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy resize-none" rows="2"></textarea>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showDialog = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="saveGasto" :disabled="submitting" class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:bg-navy-light transition-colors cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar') }}</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal confirmar eliminar -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="confirmTarget = null">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div class="text-center mb-4">
              <div class="w-11 h-11 mx-auto mb-2 rounded-full bg-coral/10 flex items-center justify-center">
                <span class="w-5 h-5 text-coral" v-html="ICON_ALERT"></span>
              </div>
              <h3 class="text-lg font-black text-navy">Eliminar Gasto</h3>
              <p class="text-sm text-text-secondary mt-2">¿Seguro que querés eliminar <strong>{{ confirmTarget.concept }}</strong> (${{ (confirmTarget.amount || 0).toLocaleString() }})?</p>
              <p class="text-xs text-text-muted mt-1">Esta acción no se puede deshacer.</p>
            </div>
            <div class="flex items-center justify-center gap-4">
              <button @click="confirmTarget = null" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
              <button @click="confirmDelete" :disabled="deleting" class="rounded-full bg-coral text-white text-sm font-extrabold px-5 py-2.5 hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">{{ deleting ? 'Eliminando...' : 'Eliminar' }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

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
