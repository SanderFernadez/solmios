<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CajaService, type CashMovement, type CashShift, type CashStats, type Reconcile } from '@/services/Caja.service'
import { useToast } from '@/composables/useToast'

const ICON_WALLET = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1.5M21 12h-4a1.5 1.5 0 0 0 0 3h4v-3Z"/></svg>'
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6h15a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-15a.75.75 0 0 1-.75-.75V6.75A.75.75 0 0 1 4.5 6Z"/></svg>'
const ICON_TRENDING = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 17.25 9 11.25l4 4 8-8M16.5 7.25H21v4.5"/></svg>'
const ICON_DOCUMENT = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m1 5H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"/></svg>'
const ICON_LOCK_OPEN = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 0 1 7.5-2M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_LOCK_CLOSED = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7.5a4 4 0 1 1 8 0V11M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/></svg>'
const ICON_PLUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>'
const ICON_MINUS = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12h15"/></svg>'
const ICON_X = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>'
const ICON_TRASH = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7.5h12M9.75 7.5v-1.5a1.5 1.5 0 0 1 1.5-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5m-8.25 0 .75 11.25a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.25 7.5"/></svg>'
const ICON_SCALE = '<svg viewBox="0 0 24 24" class="w-full h-full" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18M5 7l-2.5 6a2.5 2.5 0 0 0 5 0L5 7Zm14 0-2.5 6a2.5 2.5 0 0 0 5 0L19 7ZM4 7h16M8 21h8"/></svg>'

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
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-black text-navy">Caja</h2>
      <p class="text-xs text-text-muted mt-0.5">Movimientos, turnos y arqueo</p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-teal/10">
            <span class="w-5 h-5 text-teal" v-html="ICON_WALLET"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-teal truncate">${{ (stats?.today ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Hoy</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_CALENDAR"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">${{ (stats?.week ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Esta semana</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan/10">
            <span class="w-5 h-5 text-cyan" v-html="ICON_TRENDING"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">${{ (stats?.month ?? 0).toLocaleString() }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Este mes</div>
          </div>
        </div>
      </div>
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-navy/10">
            <span class="w-5 h-5 text-navy" v-html="ICON_DOCUMENT"></span>
          </div>
          <div class="min-w-0">
            <div class="text-xl font-black leading-none text-navy truncate">{{ stats?.count ?? 0 }}</div>
            <div class="text-[10px] text-text-muted uppercase font-bold tracking-wide mt-1 truncate">Movimientos</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Turno actual -->
    <div class="card p-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="currentShift ? 'bg-teal/10' : 'bg-navy/5'">
            <span class="w-5 h-5" :class="currentShift ? 'text-teal' : 'text-navy/40'" v-html="currentShift ? ICON_LOCK_OPEN : ICON_LOCK_CLOSED"></span>
          </div>
          <div>
            <h3 class="font-extrabold text-navy">Turno actual</h3>
            <p v-if="currentShift" class="text-xs text-text-muted mt-0.5">
              Apertura ${{ currentShift.openingAmount.toLocaleString() }} ·
              <span class="text-teal font-bold">ABIERTO</span> ·
              {{ (currentShift.openedAt || '').slice(0, 16).replace('T', ' ') }}
            </p>
            <p v-else class="text-xs text-text-muted mt-0.5">No hay turno abierto</p>
          </div>
        </div>
        <div v-if="currentShift" class="flex gap-2">
          <button @click="openCloseModal" class="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg">
            <span class="w-4 h-4 shrink-0" v-html="ICON_SCALE"></span>
            Cerrar turno (arqueo)
          </button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input v-model.number="openingAmount" type="number" min="0" step="0.01" placeholder="Fondo inicial" class="w-32 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
          <button @click="doOpenShift" :disabled="opening" class="flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">
            <span class="w-4 h-4 shrink-0" v-html="ICON_LOCK_OPEN"></span>
            {{ opening ? 'Abriendo...' : 'Abrir turno' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Acciones -->
    <div class="flex justify-between items-center flex-wrap gap-3">
      <h3 class="font-extrabold text-navy">Movimientos</h3>
      <div class="flex gap-2">
        <button @click="openMovModal('income')" class="flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg">
          <span class="w-4 h-4 shrink-0" v-html="ICON_PLUS"></span>
          Ingreso
        </button>
        <button @click="openMovModal('expense')" class="flex items-center gap-1.5 px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg">
          <span class="w-4 h-4 shrink-0" v-html="ICON_MINUS"></span>
          Egreso
        </button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      <table class="w-full" v-if="movements.length">
        <thead><tr class="border-b bg-surface/50">
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Concepto</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Tipo</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Método</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Origen</th>
          <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Monto</th>
          <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">Acción</th>
        </tr></thead>
        <tbody>
          <tr v-for="m in movements" :key="m.id" class="border-b border-border/50 last:border-0">
            <td class="p-3 text-xs text-text-muted">{{ (m.createdAt || '').slice(0, 16).replace('T', ' ') }}</td>
            <td class="p-3 text-sm font-bold text-navy">{{ m.concept || '—' }}<span v-if="m.guestName" class="block text-[10px] font-normal text-text-muted">{{ m.guestName }}</span></td>
            <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.type === 'income' ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ m.type === 'income' ? 'Ingreso' : 'Egreso' }}</span></td>
            <td class="p-3 text-xs">{{ METHOD_LABEL[m.method || ''] || m.method || '—' }}</td>
            <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.source === 'payment_connector' ? 'bg-blue/10 text-blue' : 'bg-gray-100 text-gray-500'">{{ m.source === 'payment_connector' ? 'Auto' : m.source === 'migrated' ? 'Migrado' : 'Manual' }}</span></td>
            <td class="p-3 text-right text-sm font-black" :class="m.type === 'income' ? 'text-teal' : 'text-coral'">{{ m.type === 'income' ? '+' : '-' }}${{ (m.amount || 0).toLocaleString() }}</td>
            <td class="p-3 text-right">
              <button v-if="m.source !== 'payment_connector'" @click="removeMov(m)" class="inline-flex items-center gap-1 px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">
                <span class="w-3 h-3 shrink-0" v-html="ICON_TRASH"></span>
                Eliminar
              </button>
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
    </div>

    <!-- Paginación -->
    <div v-if="pages > 1" class="flex items-center justify-between">
      <span class="text-xs text-text-muted">Página {{ page }} de {{ pages }}</span>
      <div class="flex gap-2">
        <button @click="loadMovements(page - 1)" :disabled="page <= 1" class="px-3 py-1.5 bg-surface rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">‹ Anterior</button>
        <button @click="loadMovements(page + 1)" :disabled="page >= pages" class="px-3 py-1.5 bg-surface rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-40">Siguiente ›</button>
      </div>
    </div>

    <!-- Modal registrar movimiento -->
    <Teleport to="body">
      <div v-if="showMov" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showMov = false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0" :class="movForm.type === 'income' ? 'text-teal' : 'text-coral'" v-html="movForm.type === 'income' ? ICON_PLUS : ICON_MINUS"></span>
              {{ movForm.type === 'income' ? 'Registrar ingreso' : 'Registrar egreso' }}
            </h3>
            <button @click="showMov = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="space-y-3">
            <div class="flex gap-3">
              <div class="w-32 shrink-0">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Importe</label>
                <input v-model.number="movForm.amount" type="number" min="0" step="0.01" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right focus:outline-none focus:border-navy" />
              </div>
              <div class="flex-1">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Método</label>
                <select v-model="movForm.method" class="w-full px-3 py-2 rounded-lg border border-border text-sm cursor-pointer focus:outline-none focus:border-navy">
                  <option value="cash">Efectivo</option><option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option><option value="link">Link de pago</option>
                  <option value="other">Otro</option>
                </select>
              </div>
            </div>
            <div>
              <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Concepto</label>
              <input v-model="movForm.concept" placeholder="Ej: Compra de insumos" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Huésped (opcional)</label>
                <input v-model="movForm.guestName" placeholder="Nombre" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
              <div class="w-24 shrink-0">
                <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Hab.</label>
                <input v-model="movForm.roomNumber" placeholder="—" class="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
            <button @click="saveMov" :disabled="submitting" class="w-full px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : 'Guardar' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal cerrar turno (arqueo) -->
    <Teleport to="body">
      <div v-if="showClose && reconcile" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showClose = false">
        <div class="absolute inset-0 bg-navy/40 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="flex items-center gap-2 text-lg font-black text-navy">
              <span class="w-5 h-5 shrink-0 text-coral" v-html="ICON_SCALE"></span>
              Cerrar turno — Arqueo
            </h3>
            <button @click="showClose = false" class="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted cursor-pointer hover:bg-surface hover:text-navy">
              <span class="w-4 h-4 shrink-0" v-html="ICON_X"></span>
            </button>
          </div>
          <div class="space-y-2 mb-4 bg-surface rounded-xl p-4 text-sm">
            <div class="flex justify-between"><span class="text-text-muted">Fondo inicial</span><span class="font-bold">${{ reconcile.opening.toLocaleString() }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">Ingresos</span><span class="font-bold text-teal">+${{ reconcile.income.toLocaleString() }}</span></div>
            <div class="flex justify-between"><span class="text-text-muted">Egresos</span><span class="font-bold text-coral">-${{ reconcile.expense.toLocaleString() }}</span></div>
            <div class="flex justify-between border-t border-border pt-2"><span class="font-bold">Esperado en caja</span><span class="font-black text-navy">${{ reconcile.expected.toLocaleString() }}</span></div>
          </div>
          <label class="text-[10px] font-bold text-text-muted uppercase mb-1 block">Monto contado (real)</label>
          <input v-model.number="countedAmount" type="number" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-border text-sm font-bold text-navy text-right mb-2 focus:outline-none focus:border-navy" />
          <div class="flex justify-between mb-4 p-3 rounded-xl" :class="liveDifference >= 0 ? 'bg-teal/10' : 'bg-coral/10'">
            <span class="text-sm font-bold">{{ liveDifference >= 0 ? 'Sobrante' : 'Faltante' }}</span>
            <span class="text-lg font-black" :class="liveDifference >= 0 ? 'text-teal' : 'text-coral'">{{ fmtDiff(liveDifference) }}</span>
          </div>
          <div class="flex gap-3">
            <button @click="showClose = false" class="flex-1 py-2.5 border border-border rounded-xl text-sm font-bold text-text-secondary cursor-pointer">Cancelar</button>
            <button @click="doCloseShift" :disabled="closing" class="flex-1 py-2.5 bg-coral text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ closing ? 'Cerrando...' : 'Confirmar cierre' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped></style>
