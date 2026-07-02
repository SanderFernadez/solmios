<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { GastosService, type Gasto } from '@/services/Gastos.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToast } from '@/composables/useToast'

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
  <div class="bg-white rounded-2xl border p-6">
    <div class="flex justify-between mb-6">
      <div>
        <h2 class="text-lg font-black">Gastos</h2>
        <p class="text-xs text-text-muted">{{ totalCount }} gastos · página ${{ pageTotal.toLocaleString() }}</p>
      </div>
      <button @click="openCreate" class="px-4 py-2 bg-navy text-white text-sm font-bold rounded-xl cursor-pointer">+ Nuevo</button>
    </div>

    <!-- Form create/edit -->
    <div v-if="showDialog" class="bg-surface rounded-xl p-4 mb-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-extrabold text-navy">{{ editingId ? 'Editar gasto' : 'Nuevo gasto' }}</h3>
        <button @click="showDialog = false" class="text-text-muted text-sm cursor-pointer hover:text-navy">✕</button>
      </div>
      <input v-model="form.concept" placeholder="Concepto" class="w-full px-3 py-2 rounded-lg border text-sm" />
      <div class="flex gap-3">
        <input v-model.number="form.amount" type="number" placeholder="Importe" class="w-32 px-3 py-2 rounded-lg border text-sm" />
        <select v-model="form.category" class="px-3 py-2 rounded-lg border text-sm">
          <option value="general">General</option><option value="supplies">Suministros</option>
          <option value="maintenance">Mantenimiento</option><option value="cleaning">Limpieza</option>
          <option value="staff">Personal</option><option value="marketing">Marketing</option>
        </select>
        <input v-model="form.provider" placeholder="Proveedor" class="flex-1 px-3 py-2 rounded-lg border text-sm" />
      </div>
      <input v-model="form.date" type="date" class="px-3 py-2 rounded-lg border text-sm" />
      <textarea v-model="form.notes" placeholder="Notas" class="w-full px-3 py-2 rounded-lg border text-sm" rows="2"></textarea>
      <div class="flex gap-2">
        <button @click="saveGasto" :disabled="submitting" class="px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar') }}</button>
        <button @click="showDialog = false" class="px-4 py-2 bg-surface text-text-secondary text-sm font-bold rounded-xl border cursor-pointer">Cancelar</button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full" v-if="gastos.length">
        <thead><tr class="border-b">
          <th class="text-left py-2 text-xs font-bold uppercase">Concepto</th>
          <th class="text-left py-2 text-xs font-bold uppercase">Categoría</th>
          <th class="text-right py-2 text-xs font-bold uppercase">Importe</th>
          <th class="text-left py-2 text-xs font-bold uppercase">Fecha</th>
          <th class="text-left py-2 text-xs font-bold uppercase">Proveedor</th>
          <th class="text-right py-2 text-xs font-bold uppercase">Acciones</th>
        </tr></thead>
        <tbody>
          <tr v-for="g in gastos" :key="g.id" class="border-b border-border/50">
            <td class="py-2 text-sm font-bold">{{ g.concept }}</td>
            <td class="py-2 text-xs">{{ g.category }}</td>
            <td class="py-2 text-sm text-right font-bold">${{ (g.amount || 0).toLocaleString() }}</td>
            <td class="py-2 text-xs text-text-muted">{{ (g.date || '').slice(0, 10) }}</td>
            <td class="py-2 text-xs">{{ g.provider || '—' }}</td>
            <td class="py-2 text-right whitespace-nowrap">
              <button @click="openEdit(g)" class="px-2 py-1 bg-navy/10 text-navy rounded-lg text-[10px] font-bold cursor-pointer hover:bg-navy/20 mr-1">Editar</button>
              <button @click="askDelete(g)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="text-center text-text-muted text-sm py-8">No hay gastos registrados</div>
      <div v-else class="text-center text-text-muted text-sm py-8">Cargando...</div>
    </div>

    <!-- Paginación -->
    <div v-if="pages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-border">
      <span class="text-xs text-text-muted">Página {{ page }} de {{ pages }}</span>
      <div class="flex gap-2">
        <button @click="goPrev" :disabled="page <= 1" class="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">‹ Anterior</button>
        <button @click="goNext" :disabled="page >= pages" class="px-3 py-1.5 bg-surface text-text-secondary rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">Siguiente ›</button>
      </div>
    </div>

    <!-- Modal confirmar eliminar -->
    <div v-if="confirmTarget" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="confirmTarget = null">
      <div class="bg-white rounded-2xl w-full max-w-sm p-6">
        <h3 class="text-lg font-black text-navy mb-2">Eliminar gasto</h3>
        <p class="text-sm text-text-secondary mb-1">¿Seguro que querés eliminar <strong>{{ confirmTarget.concept }}</strong> (${{ (confirmTarget.amount || 0).toLocaleString() }})?</p>
        <p class="text-xs text-text-muted mb-4">Esta acción no se puede deshacer.</p>
        <div class="flex gap-2">
          <button @click="confirmDelete" :disabled="deleting" class="flex-1 px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">{{ deleting ? 'Eliminando...' : 'Eliminar' }}</button>
          <button @click="confirmTarget = null" class="flex-1 px-4 py-2 bg-surface text-text-secondary text-sm font-bold rounded-xl border cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>
