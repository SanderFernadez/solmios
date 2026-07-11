<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CajaService, type CashMovement, type CashShift, type CashStats, type Reconcile } from '@/services/Caja.service'
import { useToast } from '@/composables/useToast'
import { useCountUp } from '@/composables/useCountUp'

const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z"/></svg>'
const ICON_TRENDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17.25 9 11.25l4 4 8-8M16.5 7.25H21v4.5"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_LOCK_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 0 1 7.5-2M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_LOCK_CLOSED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 1 1 8 0V11M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_MINUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_SCALE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7Zm14 0-2.5 6a2.5 2.5 0 0 0 5 0L19 7ZM4 7h16M8 21h8"/></svg>'
const ICON_CASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path stroke-linecap="round" d="M6 9v.01M18 15v.01"/></svg>'
const ICON_CARD = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke-linecap="round" d="M2 10h20"/></svg>'
const ICON_BANK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10 12 3l9 7M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M9 20v-6h6v6"/></svg>'
const ICON_LINK = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5 21 3M16.5 3H21v4.5M10.5 13.5 3 21M7.5 21H3v-4.5"/></svg>'
const ICON_DOTS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'

const movMethods = [
  { value: 'cash', label: 'Efectivo', icon: ICON_CASH },
  { value: 'card', label: 'Tarjeta', icon: ICON_CARD },
  { value: 'transfer', label: 'Transferencia', icon: ICON_BANK },
  { value: 'link', label: 'Link', icon: ICON_LINK },
  { value: 'other', label: 'Otro', icon: ICON_DOTS },
]

const toast = useToast()

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

async function removeMov(m: CashMovement) {
  if (!m.id) return
  if (!confirm(`¿Eliminar movimiento "${m.concept || 'sin concepto'}" ($${m.amount})?`)) return
  try {
    await CajaService.removeMovement(m.id)
    toast.success('Movimiento eliminado')
    await load()
  } catch (e: unknown) {
    toast.error('No se pudo eliminar', e instanceof Error ? e.message : undefined)
  }
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

const todayAnim = useCountUp(todayAmount)
const weekAnim = useCountUp(weekAmount)
const monthAnim = useCountUp(monthAmount)
const movCountAnim = useCountUp(movCount)
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
              Apertura ${{ currentShift.openingAmount.toLocaleString() }} · {{ (currentShift.openedAt || '').slice(0, 16).replace('T', ' ') }}
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
          <input v-model.number="openingAmount" type="number" min="0" step="0.01" placeholder="Fondo inicial" class="w-36 px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
          <button @click="doOpenShift" :disabled="opening" class="flex items-center gap-1.5 rounded-full bg-teal text-white text-sm font-extrabold px-5 py-2.5 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
            <span class="w-4 h-4 shrink-0" v-html="ICON_LOCK_OPEN"></span>
            {{ opening ? 'Abriendo...' : 'Abrir turno' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-teal truncate">${{ Math.round(todayAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Hoy</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_CALENDAR"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">${{ Math.round(weekAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Esta semana</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_TRENDING"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">${{ Math.round(monthAnim).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Este mes</div>
          </div>
        </div>
      </div>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) transition-transform duration-300 hover:-translate-y-0.5 p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none tabular-nums text-navy truncate">{{ Math.round(movCountAnim) }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Movimientos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Movimientos -->
    <div>
      <h3 class="text-base font-extrabold text-navy mb-3">Movimientos</h3>
      <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) overflow-hidden">
        <table class="w-full" v-if="movements.length">
          <thead><tr class="border-b border-border bg-surface/50">
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Concepto</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Método</th>
            <th class="text-left p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Origen</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Monto</th>
            <th class="text-right p-4 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acción</th>
          </tr></thead>
          <tbody>
            <tr v-for="m in movements" :key="m.id" class="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
              <td class="p-4 text-xs text-text-muted">{{ (m.createdAt || '').slice(0, 16).replace('T', ' ') }}</td>
              <td class="p-4 text-sm font-bold text-navy">{{ m.concept || '—' }}<span v-if="m.guestName" class="block text-[10px] font-normal text-text-muted">{{ m.guestName }}</span></td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.type === 'income' ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ m.type === 'income' ? 'Ingreso' : 'Egreso' }}</span></td>
              <td class="p-4 text-xs text-text-secondary">{{ METHOD_LABEL[m.method || ''] || m.method || '—' }}</td>
              <td class="p-4"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.source === 'payment_connector' ? 'bg-blue/10 text-blue' : 'bg-gray-100 text-gray-500'">{{ m.source === 'payment_connector' ? 'Auto' : m.source === 'migrated' ? 'Migrado' : 'Manual' }}</span></td>
              <td class="p-4 text-right text-sm font-black" :class="m.type === 'income' ? 'text-teal' : 'text-coral'">{{ m.type === 'income' ? '+' : '-' }}${{ (m.amount || 0).toLocaleString() }}</td>
              <td class="p-4 text-right">
                <button v-if="m.source !== 'payment_connector'" @click="removeMov(m)" class="text-[11px] font-bold text-coral hover:text-navy transition-colors cursor-pointer">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!loading" class="text-center py-12">
          <span class="w-10 h-10 mx-auto mb-3 text-text-muted opacity-50 block" v-html="ICON_WALLET"></span>
          <h3 class="font-bold text-navy mb-1">Sin movimientos registrados</h3>
          <p class="text-xs text-text-muted">Registra un ingreso o egreso para empezar.</p>
        </div>
        <div v-else class="text-center text-text-muted text-sm py-10">Cargando...</div>

        <!-- Paginación -->
        <div v-if="pages > 1" class="flex items-center justify-between p-4 border-t border-border">
          <span class="text-[10px] text-text-muted font-bold">Página {{ page }} de {{ pages }}</span>
          <div class="flex items-center gap-1">
            <button @click="loadMovements(page - 1)" :disabled="page <= 1" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">‹</button>
            <button @click="loadMovements(page + 1)" :disabled="page >= pages" class="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface">›</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal registrar movimiento -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showMov" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">{{ movForm.type === 'income' ? 'Registrar Ingreso' : 'Registrar Egreso' }}</h3>
              <button @click="showMov = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>

            <div class="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Importe</label>
                <input v-model.number="movForm.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
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
                  <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Hab.</label>
                  <input v-model="movForm.roomNumber" placeholder="—" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:border-navy" />
                </div>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showMov = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="saveMov" :disabled="submitting" class="rounded-full text-white text-sm font-extrabold px-5 py-2.5 transition-colors cursor-pointer disabled:opacity-50" :class="movForm.type === 'income' ? 'bg-teal hover:bg-teal-light' : 'bg-coral hover:opacity-90'">
                  {{ submitting ? 'Guardando...' : 'Guardar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal cerrar turno (arqueo) -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showClose && reconcile" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
          <div class="modal-panel relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="shrink-0 p-5 border-b border-border flex items-center justify-between">
              <h3 class="text-lg font-black text-navy">Cerrar Turno — Arqueo</h3>
              <button @click="showClose = false" class="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-navy hover:bg-surface transition-colors cursor-pointer">
                <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
              </button>
            </div>

            <div class="p-5 overflow-y-auto flex-1">
              <div class="space-y-2.5 pb-5 border-b border-border text-sm">
                <div class="flex justify-between"><span class="text-text-muted">Fondo inicial</span><span class="font-bold text-navy">${{ reconcile.opening.toLocaleString() }}</span></div>
                <div class="flex justify-between"><span class="text-text-muted">Ingresos</span><span class="font-bold text-teal">+${{ reconcile.income.toLocaleString() }}</span></div>
                <div class="flex justify-between"><span class="text-text-muted">Egresos</span><span class="font-bold text-coral">-${{ reconcile.expense.toLocaleString() }}</span></div>
                <div class="flex justify-between pt-2.5 border-t border-border"><span class="font-extrabold text-navy">Esperado en caja</span><span class="font-extrabold text-navy text-base">${{ reconcile.expected.toLocaleString() }}</span></div>
              </div>

              <div class="py-5 border-b border-border">
                <label class="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 block">Monto contado (real)</label>
                <input v-model.number="countedAmount" type="number" min="0" step="0.01" class="w-full px-4 py-2.5 rounded-xl border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
              </div>

              <div class="flex justify-between items-center pt-5">
                <span class="text-sm font-bold text-text-secondary">{{ liveDifference >= 0 ? 'Sobrante' : 'Faltante' }}</span>
                <span class="text-xl font-black" :class="liveDifference >= 0 ? 'text-teal' : 'text-coral'">{{ fmtDiff(liveDifference) }}</span>
              </div>
            </div>

            <div class="shrink-0 border-t border-border p-5">
              <div class="flex items-center justify-end gap-4">
                <button @click="showClose = false" class="text-sm font-bold text-text-secondary hover:text-navy transition-colors cursor-pointer">Cancelar</button>
                <button @click="doCloseShift" :disabled="closing" class="rounded-full bg-coral text-white text-sm font-extrabold px-5 py-2.5 hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50">
                  {{ closing ? 'Cerrando...' : 'Confirmar cierre' }}
                </button>
              </div>
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
