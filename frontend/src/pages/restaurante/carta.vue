<script setup lang="ts">
// pages/restaurante/carta.vue — Administración de la carta del POS: estaciones (pantallas KDS),
// categorías (ruteadas a una estación) e ítems. RES-7. CRUD vía RestaurantService (sin fetch directo).
import { ref, computed, onMounted } from 'vue'
import {
  RestaurantService,
  type Station, type MenuCategory, type MenuItem,
} from '@/services/Restaurant.service'
import { SettingsService } from '@/services/Settings.service'
import { InventarioService, type InventoryItem, type MenuItemRecipe } from '@/services/Inventario.service'
import { currencySymbol } from '@/composables/useCurrency'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'

const toast = useToast()
const { can } = usePermissions()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onDone: () => toast.success('Eliminado'),
  onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'),
})

const loading = ref(true)
const saving = ref(false)
const stations = ref<Station[]>([])
const categories = ref<MenuCategory[]>([])
const items = ref<MenuItem[]>([])
const inventory = ref<InventoryItem[]>([])
const currency = ref('USD')
const activeCategoryId = ref<string>('all')

// La carta (estaciones/categorías/ítems/recetas) es config, no operación del POS — gateada por
// 'restaurant-catalog' (QA-ALTO: separado de 'restaurant' para que mesero/cocina no la editen).
const editPerm = computed(() => can('restaurant-catalog', 'edit'))
const createPerm = computed(() => can('restaurant-catalog', 'create'))
const deletePerm = computed(() => can('restaurant-catalog', 'delete'))

const stationName = (id?: string): string => stations.value.find((s) => s.id === id)?.name || 'Sin estación'
const categoryName = (id: string): string => categories.value.find((c) => c.id === id)?.name || '—'
const money = (n: number): string => `${currencySymbol(currency.value)}${Number(n || 0).toFixed(2)}`

const filteredItems = computed(() =>
  activeCategoryId.value === 'all' ? items.value : items.value.filter((i) => i.categoryId === activeCategoryId.value),
)

async function load() {
  loading.value = true
  try {
    const [st, cat, it, inv, settings] = await Promise.all([
      RestaurantService.listStations(),
      RestaurantService.listCategories(),
      RestaurantService.listItems(),
      InventarioService.listItems().catch(() => [] as InventoryItem[]),
      SettingsService.get().catch(() => null),
    ])
    stations.value = st.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    categories.value = cat.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    items.value = it.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    inventory.value = inv
    currency.value = (settings as any)?.hotel?.currency || 'USD'
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar la carta')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ─── Modal genérico ───
const modal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: Record<string, string | number>) => Promise<void> } | null>(null)

function stationOptions(includeNone = true) {
  const opts = stations.value.map((s) => ({ value: s.id, label: s.name }))
  return includeNone ? [{ value: '', label: 'Sin estación' }, ...opts] : opts
}

// ─── Estaciones ───
function newStation() {
  modal.value = {
    title: 'Nueva estación', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre (ej: Cocina, Bar)', required: true, minLength: 2, maxLength: 60 },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0, hint: 'Orden de aparición en el KDS' },
      { key: 'active', label: 'Activa', type: 'select', default: '1', options: [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }] },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.createStation({ name: String(v.name).trim(), sortOrder: Number(v.sortOrder) || 0, active: Number(v.active) }))
    },
  }
}
function editStation(s: Station) {
  modal.value = {
    title: 'Editar estación', submitLabel: 'Guardar',
    fields: [
      { key: 'name', label: 'Nombre', required: true, minLength: 2, maxLength: 60, default: s.name },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0, default: s.sortOrder ?? 0 },
      { key: 'active', label: 'Activa', type: 'select', default: String(s.active ?? 1), options: [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }] },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.updateStation(s.id, { name: String(v.name).trim(), sortOrder: Number(v.sortOrder) || 0, active: Number(v.active) }))
    },
  }
}
function delStation(s: Station) {
  askConfirm({
    title: 'Eliminar estación', message: `¿Eliminar "${s.name}"? Las categorías/ítems que la usan caen al ruteo por defecto.`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => { await RestaurantService.deleteStation(s.id); await load() },
  })
}

// ─── Categorías ───
function newCategory() {
  modal.value = {
    title: 'Nueva categoría', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre (ej: Entradas, Bebidas)', required: true, minLength: 2, maxLength: 60 },
      { key: 'stationId', label: 'Estación (ruteo KDS)', type: 'select', options: stationOptions(), hint: 'A dónde van los platos de esta categoría' },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0 },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.createCategory({ name: String(v.name).trim(), stationId: v.stationId ? String(v.stationId) : undefined, sortOrder: Number(v.sortOrder) || 0 }))
    },
  }
}
function editCategory(c: MenuCategory) {
  modal.value = {
    title: 'Editar categoría', submitLabel: 'Guardar',
    fields: [
      { key: 'name', label: 'Nombre', required: true, minLength: 2, maxLength: 60, default: c.name },
      { key: 'stationId', label: 'Estación (ruteo KDS)', type: 'select', default: c.stationId ?? '', options: stationOptions() },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0, default: c.sortOrder ?? 0 },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.updateCategory(c.id, { name: String(v.name).trim(), stationId: v.stationId ? String(v.stationId) : undefined, sortOrder: Number(v.sortOrder) || 0 }))
    },
  }
}
function delCategory(c: MenuCategory) {
  askConfirm({
    title: 'Eliminar categoría', message: `¿Eliminar "${c.name}"? Solo se puede si no tiene ítems.`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => { await RestaurantService.deleteCategory(c.id); await load() },
  })
}

// ─── Ítems ───
function newItem() {
  if (!categories.value.length) { toast.warning('Creá una categoría primero'); return }
  modal.value = {
    title: 'Nuevo ítem', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre del plato', required: true, minLength: 2, maxLength: 120 },
      { key: 'categoryId', label: 'Categoría', type: 'select', required: true, default: categories.value[0]?.id, options: categories.value.map((c) => ({ value: c.id, label: c.name })) },
      { key: 'price', label: 'Precio', type: 'number', required: true, min: 0 },
      { key: 'description', label: 'Descripción', type: 'textarea', maxLength: 300 },
      { key: 'stationId', label: 'Estación (override)', type: 'select', options: stationOptions(), hint: 'Vacío = hereda de la categoría' },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0 },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.createItem({
        name: String(v.name).trim(), categoryId: String(v.categoryId), price: Number(v.price) || 0,
        description: v.description ? String(v.description) : undefined,
        stationId: v.stationId ? String(v.stationId) : undefined, sortOrder: Number(v.sortOrder) || 0,
      }))
    },
  }
}
function editItem(i: MenuItem) {
  modal.value = {
    title: 'Editar ítem', submitLabel: 'Guardar',
    fields: [
      { key: 'name', label: 'Nombre del plato', required: true, minLength: 2, maxLength: 120, default: i.name },
      { key: 'categoryId', label: 'Categoría', type: 'select', required: true, default: i.categoryId, options: categories.value.map((c) => ({ value: c.id, label: c.name })) },
      { key: 'price', label: 'Precio', type: 'number', required: true, min: 0, default: i.price },
      { key: 'description', label: 'Descripción', type: 'textarea', maxLength: 300, default: i.description ?? '' },
      { key: 'stationId', label: 'Estación (override)', type: 'select', default: i.stationId ?? '', options: stationOptions() },
      { key: 'sortOrder', label: 'Orden', type: 'number', min: 0, default: i.sortOrder ?? 0 },
    ],
    onSubmit: async (v) => {
      await save(() => RestaurantService.updateItem(i.id, {
        name: String(v.name).trim(), categoryId: String(v.categoryId), price: Number(v.price) || 0,
        description: v.description ? String(v.description) : undefined,
        stationId: v.stationId ? String(v.stationId) : undefined, sortOrder: Number(v.sortOrder) || 0,
      }))
    },
  }
}
async function toggleAvailability(i: MenuItem) {
  try {
    await RestaurantService.setItemAvailability(i.id, i.available ? 0 : 1)
    await load()
  } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'No se pudo cambiar') }
}
function delItem(i: MenuItem) {
  askConfirm({
    title: 'Eliminar ítem', message: `¿Eliminar "${i.name}"?`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => { await RestaurantService.deleteItem(i.id); await load() },
  })
}

async function save(fn: () => Promise<unknown>) {
  saving.value = true
  try {
    await fn()
    toast.success('Guardado')
    modal.value = null
    await load()
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
  } finally {
    saving.value = false
  }
}

// ─── Recetas (BOM) — consumo de insumos por venta (INT-1) ───
// Solo se ofrece si hay inventario cargado. Cada línea = insumo + cantidad consumida por unidad vendida.
const recipeItem = ref<MenuItem | null>(null)
const recipeLines = ref<MenuItemRecipe[]>([])
const loadingRecipe = ref(false)
const newRecipe = ref<{ inventoryItemId: string; quantity: number | string }>({ inventoryItemId: '', quantity: 1 })
const invName = (id: string): string => inventory.value.find((i) => i.id === id)?.name || 'Insumo'
const invUnit = (id: string): string => inventory.value.find((i) => i.id === id)?.unit || ''

async function openRecipe(i: MenuItem) {
  recipeItem.value = i
  newRecipe.value = { inventoryItemId: '', quantity: 1 }
  loadingRecipe.value = true
  recipeLines.value = []
  try {
    recipeLines.value = await InventarioService.listRecipes(i.id)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar la receta')
  } finally {
    loadingRecipe.value = false
  }
}
async function addRecipeLine() {
  if (!recipeItem.value) return
  if (!newRecipe.value.inventoryItemId) { toast.warning('Elegí un insumo'); return }
  const qty = Number(newRecipe.value.quantity)
  if (!(qty > 0)) { toast.warning('Cantidad inválida'); return }
  try {
    await InventarioService.setRecipe({ menuItemId: recipeItem.value.id, inventoryItemId: newRecipe.value.inventoryItemId, quantity: qty })
    toast.success('Receta actualizada')
    newRecipe.value = { inventoryItemId: '', quantity: 1 }
    recipeLines.value = await InventarioService.listRecipes(recipeItem.value.id)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
  }
}
async function removeRecipeLine(r: MenuItemRecipe) {
  if (!recipeItem.value) return
  try {
    await InventarioService.setRecipe({ menuItemId: r.menuItemId, inventoryItemId: r.inventoryItemId, quantity: 0 })
    recipeLines.value = await InventarioService.listRecipes(recipeItem.value.id)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo quitar')
  }
}
// Insumos activos y aún no usados en esta receta (evita duplicar líneas y ofrecer insumos discontinuados).
const availableInventory = computed(() => {
  const used = new Set(recipeLines.value.map((r) => r.inventoryItemId))
  return inventory.value.filter((i) => i.active !== 0 && !used.has(i.id))
})

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
    <header class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-navy">Carta del restaurante</h1>
        <p class="text-sm text-text-muted mt-0.5">Estaciones, categorías e ítems del POS.</p>
      </div>
    </header>

    <div v-if="loading" class="py-20 text-center text-text-muted">Cargando…</div>

    <template v-else>
      <!-- Estaciones -->
      <SectionCard title="Estaciones (pantallas KDS)" subtitle="Cocina, Bar, etc. Cada categoría rutea a una estación.">
        <template #actions>
          <button v-if="createPerm" @click="newStation" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25">
            <span class="w-3.5 h-3.5" v-html="ICON_PLUS" /> Nueva
          </button>
        </template>
        <EmptyState v-if="!stations.length" title="Sin estaciones" message="Creá al menos una (ej: Cocina) para rutear la carta." />
        <div v-else class="divide-y divide-border">
          <div v-for="s in stations" :key="s.id" class="flex items-center justify-between py-2.5">
            <div class="flex items-center gap-2">
              <span class="font-bold text-navy">{{ s.name }}</span>
              <span v-if="!s.active" class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted font-bold">Inactiva</span>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="editPerm" @click="editStation(s)" class="text-xs font-bold text-navy hover:underline">Editar</button>
              <button v-if="deletePerm" @click="delStation(s)" class="text-xs font-bold text-coral hover:underline">Eliminar</button>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Categorías -->
      <SectionCard title="Categorías" subtitle="Agrupan ítems y definen a qué estación llegan.">
        <template #actions>
          <button v-if="createPerm" @click="newCategory" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25">
            <span class="w-3.5 h-3.5" v-html="ICON_PLUS" /> Nueva
          </button>
        </template>
        <EmptyState v-if="!categories.length" title="Sin categorías" message="Creá categorías como Entradas, Platos, Bebidas." />
        <div v-else class="divide-y divide-border">
          <div v-for="c in categories" :key="c.id" class="flex items-center justify-between py-2.5">
            <div>
              <span class="font-bold text-navy">{{ c.name }}</span>
              <span class="ml-2 text-xs text-text-muted">→ {{ stationName(c.stationId) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button v-if="editPerm" @click="editCategory(c)" class="text-xs font-bold text-navy hover:underline">Editar</button>
              <button v-if="deletePerm" @click="delCategory(c)" class="text-xs font-bold text-coral hover:underline">Eliminar</button>
            </div>
          </div>
        </div>
      </SectionCard>

      <!-- Ítems -->
      <SectionCard title="Ítems de la carta" subtitle="Platos y bebidas con precio.">
        <template #actions>
          <button v-if="createPerm" @click="newItem" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold hover:bg-white/25">
            <span class="w-3.5 h-3.5" v-html="ICON_PLUS" /> Nuevo
          </button>
        </template>
        <div v-if="categories.length" class="flex flex-wrap gap-1.5 mb-3">
          <button @click="activeCategoryId = 'all'" :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategoryId === 'all' ? 'bg-navy text-white' : 'bg-surface text-text-muted']">Todas</button>
          <button v-for="c in categories" :key="c.id" @click="activeCategoryId = c.id" :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategoryId === c.id ? 'bg-navy text-white' : 'bg-surface text-text-muted']">{{ c.name }}</button>
        </div>
        <EmptyState v-if="!filteredItems.length" title="Sin ítems" message="Agregá platos a la carta." />
        <div v-else class="divide-y divide-border">
          <div v-for="i in filteredItems" :key="i.id" class="flex items-center justify-between py-2.5 gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-navy truncate">{{ i.name }}</span>
                <span v-if="!i.available" class="text-[10px] px-1.5 py-0.5 rounded bg-coral/10 text-coral font-bold">Agotado</span>
                <span v-if="i.hasRecipe === false" class="text-[10px] px-1.5 py-0.5 rounded bg-gold/10 text-gold font-bold" title="No descuenta inventario al venderse — cargá su receta">Sin receta</span>
              </div>
              <div class="text-xs text-text-muted truncate">{{ categoryName(i.categoryId) }} · {{ stationName(i.stationId || categories.find(c => c.id === i.categoryId)?.stationId) }}</div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <span class="font-black text-navy tabular-nums">{{ money(i.price) }}</span>
              <button v-if="editPerm && inventory.length" @click="openRecipe(i)" class="text-xs font-bold text-teal hover:underline">Receta</button>
              <button v-if="editPerm" @click="toggleAvailability(i)" class="text-xs font-bold text-gold hover:underline">{{ i.available ? 'Agotar' : 'Reactivar' }}</button>
              <button v-if="editPerm" @click="editItem(i)" class="text-xs font-bold text-navy hover:underline">Editar</button>
              <button v-if="deletePerm" @click="delItem(i)" class="text-xs font-bold text-coral hover:underline">Eliminar</button>
            </div>
          </div>
        </div>
      </SectionCard>
    </template>

    <!-- Receta (BOM): insumos que consume este plato por unidad vendida -->
    <AppModal v-if="recipeItem" :title="`Receta — ${recipeItem.name}`" subtitle="Insumos que descuenta del inventario al vender este ítem." size="lg" @close="recipeItem = null">
      <div v-if="loadingRecipe" class="py-10 text-center text-text-muted">Cargando…</div>
      <div v-else class="space-y-4">
        <EmptyState v-if="!recipeLines.length" title="Sin receta" message="Agregá insumos para que la venta descuente stock automáticamente." />
        <div v-else class="divide-y divide-border">
          <div v-for="r in recipeLines" :key="r.id" class="flex items-center justify-between py-2.5">
            <div>
              <span class="font-bold text-navy">{{ invName(r.inventoryItemId) }}</span>
              <span class="ml-2 text-xs text-text-muted">{{ r.quantity }} {{ invUnit(r.inventoryItemId) }} / unidad vendida</span>
            </div>
            <button v-if="editPerm" @click="removeRecipeLine(r)" class="text-xs font-bold text-coral hover:underline">Quitar</button>
          </div>
        </div>

        <div v-if="editPerm" class="flex items-end gap-2 border-t border-border pt-3">
          <div class="flex-1 min-w-0">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Insumo</label>
            <select v-model="newRecipe.inventoryItemId" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy">
              <option value="">Seleccionar…</option>
              <option v-for="i in availableInventory" :key="i.id" :value="i.id">{{ i.name }} ({{ i.unit }})</option>
            </select>
          </div>
          <div class="w-24 shrink-0">
            <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Cantidad</label>
            <input v-model.number="newRecipe.quantity" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
          </div>
          <button @click="addRecipeLine" class="shrink-0 px-4 py-2 rounded-lg bg-navy text-white text-sm font-bold">Agregar</button>
        </div>
      </div>
    </AppModal>

    <FormModal v-if="modal" :title="modal.title" :fields="modal.fields" :submit-label="modal.submitLabel" :loading="saving"
      @close="modal = null" @submit="modal.onSubmit" />
    <ConfirmModal v-if="confirmModal" v-bind="confirmModal" :loading="confirmBusy" @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>
