<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CajaService, type CashMovement, type CashShift, type CashStats, type Reconcile } from '@/services/Caja.service'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import ConfirmModal from '@/components/features/ConfirmModal.vue'
import KpiHeroCard from '@/components/features/dashboard/KpiHeroCard.vue'
import SectionCard from '@/components/ui/SectionCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AppModal from '@/components/ui/AppModal.vue'

const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_LOCK_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 0 1 7.5-2M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_LOCK_CLOSED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 1 1 8 0V11M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_MINUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15"/></svg>'
const ICON_SCALE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7Zm14 0-2.5 6a2.5 2.5 0 0 0 5 0L19 7ZM4 7h16M8 21h8"/></svg>'
const ICON_CASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path stroke-linecap="round" d="M6 9v.01M18 15v.01"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_BANK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10 12 3l9 7M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M9 20v-6h6v6"/></svg>'
const ICON_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5 21 3M16.5 3H21v4.5M10.5 13.5 3 21M7.5 21H3v-4.5"/></svg>'
const ICON_DOTS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>'

const movMethods = [
  { value: 'cash', label: 'Efectivo', icon: ICON_CASH },
  { value: 'card', label: 'Tarjeta', icon: ICON_CARD },
  { value: 'transfer', label: 'Transferencia', icon: ICON_BANK },
  { value: 'link', label: 'Link', icon: ICON_LINK },
  { value: 'other', label: 'Otro', icon: ICON_DOTS },
]

const toast = useToast()
const { confirmModal, confirmBusy, askConfirm, runConfirm } = useConfirm({
  onDone: () => toast.success('Movimiento eliminado'),
  onError: (e) => toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined),
})

const stats = ref<CashStats | null>(null)
const currentShift = ref<CashShift | null>(null)
const movements = ref<CashMovement[]>([])
const page = ref(1)
const pages = ref(1)
const loading = ref(false)

// Modal registrar movimiento
const showMov = ref(false)
const submitting = ref(false)
const movForm = ref({ type: 'income' as 'income' | 'expense', amount: 0, method: 'cash' as 'cash' | 'card' | 'transfer' | 'link' | 'other', concept: '', guestName: '', roomNumber: '' })

// Modal cerrar turno (arqueo)
const showClose = ref(false)
const reconcile = ref<Reconcile | null>(null)
const countedAmount = ref(0)
const closing = ref(false)

// Abrir turno
const openingAmount = ref(0)
const opening = ref(false)

const METHOD_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', link: 'Link', other: 'Otro' }

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [s, sh, m] = await Promise.all([CajaService.stats(), CajaService.currentShift(), CajaService.movements({ page: page.value, limit: 20 })])
    stats.value = s
    currentShift.value = sh
    movements.value = m.data || []
    pages.value = m.pages ?? 1
  } catch (e: unknown) {
    toast.error('No se pudo cargar la caja', e instanceof Error ? e.message : undefined)
  } finally {
    loading.value = false
  }
}

async function loadMovements(p: number) {
  page.value = p
  try {
    const m = await CajaService.movements({ page: p, limit: 20 })
    movements.value = m.data || []
    pages.value = m.pages ?? 1
  } catch (e: unknown) {
    toast.error('Error al cargar movimientos')
  }
}

function openMovModal(type: 'income' | 'expense') {
  movForm.value = { type, amount: 0, method: 'cash', concept: '', guestName: '', roomNumber: '' }
  showMov.value = true
}

async function saveMov() {
  if (!movForm.value.amount || movForm.value.amount <= 0) {
    toast.error('El importe debe ser mayor a 0')
    return
  }
  submitting.value = true
  try {
    await CajaService.createMovement({ ...movForm.value })
    toast.success(movForm.value.type === 'income' ? 'Ingreso registrado' : 'Egreso registrado')
    showMov.value = false
    await load()
  } catch (e: unknown) {
    toast.error('No se pudo registrar el movimiento', e instanceof Error ? e.message : undefined)
  } finally {
    submitting.value = false
  }
}

function removeMov(m: CashMovement) {
  if (!m.id) return
  askConfirm({
    title: 'Eliminar movimiento',
    message: `¿Eliminar movimiento "${m.concept || 'sin concepto'}" ($${m.amount})? No se puede deshacer.`,
    confirmLabel: 'Eliminar', danger: true,
    run: async () => {
      await CajaService.removeMovement(m.id!)
      await load()
    },
  })
}

async function doOpenShift() {
  opening.value = true
  try {
    await CajaService.openShift(openingAmount.value || 0)
    toast.success('Turno abierto')
    openingAmount.value = 0
    await load()
  } catch (e: unknown) {
    toast.error('No se pudo abrir el turno', e instanceof Error ? e.message : undefined)
  } finally {
    opening.value = false
  }
}

async function openCloseModal() {
  if (!currentShift.value?.id) return
  try {
    reconcile.value = await CajaService.reconcile(currentShift.value.id)
    countedAmount.value = reconcile.value.expected
    showClose.value = true
  } catch (e: unknown) {
    toast.error('No se pudo cargar el arqueo', e instanceof Error ? e.message : undefined)
  }
}

async function doCloseShift() {
  if (!currentShift.value?.id) return
  closing.value = true
  try {
    await CajaService.closeShift(currentShift.value.id, countedAmount.value)
    toast.success('Turno cerrado')
    showClose.value = false
    await load()
  } catch (e: unknown) {
    toast.error('No se pudo cerrar el turno', e instanceof Error ? e.message : undefined)
  } finally {
    closing.value = false
  }
}

const liveDifference = computed(() => {
  if (!reconcile.value) return 0
  return countedAmount.value - reconcile.value.expected
})
const fmtDiff = (d: number) => (d >= 0 ? `+$${d.toLocaleString()}` : `-$${Math.abs(d).toLocaleString()}`)

const todayAmount = computed(() => stats.value?.today ?? 0)
const weekAmount = computed(() => stats.value?.week ?? 0)
const monthAmount = computed(() => stats.value?.month ?? 0)
const movCount = computed(() => stats.value?.count ?? 0)

// Los KPI los anima KpiHeroCard internamente (useCountUp propio) — no envolver acá.

function sourceLabel(source?: string) {
  if (source === 'payment_connector') return 'Auto'
  if (source === 'migrated') return 'Migrado'
  return 'Manual'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-xl font-black text-navy">Caja</h2>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#16A34A]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60"></span>
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]"></span>
            </span>
            En vivo
          </span>
        </div>
        <p class="text-xs text-text-muted mt-0.5">Movimientos, turnos y arqueo</p>
      </div>
      <div class="flex gap-2">
        <button @click="openMovModal('income')" class="flex items-center gap-1.5 bg-teal text-white font-extrabold text-sm px-4 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
          Ingreso
        </button>
        <button @click="openMovModal('expense')" class="flex items-center gap-1.5 bg-coral text-white font-extrabold text-sm px-4 py-2.5 rounded-full hover:shadow-lg transition-all cursor-pointer">
          <span class="w-4 h-4 shrink-0" v-html="ICON_MINUS"></span>
          Egreso
        </button>
      </div>
    </div>

    <!-- Turno actual — hero, gatea el resto de la operación -->
    <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" :class="currentShift ? 'bg-teal/10' : 'bg-navy/5'">
            <span class="w-6 h-6" :class="currentShift ? 'text-teal' : 'text-navy/40'" v-html="currentShift ? ICON_LOCK_OPEN : ICON_LOCK_CLOSED"></span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-black text-navy">Turno actual</h3>
              <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full" :class="currentShift ? 'bg-teal/10 text-teal' : 'bg-navy/5 text-text-muted'">
                {{ currentShift ? 'Abierto' : 'Cerrado' }}
              </span>
            </div>
            <p v-if="currentShift" class="text-xs text-text-muted mt-0.5">
              Apertura <span class="font-bold tabular-nums">${{ currentShift.openingAmount.toLocaleString() }}</span> · {{ (currentShift.openedAt || '').slice(0, 16).replace('T', ' ') }}
            </p>
            <p v-else class="text-xs text-text-muted mt-0.5">Abrí un turno para empezar a registrar movimientos</p>
          </div>
        </div>
        <div v-if="currentShift">
          <button @click="openCloseModal" class="flex items-center gap-1.5 rounded-full bg-coral text-white text-sm font-extrabold px-5 py-2.5 hover:shadow-lg transition-all cursor-pointer">
            <span class="w-4 h-4 shrink-0" v-html="ICON_SCALE"></span>
            Cerrar turno (arqueo)
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input v-model.number="openingAmount" type="number" min="0" step="0.01" placeholder="Fondo inicial" class="w-36 px-4 py-2.5 rounded-xl border border-border text-sm text-right tabular-nums focus:outline-none focus:border-navy" />
          <button @click="doOpenShift" :disabled="opening" class="flex items-center gap-1.5 rounded-full bg-teal text-white text-sm font-extrabold px-5 py-2.5 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
            <span class="w-4 h-4 shrink-0" v-html="ICON_LOCK_OPEN"></span>
            {{ opening ? 'Abriendo...' : 'Abrir turno' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiHeroCard label="Hoy" :value="todayAmount" icon="money" accent="teal"
        prefix="$" unit="Movido en el día" />
      <KpiHeroCard label="Esta semana" :value="weekAmount" icon="checkin" accent="blue"
        prefix="$" unit="Últimos 7 días" />
      <KpiHeroCard label="Este mes" :value="monthAmount" icon="building" accent="purple"
        prefix="$" unit="Acumulado del mes" />
      <KpiHeroCard label="Movimientos" :value="movCount" icon="bookings" accent="amber"
        unit="Registros del período" />
    </div>

    <!-- Movimientos -->
    <SectionCard title="Movimientos" :subtitle="`${movCount} registro(s)`" body-class="p-0">
      <!-- Carga -->
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded-xl bg-surface"></div>
      </div>

      <!-- Sin datos (esta vista no tiene filtros: un solo mensaje posible) -->
      <EmptyState v-else-if="!movements.length"
        :icon="ICON_WALLET"
        title="Sin movimientos registrados"
        message="Registrá un ingreso o un egreso para empezar a mover la caja.">
        <template #action>
          <button @click="openMovModal('income')"
            class="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light transition-colors cursor-pointer">Registrar ingreso</button>
        </template>
      </EmptyState>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[860px] tbl-head">
          <thead>
            <tr>
              <th class="text-left px-4 py-3 text-[10px]">Fecha</th>
              <th class="text-left px-4 py-3 text-[10px]">Concepto</th>
              <th class="text-left px-4 py-3 text-[10px]">Tipo</th>
              <th class="text-left px-4 py-3 text-[10px] hidden lg:table-cell">Método</th>
              <th class="text-left px-4 py-3 text-[10px] hidden xl:table-cell">Origen</th>
              <th class="text-right px-4 py-3 text-[10px]">Monto</th>
              <th class="text-right px-4 py-3 text-[10px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id" class="border-b border-border last:border-0 hover:bg-surface/60 transition-colors">
              <td class="px-4 py-3 text-xs text-text-muted tabular-nums whitespace-nowrap">{{ (m.createdAt || '').slice(0, 16).replace('T', ' ') }}</td>
              <td class="px-4 py-3">
                <!-- Un movimiento puede venir sin concepto (cobro automático): lo decimos,
                     no dejamos la celda muda. -->
                <div class="max-w-[240px] truncate text-sm font-bold" :class="m.concept ? 'text-navy' : 'text-text-muted'">
                  {{ m.concept || 'Sin concepto' }}
                </div>
                <div v-if="m.guestName" class="max-w-[240px] truncate text-[11px] text-text-muted">{{ m.guestName }}</div>
                <!-- En pantallas chicas el método sube como línea de apoyo -->
                <div v-if="METHOD_LABEL[m.method || ''] || m.method" class="text-[11px] text-text-muted lg:hidden">
                  {{ METHOD_LABEL[m.method || ''] || m.method }}
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase" :class="m.type === 'income' ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">
                  {{ m.type === 'income' ? 'Ingreso' : 'Egreso' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                {{ METHOD_LABEL[m.method || ''] || m.method }}
              </td>
              <td class="px-4 py-3 hidden xl:table-cell">
                <span class="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase" :class="m.source === 'payment_connector' ? 'bg-cyan/10 text-cyan' : 'bg-surface text-text-muted'">
                  {{ sourceLabel(m.source) }}
                </span>
              </td>
              <td class="px-4 py-3 text-right text-sm font-black tabular-nums whitespace-nowrap" :class="m.type === 'income' ? 'text-teal' : 'text-coral'">
                {{ m.type === 'income' ? '+' : '-' }}${{ (m.amount || 0).toLocaleString() }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Los movimientos generados por la pasarela no se borran a mano. -->
                  <button v-if="m.source !== 'payment_connector'" @click="removeMov(m)" title="Eliminar movimiento"
                    class="grid h-8 w-8 place-items-center rounded-lg text-coral hover:bg-coral/10 transition-colors cursor-pointer">
                    <span class="h-4 w-4" v-html="ICON_TRASH"></span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div v-if="pages > 1" class="flex items-center justify-between border-t border-border px-4 py-3">
        <span class="text-[11px] font-bold text-text-muted">Página {{ page }} de {{ pages }}</span>
        <div class="flex items-center gap-1">
          <button @click="loadMovements(page - 1)" :disabled="page <= 1" class="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">‹</button>
          <button @click="loadMovements(page + 1)" :disabled="page >= pages" class="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold text-navy hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">›</button>
        </div>
      </div>
    </SectionCard>

    <!-- Modal registrar movimiento -->
    <AppModal v-if="showMov" size="md"
      :title="movForm.type === 'income' ? 'Registrar ingreso' : 'Registrar egreso'"
      :subtitle="movForm.type === 'income' ? 'Entra plata a la caja' : 'Sale plata de la caja'"
      @close="showMov = false">
      <div class="space-y-4">
        <div>
          <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Importe</label>
          <input v-model.number="movForm.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right tabular-nums focus:outline-none focus:border-navy" />
        </div>
        <div>
          <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Método</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="method in movMethods"
              :key="method.value"
              type="button"
              @click="movForm.method = method.value as typeof movForm.method"
              class="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold border transition-all cursor-pointer"
              :class="movForm.method === method.value ? 'border-navy bg-navy text-white' : 'border-border text-text-secondary hover:border-navy/30'"
            >
              <span class="w-3.5 h-3.5 shrink-0" v-html="method.icon"></span>
              {{ method.label }}
            </button>
          </div>
        </div>
        <div>
          <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Concepto</label>
          <input v-model="movForm.concept" placeholder="Ej: Compra de insumos" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Huésped (opcional)</label>
            <input v-model="movForm.guestName" placeholder="Nombre" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Hab. (opcional)</label>
            <input v-model="movForm.roomNumber" placeholder="Nº" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
          </div>
        </div>
      </div>

      <template #footer>
        <button @click="showMov = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
        <button @click="saveMov" :disabled="submitting" class="rounded-full text-white text-sm font-extrabold px-5 py-2.5 transition-colors cursor-pointer disabled:opacity-50" :class="movForm.type === 'income' ? 'bg-teal hover:bg-teal-light' : 'bg-coral hover:opacity-90'">
          {{ submitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </template>
    </AppModal>

    <!-- Modal cerrar turno (arqueo) -->
    <AppModal v-if="showClose && reconcile" size="md"
      title="Cerrar turno — arqueo"
      subtitle="Contá el efectivo y confirmá la diferencia"
      @close="showClose = false">
      <div class="space-y-2.5 pb-5 border-b border-border text-sm">
        <div class="flex justify-between"><span class="text-text-muted">Fondo inicial</span><span class="font-bold text-navy tabular-nums">${{ reconcile.opening.toLocaleString() }}</span></div>
        <div class="flex justify-between"><span class="text-text-muted">Ingresos</span><span class="font-bold text-teal tabular-nums">+${{ reconcile.income.toLocaleString() }}</span></div>
        <div class="flex justify-between"><span class="text-text-muted">Egresos</span><span class="font-bold text-coral tabular-nums">-${{ reconcile.expense.toLocaleString() }}</span></div>
        <div class="flex justify-between pt-2.5 border-t border-border"><span class="font-extrabold text-navy">Esperado en caja</span><span class="font-extrabold text-navy text-base tabular-nums">${{ reconcile.expected.toLocaleString() }}</span></div>
      </div>

      <div class="py-5 border-b border-border">
        <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Monto contado (real)</label>
        <input v-model.number="countedAmount" type="number" min="0" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right tabular-nums focus:outline-none focus:border-navy" />
      </div>

      <div class="flex justify-between items-center pt-5">
        <span class="text-sm font-bold text-text-secondary">{{ liveDifference >= 0 ? 'Sobrante' : 'Faltante' }}</span>
        <span class="text-xl font-black tabular-nums" :class="liveDifference >= 0 ? 'text-teal' : 'text-coral'">{{ fmtDiff(liveDifference) }}</span>
      </div>

      <template #footer>
        <button @click="showClose = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
        <button @click="doCloseShift" :disabled="closing" class="rounded-full bg-coral text-white text-sm font-extrabold px-5 py-2.5 hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">
          {{ closing ? 'Cerrando...' : 'Confirmar cierre' }}
        </button>
      </template>
    </AppModal>

    <ConfirmModal v-if="confirmModal" :title="confirmModal.title" :message="confirmModal.message"
      :confirm-label="confirmModal.confirmLabel" :danger="confirmModal.danger" :loading="confirmBusy"
      @confirm="runConfirm" @close="confirmModal = null" />
  </div>
</template>

<style scoped>
/* Las transiciones de entrada/salida de los modales las aporta AppModal. */
</style>
