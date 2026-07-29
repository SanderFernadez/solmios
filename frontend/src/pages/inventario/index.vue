<script setup lang="ts">
// pages/inventario/index.vue — Inventario de insumos (comida/bebida/bar/suministro). INV-1/2.
// Lista con valuación total, filtro por categoría y bajo-mínimo, alta/edición de insumos, ajuste de
// stock (entrada/salida/ajuste con costo) e historial de movimientos por ítem. Todo vía InventarioService.
import { ref, computed, onMounted } from 'vue'
import {
  InventarioService,
  type InventoryItem, type StockMovement, type MovementType,
  ITEM_CATEGORY_LABELS, MOVEMENT_TYPE_LABELS, MOVEMENT_SOURCE_LABELS,
} from '@/services/Inventario.service'
import { ComprasService } from '@/services/Compras.service'
import { SettingsService } from '@/services/Settings.service'
import { useRouter } from 'vue-router'
import { currencySymbol } from '@/composables/useCurrency'
import { CurrencyCode } from '@/types/currency'
import FormModal, { type FormField } from '@/components/features/FormModal.vue'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { usePermissions } from '@/composables/usePermissions'

const toast = useToast()
const { can } = usePermissions()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onDone: () => { toast.success('Eliminado'); load() },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'No se pudo eliminar'),
})

const loading = ref(true)
const saving = ref(false)
const items = ref<InventoryItem[]>([])
const currency = ref<string>(CurrencyCode.USD)
const activeCategory = ref<string>('all')
const onlyBelowMin = ref(false)

const router = useRouter()
const createPerm = computed(() => can('inventory', 'create'))
const editPerm = computed(() => can('inventory', 'edit'))
const deletePerm = computed(() => can('inventory', 'delete'))
const canPurchase = computed(() => can('purchasing', 'create'))

const money = (n: number): string => `${currencySymbol(currency.value)}${Number(n || 0).toFixed(2)}`
const qty = (n: number): string => Number(n || 0).toLocaleString('es', { maximumFractionDigits: 4 })
const catLabel = (c: string): string => ITEM_CATEGORY_LABELS[c] || c
const isLow = (i: InventoryItem): boolean => Number(i.currentStock) < Number(i.minStock)

const filtered = computed(() => items.value.filter((i) =>
  (activeCategory.value === 'all' || i.category === activeCategory.value) &&
  (!onlyBelowMin.value || isLow(i)),
))

// KPIs y valuación: solo insumos activos (uno desactivado no pesa en el negocio ni se repone).
const activeItems = computed(() => items.value.filter((i) => i.active !== 0))
const totalValue = computed(() => activeItems.value.reduce((s, i) => s + Number(i.currentStock || 0) * Number(i.avgCost || 0), 0))
const lowCount = computed(() => activeItems.value.filter(isLow).length)

async function load() {
  loading.value = true
  try {
    const [list, settings] = await Promise.all([
      InventarioService.listItems(),
      SettingsService.get().catch(() => null),
    ])
    items.value = list
    currency.value = (settings as any)?.hotel?.currency || 'USD'
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar el inventario')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ─── Modal genérico (alta/edición) ───
const modal = ref<{ title: string; submitLabel: string; fields: FormField[]; onSubmit: (v: Record<string, string | number>) => Promise<void> } | null>(null)

const CATEGORY_OPTIONS = Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))

function newItem() {
  modal.value = {
    title: 'Nuevo insumo', submitLabel: 'Crear',
    fields: [
      { key: 'name', label: 'Nombre (ej: Ron Barceló 750ml)', required: true, minLength: 2, maxLength: 120 },
      { key: 'sku', label: 'SKU / código', maxLength: 40, hint: 'Opcional' },
      { key: 'category', label: 'Categoría', type: 'select', default: 'beverage', options: CATEGORY_OPTIONS },
      { key: 'unit', label: 'Unidad (ej: botella, kg, unidad)', maxLength: 20, default: 'unidad' },
      { key: 'minStock', label: 'Stock mínimo', type: 'number', min: 0, hint: 'Bajo este nivel se marca en rojo' },
      { key: 'initialStock', label: 'Stock inicial', type: 'number', min: 0, hint: 'Opcional — cuánto tenés hoy de este insumo' },
      { key: 'initialCost', label: 'Costo de compra (unitario)', type: 'number', min: 0, hint: 'Lo que pagaste por unidad. Define el costo promedio inicial' },
    ],
    onSubmit: async (v) => save(async () => {
      const created = await InventarioService.createItem({
        name: String(v.name).trim(), sku: v.sku ? String(v.sku).trim() : undefined,
        category: String(v.category || 'beverage'), unit: v.unit ? String(v.unit).trim() : 'unidad',
        minStock: Number(v.minStock) || 0,
      })
      const initialStock = Number(v.initialStock) || 0
      if (initialStock > 0) {
        await InventarioService.moveStock(created.id, {
          type: 'in', quantity: initialStock,
          unitCost: v.initialCost !== undefined && v.initialCost !== '' ? Number(v.initialCost) : undefined,
          reason: 'Carga inicial',
        })
      }
      return created
    }),
  }
}
function editItem(i: InventoryItem) {
  modal.value = {
    title: 'Editar insumo', submitLabel: 'Guardar',
    fields: [
      { key: 'name', label: 'Nombre', required: true, minLength: 2, maxLength: 120, default: i.name },
      { key: 'sku', label: 'SKU / código', maxLength: 40, default: i.sku ?? '' },
      { key: 'category', label: 'Categoría', type: 'select', default: i.category, options: CATEGORY_OPTIONS },
      { key: 'unit', label: 'Unidad', maxLength: 20, default: i.unit },
      { key: 'minStock', label: 'Stock mínimo', type: 'number', min: 0, default: i.minStock },
      { key: 'active', label: 'Activo', type: 'select', default: String(i.active ?? 1), options: [{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }] },
    ],
    onSubmit: async (v) => save(() => InventarioService.updateItem(i.id, {
      name: String(v.name).trim(), sku: v.sku ? String(v.sku).trim() : undefined,
      category: String(v.category), unit: v.unit ? String(v.unit).trim() : 'unidad',
      minStock: Number(v.minStock) || 0, active: Number(v.active),
    })),
  }
}
function delItem(i: InventoryItem) {
  askConfirm({
    title: 'Eliminar insumo', message: `¿Eliminar "${i.name}"? Se pierde su historial de movimientos.`,
    confirmLabel: 'Eliminar', danger: true,
    run: () => InventarioService.deleteItem(i.id),
  })
}

// ─── Ajuste de stock (movimiento manual) ───
function moveStock(i: InventoryItem) {
  modal.value = {
    title: `Movimiento — ${i.name}`, submitLabel: 'Registrar',
    fields: [
      { key: 'type', label: 'Tipo', type: 'select', required: true, default: 'in',
        options: [
          { value: 'in', label: 'Entrada (suma a lo que hay)' },
          { value: 'out', label: 'Salida (resta de lo que hay)' },
          { value: 'adjust', label: 'Ajuste — fija el stock exacto (conteo físico)' },
        ] },
      { key: 'quantity', label: 'Cantidad', type: 'number', required: true, min: 0,
        hint: `Stock actual: ${qty(i.currentStock)} ${i.unit} · Entrada/Salida: cuánto sumar o restar · Ajuste: el nuevo stock TOTAL (no un delta)` },
      { key: 'unitCost', label: 'Costo unitario', type: 'number', min: 0, hint: 'Solo en entradas: recalcula el costo promedio' },
      { key: 'reason', label: 'Motivo / nota', maxLength: 200 },
    ],
    onSubmit: async (v) => save(() => InventarioService.moveStock(i.id, {
      type: String(v.type) as MovementType, quantity: Number(v.quantity) || 0,
      unitCost: v.unitCost !== undefined && v.unitCost !== '' ? Number(v.unitCost) : undefined,
      reason: v.reason ? String(v.reason).trim() : undefined,
    })),
  }
}

// ─── Historial de movimientos ───
const historyItem = ref<InventoryItem | null>(null)
const movements = ref<StockMovement[]>([])
const loadingHistory = ref(false)
async function openHistory(i: InventoryItem) {
  historyItem.value = i
  loadingHistory.value = true
  movements.value = []
  try {
    movements.value = await InventarioService.listMovements(i.id)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo cargar el historial')
  } finally {
    loadingHistory.value = false
  }
}
const MOVE_STYLE: Record<string, string> = { in: 'text-teal', out: 'text-coral', adjust: 'text-gold' }
const fmtDate = (s?: string): string => s ? new Date(s).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// ─── INT-2: bajo mínimo → requisición ───
// Junta los insumos bajo mínimo en una requisición borrador (cantidad sugerida = lo que falta para el
// mínimo, al menos 1). Reusa el flujo de compras; el usuario la revisa/envía desde Requisiciones.
const generating = ref(false)
async function generateRequisition() {
  const low = activeItems.value.filter(isLow)
  if (!low.length) { toast.info('No hay insumos bajo mínimo'); return }
  askConfirm({
    title: 'Generar requisición', danger: false, confirmLabel: 'Generar',
    message: `Se creará una requisición borrador con ${low.length} insumo${low.length > 1 ? 's' : ''} bajo mínimo. Podés revisarla y enviarla desde Compras → Requisiciones.`,
    run: async () => {
      generating.value = true
      try {
        await ComprasService.createRequisition({
          notes: 'Reposición automática — insumos bajo mínimo',
          items: low.map((i) => ({
            inventoryItemId: i.id, description: i.name, unit: i.unit,
            quantity: Math.max(Number(i.minStock) - Number(i.currentStock), 1),
          })),
        })
        toast.success('Requisición borrador creada')
        router.push('/panel/compras/requisiciones')
      } finally {
        generating.value = false
      }
    },
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

const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-navy">Inventario</h1>
        <p class="text-sm text-text-muted mt-0.5">Insumos de cocina y bar: stock, costo promedio y movimientos.</p>
      </div>
      <button v-if="createPerm" @click="newItem" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy text-white text-sm font-bold hover:bg-navy/90">
        <span class="w-4 h-4" v-html="ICON_PLUS" /> Nuevo insumo
      </button>
    </header>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiHeroCard label="Valor del inventario" :value="totalValue" icon="money" accent="amber"
        :prefix="currencySymbol(currency)" unit="Insumos activos a costo promedio" />
      <KpiHeroCard label="Insumos activos" :value="activeItems.length" icon="building" accent="blue"
        :unit="`${items.length} en catálogo`" />
      <KpiHeroCard label="Bajo mínimo" :value="lowCount" icon="checkout" :accent="lowCount ? 'rose' : 'teal'"
        unit="Necesitan reposición" />
      <KpiHeroCard label="Categorías" :value="new Set(activeItems.map((i) => i.category)).size" icon="bookings" accent="purple"
        unit="Comida, bebida, suministro" />
    </div>

    <div v-if="loading" class="py-20 text-center text-text-muted">Cargando…</div>

    <SectionCard v-else title="Insumos" subtitle="Stock materializado por el ledger de movimientos.">
      <template #actions>
        <button v-if="canPurchase && lowCount" @click="generateRequisition" :disabled="generating"
          class="px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-bold hover:bg-white/25 disabled:opacity-50">
          {{ generating ? 'Generando…' : 'Requisición de reposición' }}
        </button>
        <button @click="onlyBelowMin = !onlyBelowMin"
          :class="['px-2.5 py-1 rounded-full text-xs font-bold', onlyBelowMin ? 'bg-coral text-white' : 'bg-white/15 text-white']">
          Bajo mínimo{{ lowCount ? ` (${lowCount})` : '' }}
        </button>
      </template>

      <!-- Filtro de categoría -->
      <div class="flex flex-wrap gap-1.5 mb-3">
        <button @click="activeCategory = 'all'" :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategory === 'all' ? 'bg-navy text-white' : 'bg-surface text-text-muted']">Todos</button>
        <button v-for="c in CATEGORY_OPTIONS" :key="c.value" @click="activeCategory = c.value"
          :class="['px-2.5 py-1 rounded-full text-xs font-bold', activeCategory === c.value ? 'bg-navy text-white' : 'bg-surface text-text-muted']">{{ c.label }}</button>
      </div>

      <EmptyState v-if="!filtered.length" title="Sin insumos"
        :message="items.length ? 'Ningún insumo coincide con el filtro.' : 'Agregá el primer insumo de tu cocina o bar.'">
        <template v-if="createPerm && !items.length" #action>
          <button @click="newItem" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy text-white text-sm font-bold">Nuevo insumo</button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[11px] font-bold text-text-muted uppercase border-b border-border">
              <th class="py-2 pr-3">Insumo</th>
              <th class="py-2 px-3">Categoría</th>
              <th class="py-2 px-3 text-right">Stock</th>
              <th class="py-2 px-3 text-right">Costo prom.</th>
              <th class="py-2 px-3 text-right">Valor</th>
              <th class="py-2 pl-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="i in filtered" :key="i.id" class="hover:bg-surface/50">
              <td class="py-2.5 pr-3">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-navy">{{ i.name }}</span>
                  <span v-if="i.active === 0" class="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted font-bold">Inactivo</span>
                </div>
                <div v-if="i.sku" class="text-[11px] text-text-muted">{{ i.sku }}</div>
              </td>
              <td class="py-2.5 px-3 text-text-secondary">{{ catLabel(i.category) }}</td>
              <td class="py-2.5 px-3 text-right tabular-nums">
                <span :class="isLow(i) ? 'text-coral font-black' : 'text-navy font-bold'">{{ qty(i.currentStock) }}</span>
                <span class="text-text-muted"> {{ i.unit }}</span>
                <div v-if="isLow(i)" class="text-[10px] text-coral font-bold">mín {{ qty(i.minStock) }}</div>
              </td>
              <td class="py-2.5 px-3 text-right tabular-nums text-text-secondary">{{ money(i.avgCost) }}</td>
              <td class="py-2.5 px-3 text-right tabular-nums font-bold text-navy">{{ money(Number(i.currentStock) * Number(i.avgCost)) }}</td>
              <td class="py-2.5 pl-3 text-right whitespace-nowrap">
                <button v-if="editPerm" @click="moveStock(i)" class="text-xs font-bold text-teal hover:underline">Movimiento</button>
                <button @click="openHistory(i)" class="ml-2 text-xs font-bold text-navy hover:underline">Historial</button>
                <button v-if="editPerm" @click="editItem(i)" class="ml-2 text-xs font-bold text-navy hover:underline">Editar</button>
                <button v-if="deletePerm" @click="delItem(i)" class="ml-2 text-xs font-bold text-coral hover:underline">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionCard>

    <!-- Historial de movimientos -->
    <AppModal v-if="historyItem" :title="`Movimientos — ${historyItem.name}`" size="lg" @close="historyItem = null">
      <div v-if="loadingHistory" class="py-10 text-center text-text-muted">Cargando…</div>
      <EmptyState v-else-if="!movements.length" title="Sin movimientos" message="Este insumo todavía no tiene entradas ni salidas." />
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[11px] font-bold text-text-muted uppercase border-b border-border">
              <th class="py-2 pr-3">Fecha</th>
              <th class="py-2 px-3">Tipo</th>
              <th class="py-2 px-3">Origen</th>
              <th class="py-2 px-3 text-right">Cantidad</th>
              <th class="py-2 px-3 text-right">Costo</th>
              <th class="py-2 pl-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="m in movements" :key="m.id">
              <td class="py-2 pr-3 text-text-secondary whitespace-nowrap">{{ fmtDate(m.createdAt) }}</td>
              <td class="py-2 px-3 font-bold" :class="MOVE_STYLE[m.type] || 'text-navy'">{{ MOVEMENT_TYPE_LABELS[m.type] || m.type }}</td>
              <td class="py-2 px-3 text-text-muted">{{ MOVEMENT_SOURCE_LABELS[m.source] || m.source }}<div v-if="m.reason" class="text-[10px]">{{ m.reason }}</div></td>
              <td class="py-2 px-3 text-right tabular-nums font-bold" :class="MOVE_STYLE[m.type] || 'text-navy'">{{ m.type === 'out' ? '−' : m.type === 'in' ? '+' : '' }}{{ qty(m.quantity) }}</td>
              <td class="py-2 px-3 text-right tabular-nums text-text-secondary">{{ m.unitCost ? money(m.unitCost) : '—' }}</td>
              <td class="py-2 pl-3 text-right tabular-nums font-bold text-navy">{{ qty(m.balanceAfter) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppModal>

    <FormModal v-if="modal" :title="modal.title" :fields="modal.fields" :submit-label="modal.submitLabel" :loading="saving"
      @close="modal = null" @submit="modal.onSubmit" />
    <ConfirmModal v-if="confirmModal" v-bind="confirmModal" :loading="confirmBusy" @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>
