<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { CajaService, type CashMovement, type CashShift, type CashStats, type Reconcile } from '@/services/Caja.service'
import { useToast } from '@/composables/useToast'

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
      <div class="card p-4"><div class="text-[10px] font-bold text-text-muted uppercase">Hoy</div><div class="text-xl font-black text-teal">${{ (stats?.today ?? 0).toLocaleString() }}</div></div>
      <div class="card p-4"><div class="text-[10px] font-bold text-text-muted uppercase">Esta semana</div><div class="text-xl font-black text-navy">${{ (stats?.week ?? 0).toLocaleString() }}</div></div>
      <div class="card p-4"><div class="text-[10px] font-bold text-text-muted uppercase">Este mes</div><div class="text-xl font-black text-navy">${{ (stats?.month ?? 0).toLocaleString() }}</div></div>
      <div class="card p-4"><div class="text-[10px] font-bold text-text-muted uppercase">Movimientos</div><div class="text-xl font-black text-navy">{{ stats?.count ?? 0 }}</div></div>
    </div>

    <!-- Turno actual -->
    <div class="card p-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-extrabold text-navy">Turno actual</h3>
          <p v-if="currentShift" class="text-xs text-text-muted mt-1">
            Apertura ${{ currentShift.openingAmount.toLocaleString() }} ·
            <span class="text-teal font-bold">ABIERTO</span> ·
            {{ (currentShift.openedAt || '').slice(0, 16).replace('T', ' ') }}
          </p>
          <p v-else class="text-xs text-text-muted mt-1">No hay turno abierto</p>
        </div>
        <div v-if="currentShift" class="flex gap-2">
          <button @click="openCloseModal" class="px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer hover:shadow-lg">Cerrar turno (arqueo)</button>
        </div>
        <div v-else class="flex items-center gap-2">
          <input v-model.number="openingAmount" type="number" placeholder="Fondo inicial" class="w-32 px-3 py-2 rounded-lg border text-sm" />
          <button @click="doOpenShift" :disabled="opening" class="px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50">{{ opening ? 'Abriendo...' : 'Abrir turno' }}</button>
        </div>
      </div>
    </div>

    <!-- Acciones -->
    <div class="flex justify-between items-center">
      <h3 class="font-extrabold text-navy">Movimientos</h3>
      <div class="flex gap-2">
        <button @click="openMovModal('income')" class="px-4 py-2 bg-teal text-white text-sm font-bold rounded-xl cursor-pointer">+ Ingreso</button>
        <button @click="openMovModal('expense')" class="px-4 py-2 bg-coral text-white text-sm font-bold rounded-xl cursor-pointer">+ Egreso</button>
      </div>
    </div>

    <!-- Tabla -->
    <div class="card overflow-hidden">
      <table class="w-full" v-if="movements.length">
        <thead><tr class="border-b bg-surface/50">
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Fecha</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Concepto</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Tipo</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Método</th>
          <th class="text-left p-3 text-[10px] font-bold text-text-muted uppercase">Origen</th>
          <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Monto</th>
          <th class="text-right p-3 text-[10px] font-bold text-text-muted uppercase">Acción</th>
        </tr></thead>
        <tbody>
          <tr v-for="m in movements" :key="m.id" class="border-b border-border/50 last:border-0">
            <td class="p-3 text-xs text-text-muted">{{ (m.createdAt || '').slice(0, 16).replace('T', ' ') }}</td>
            <td class="p-3 text-sm font-bold text-navy">{{ m.concept || '—' }}<span v-if="m.guestName" class="block text-[10px] font-normal text-text-muted">{{ m.guestName }}</span></td>
            <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.type === 'income' ? 'bg-teal/10 text-teal' : 'bg-coral/10 text-coral'">{{ m.type === 'income' ? 'Ingreso' : 'Egreso' }}</span></td>
            <td class="p-3 text-xs">{{ METHOD_LABEL[m.method || ''] || m.method || '—' }}</td>
            <td class="p-3"><span class="text-[10px] font-bold px-2 py-1 rounded-full" :class="m.source === 'payment_connector' ? 'bg-blue/10 text-blue' : 'bg-gray-100 text-gray-500'">{{ m.source === 'payment_connector' ? 'Auto' : m.source === 'migrated' ? 'Migrado' : 'Manual' }}</span></td>
            <td class="p-3 text-right text-sm font-black" :class="m.type === 'income' ? 'text-teal' : 'text-coral'">{{ m.type === 'income' ? '+' : '-' }}${{ (m.amount || 0).toLocaleString() }}</td>
            <td class="p-3 text-right"><button v-if="m.source !== 'payment_connector'" @click="removeMov(m)" class="px-2 py-1 bg-coral/10 text-coral rounded-lg text-[10px] font-bold cursor-pointer hover:bg-coral/20">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="!loading" class="text-center text-text-muted text-sm py-10">No hay movimientos registrados</div>
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
    <div v-if="showMov" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showMov = false">
      <div class="bg-white rounded-2xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-black text-navy">{{ movForm.type === 'income' ? 'Registrar ingreso' : 'Registrar egreso' }}</h3>
          <button @click="showMov = false" class="text-text-muted cursor-pointer hover:text-navy">✕</button>
        </div>
        <div class="space-y-3">
          <div class="flex gap-3">
            <input v-model.number="movForm.amount" type="number" placeholder="Importe" class="w-32 px-3 py-2 rounded-lg border text-sm" />
            <select v-model="movForm.method" class="flex-1 px-3 py-2 rounded-lg border text-sm cursor-pointer">
              <option value="cash">Efectivo</option><option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option><option value="link">Link de pago</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <input v-model="movForm.concept" placeholder="Concepto" class="w-full px-3 py-2 rounded-lg border text-sm" />
          <div class="flex gap-3">
            <input v-model="movForm.guestName" placeholder="Huésped (opcional)" class="flex-1 px-3 py-2 rounded-lg border text-sm" />
            <input v-model="movForm.roomNumber" placeholder="Hab." class="w-24 px-3 py-2 rounded-lg border text-sm" />
          </div>
          <button @click="saveMov" :disabled="submitting" class="w-full px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ submitting ? 'Guardando...' : 'Guardar' }}</button>
        </div>
      </div>
    </div>

    <!-- Modal cerrar turno (arqueo) -->
    <div v-if="showClose && reconcile" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showClose = false">
      <div class="bg-white rounded-2xl w-full max-w-md p-6">
        <h3 class="text-lg font-black text-navy mb-4">Cerrar turno — Arqueo</h3>
        <div class="space-y-2 mb-4 bg-surface rounded-xl p-4 text-sm">
          <div class="flex justify-between"><span class="text-text-muted">Fondo inicial</span><span class="font-bold">${{ reconcile.opening.toLocaleString() }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Ingresos</span><span class="font-bold text-teal">+${{ reconcile.income.toLocaleString() }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Egresos</span><span class="font-bold text-coral">-${{ reconcile.expense.toLocaleString() }}</span></div>
          <div class="flex justify-between border-t border-border pt-2"><span class="font-bold">Esperado en caja</span><span class="font-black text-navy">${{ reconcile.expected.toLocaleString() }}</span></div>
        </div>
        <label class="block text-[10px] font-bold text-text-muted uppercase mb-1">Monto contado (real)</label>
        <input v-model.number="countedAmount" type="number" class="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
        <div class="flex justify-between mb-4 p-3 rounded-xl" :class="liveDifference >= 0 ? 'bg-teal/10' : 'bg-coral/10'">
          <span class="text-sm font-bold">{{ liveDifference >= 0 ? 'Sobrante' : 'Faltante' }}</span>
          <span class="text-lg font-black" :class="liveDifference >= 0 ? 'text-teal' : 'text-coral'">{{ fmtDiff(liveDifference) }}</span>
        </div>
        <div class="flex gap-2">
          <button @click="doCloseShift" :disabled="closing" class="flex-1 px-4 py-2.5 bg-coral text-white rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50">{{ closing ? 'Cerrando...' : 'Confirmar cierre' }}</button>
          <button @click="showClose = false" class="flex-1 px-4 py-2.5 bg-surface text-text-secondary rounded-xl text-sm font-bold border cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
