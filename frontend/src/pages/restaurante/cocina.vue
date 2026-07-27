<script setup lang="ts">
// pages/restaurante/cocina.vue — Pantalla de cocina (KDS, RES-7). Cola de líneas activas por estación,
// FIFO, con auto-refresh. Cada línea avanza new→preparing→ready→served (o se cancela). Pensada para
// tablet: botones grandes. Polling porque el endpoint es GET puro (resiliente sin socket).
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  RestaurantService,
  type Station, type KdsTicket, type OrderLine, type LineStatus,
  ORDER_TYPE_LABELS,
} from '@/services/Restaurant.service'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { usePermissions } from '@/composables/usePermissions'

const toast = useToast()
const { can } = usePermissions()
const editPerm = computed(() => can('restaurant', 'edit'))

const REFRESH_MS = 15000
const loading = ref(true)
const busyLine = ref<string | null>(null)
const stations = ref<Station[]>([])
const tickets = ref<KdsTicket[]>([])
const station = ref<string>('')       // '' = todas · '__none__' = sin estación · id = estación puntual
let timer: ReturnType<typeof setInterval> | null = null

// Siguiente transición por estado de línea (KDS solo avanza; served/cancelled ya salen de la cola).
const NEXT: Partial<Record<LineStatus, { to: LineStatus; label: string; cls: string }[]>> = {
  new: [{ to: 'preparing', label: 'Preparar', cls: 'bg-navy text-white' }, { to: 'cancelled', label: 'Cancelar', cls: 'border-2 border-coral/40 text-coral' }],
  preparing: [{ to: 'ready', label: 'Lista', cls: 'bg-gold text-white' }, { to: 'cancelled', label: 'Cancelar', cls: 'border-2 border-coral/40 text-coral' }],
  ready: [{ to: 'served', label: 'Servida', cls: 'bg-teal text-white' }],
}

const lineTint: Record<string, string> = {
  new: 'border-navy/30', preparing: 'border-navy', ready: 'border-gold',
}

async function refresh(showSpinner = false) {
  if (showSpinner) loading.value = true
  try {
    tickets.value = await RestaurantService.kdsQueue(station.value || undefined)
  } catch (e: unknown) {
    if (showSpinner) toast.error(e instanceof Error ? e.message : 'No se pudo cargar la cocina')
  } finally {
    if (showSpinner) loading.value = false
  }
}

async function selectStation(id: string) {
  station.value = id
  await refresh(true)
}

async function advance(line: OrderLine, to: LineStatus) {
  if (!editPerm.value || busyLine.value) return
  busyLine.value = line.id
  try {
    await RestaurantService.setLineStatus(line.id, to)
    await refresh(false)
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
  } finally {
    busyLine.value = null
  }
}

function hhmm(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

/** F1: modificadores elegidos junto al nombre del plato — la cocina necesita "Grande, sin cebolla". */
function modifiersLabel(l: OrderLine): string {
  const names = (l.modifiers ?? []).map((m) => m.name)
  return names.length ? `(${names.join(', ')})` : ''
}

onMounted(async () => {
  try {
    stations.value = (await RestaurantService.listStations()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  } catch { /* la cola funciona igual sin el catálogo de estaciones */ }
  await refresh(true)
  timer = setInterval(() => refresh(false), REFRESH_MS)
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-black text-navy">Cocina — KDS</h1>
        <p class="text-sm text-text-muted mt-0.5">Comandas activas, orden de llegada. Se actualiza sola.</p>
      </div>
      <button @click="refresh(true)" class="px-3 py-1.5 rounded-lg border-2 border-navy/30 text-navy text-xs font-bold hover:bg-surface">Actualizar</button>
    </header>

    <!-- Selector de estación -->
    <div class="flex flex-wrap gap-1.5">
      <button @click="selectStation('')" :class="['px-3 py-1.5 rounded-full text-xs font-bold', station === '' ? 'bg-navy text-white' : 'bg-surface text-text-muted']">Todas</button>
      <button v-for="s in stations" :key="s.id" @click="selectStation(s.id)" :class="['px-3 py-1.5 rounded-full text-xs font-bold', station === s.id ? 'bg-navy text-white' : 'bg-surface text-text-muted']">{{ s.name }}</button>
      <button @click="selectStation('__none__')" :class="['px-3 py-1.5 rounded-full text-xs font-bold', station === '__none__' ? 'bg-navy text-white' : 'bg-surface text-text-muted']">Sin estación</button>
    </div>

    <div v-if="loading" class="py-20 text-center text-text-muted">Cargando…</div>
    <EmptyState v-else-if="!tickets.length" title="Nada en cola" message="Cuando entren comandas a esta estación, aparecen acá." />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="t in tickets" :key="t.order.id" class="rounded-2xl border-2 border-border bg-white overflow-hidden flex flex-col">
        <div class="px-3 py-2 bg-navy text-white flex items-center justify-between">
          <span class="font-black text-sm">{{ t.order.number || 'Comanda' }}</span>
          <span class="text-[11px] text-white/70">{{ ORDER_TYPE_LABELS[t.order.type] }} · {{ hhmm(t.order.openedAt) }}</span>
        </div>
        <div class="p-2.5 space-y-2 flex-1">
          <div v-for="l in t.lines" :key="l.id" :class="['rounded-xl border-2 p-2.5', lineTint[l.status] || 'border-border']">
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-navy text-sm">{{ l.quantity }}× {{ l.name }} <span v-if="modifiersLabel(l)" class="font-normal text-text-muted">{{ modifiersLabel(l) }}</span></span>
            </div>
            <div v-if="l.notes" class="text-[11px] text-gold font-bold mt-0.5">⚑ {{ l.notes }}</div>
            <div v-if="editPerm && NEXT[l.status]" class="flex flex-wrap gap-1.5 mt-2">
              <button v-for="a in NEXT[l.status]" :key="a.to" @click="advance(l, a.to)" :disabled="busyLine === l.id"
                :class="['px-2.5 py-1 rounded-lg text-xs font-bold disabled:opacity-50', a.cls]">{{ a.label }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
