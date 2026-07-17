<template>
  <div class="rounded-[20px] border border-border bg-white shadow-(--shadow-card) p-6 mb-8">
    <div class="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <h2 class="text-lg font-black text-navy">Tarifas por canal</h2>
        <p class="text-xs text-text-muted mt-0.5">Precio base + ajuste por temporada para cada canal conectado</p>
      </div>
      <div class="flex items-center gap-3">
        <select v-model="selectedChannel" @change="loadRates"
          class="px-4 py-2 rounded-xl border border-border text-sm font-bold text-navy focus:border-cyan outline-none cursor-pointer">
          <option v-for="c in channels" :key="c.code" :value="c.code">{{ c.name }}</option>
        </select>
        <button @click="save" :disabled="saving || !selectedChannel"
          class="rounded-full bg-navy text-white text-sm font-extrabold px-5 py-2.5 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50">
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>

    <!-- Leyenda de temporadas -->
    <div class="flex flex-wrap gap-4 mb-5">
      <span v-for="s in seasons" :key="s.name" class="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
        <span class="w-3 h-3 rounded-full" :style="{ background: s.color }"></span>{{ s.label || s.name }}
      </span>
    </div>

    <div v-if="loading" class="text-center py-10 text-text-muted text-sm">Cargando tarifas...</div>
    <div v-else-if="groups.length === 0" class="text-center py-10 text-text-muted text-sm">
      No hay habitaciones con tipo definido para configurar tarifas.
    </div>

    <!-- Una tarjeta por habitación (roomType × ocupación) -->
    <div v-else class="space-y-4">
      <div v-for="g in groups" :key="g.key" class="rounded-2xl border border-border bg-surface/40 p-4">
        <h3 class="text-sm font-black text-navy mb-3">{{ g.roomType }} <span class="text-text-muted font-bold">· {{ g.occupancy }} pers.</span></h3>
        <div class="flex flex-wrap gap-3 items-stretch">
          <!-- General + días mín/máx -->
          <div class="rounded-xl bg-white border border-border p-3 min-w-[170px]">
            <div class="text-[10px] font-bold text-text-muted uppercase mb-1">Tarifa base (General)</div>
            <div class="flex items-center gap-1 mb-2">
              <input type="number" min="0" step="0.01" v-model.number="g.basePrice"
                class="w-24 px-2 py-1.5 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              <span class="text-xs text-text-muted">{{ currency }}</span>
            </div>
            <div class="flex gap-2">
              <div>
                <div class="text-[10px] text-text-muted">Días mín.</div>
                <input type="number" min="0" v-model.number="g.minStay" class="w-14 px-2 py-1 rounded-lg border border-border text-xs text-right" />
              </div>
              <div>
                <div class="text-[10px] text-text-muted">Días máx.</div>
                <input type="number" min="0" v-model.number="g.maxStay" class="w-14 px-2 py-1 rounded-lg border border-border text-xs text-right" />
              </div>
            </div>
          </div>

          <!-- Una columna por temporada -->
          <div v-for="cell in g.cells" :key="cell.season" class="rounded-xl border border-border p-3 min-w-[150px]"
            :style="{ background: seasonColor(cell.season) + '22' }">
            <div class="text-[10px] font-bold uppercase mb-1" :style="{ color: seasonColor(cell.season) }">{{ seasonLabel(cell.season) }}</div>
            <div class="flex items-center gap-1 mb-1.5">
              <span class="text-xs font-black text-navy">+</span>
              <input type="number" step="0.01" v-model.number="cell.percentage"
                class="w-16 px-2 py-1.5 rounded-lg border border-border text-sm font-bold text-navy text-right" />
              <span class="text-xs text-text-muted">%</span>
            </div>
            <div class="text-sm font-black text-teal mb-2">= {{ resultPrice(g.basePrice, cell.percentage) }} {{ currency }}</div>
            <button @click="cell.closed = cell.closed ? 0 : 1"
              class="w-full py-1.5 text-[10px] font-bold rounded-full transition-colors cursor-pointer"
              :class="cell.closed ? 'bg-coral text-white' : 'border border-border text-text-secondary hover:border-coral hover:text-coral'">
              {{ cell.closed ? 'Ventas cerradas' : 'Cerrar ventas' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { HotelService, type RoomRate } from '@/services/Hotel.service'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  hotelId?: string
  channels: { code: string; name: string }[]
  currency?: string
}>()

const toast = useToast()
const currency = props.currency || 'USD'
const seasons = ref<{ name: string; label?: string; color?: string }[]>([])
const selectedChannel = ref(props.channels[0]?.code || '')
const loading = ref(false)
const saving = ref(false)

interface Cell { season: string; percentage: number; closed: number }
interface Group { key: string; roomType: string; occupancy: number; basePrice: number; minStay: number; maxStay: number; cells: Cell[] }
const groups = ref<Group[]>([])

const DEFAULT_COLORS: Record<string, string> = { baja: '#e2e8f0', media: '#38bdf8', alta: '#22c55e', especial: '#eab308' }
function seasonColor(name: string): string {
  return seasons.value.find((s) => s.name === name)?.color || DEFAULT_COLORS[name.toLowerCase()] || '#94a3b8'
}
function seasonLabel(name: string): string {
  return seasons.value.find((s) => s.name === name)?.label || name.charAt(0).toUpperCase() + name.slice(1)
}
function resultPrice(base: number, pct: number): string {
  return (Math.round((base || 0) * (1 + (pct || 0) / 100) * 100) / 100).toLocaleString()
}

// Agrupa las filas planas (una por roomType×occupancy×season) en tarjetas por habitación.
function buildGroups(rates: RoomRate[]): Group[] {
  const byRoom = new Map<string, Group>()
  for (const r of rates) {
    const key = `${r.roomType}|${r.occupancy}`
    let g = byRoom.get(key)
    if (!g) {
      g = { key, roomType: r.roomType, occupancy: r.occupancy, basePrice: r.basePrice ?? 0, minStay: r.minStay ?? 0, maxStay: r.maxStay ?? 0, cells: [] }
      byRoom.set(key, g)
    }
    // basePrice/minStay/maxStay son de la habitación: tomamos el primero no-cero que aparezca.
    if (!g.basePrice && r.basePrice) g.basePrice = r.basePrice
    if (!g.minStay && r.minStay) g.minStay = r.minStay
    if (!g.maxStay && r.maxStay) g.maxStay = r.maxStay
    g.cells.push({ season: r.season, percentage: r.percentage ?? 0, closed: r.closed ? 1 : 0 })
  }
  // Ordena las celdas según el orden de temporadas del hotel.
  const order = seasons.value.map((s) => s.name)
  for (const g of byRoom.values()) g.cells.sort((a, b) => order.indexOf(a.season) - order.indexOf(b.season))
  return [...byRoom.values()]
}

async function loadRates() {
  if (!selectedChannel.value) return
  loading.value = true
  try {
    const r = await HotelService.rates(selectedChannel.value)
    groups.value = buildGroups(r.data || [])
  } catch { toast.error('Error al cargar tarifas') } finally { loading.value = false }
}

async function save() {
  if (!selectedChannel.value) return
  saving.value = true
  try {
    // Expande las tarjetas a filas planas: una por (roomType, occupancy, season), con la base/estadías
    // de la habitación repetidas en cada temporada.
    const rates: Partial<RoomRate>[] = []
    for (const g of groups.value) {
      for (const cell of g.cells) {
        rates.push({
          roomType: g.roomType, occupancy: g.occupancy, season: cell.season, channel: selectedChannel.value,
          basePrice: g.basePrice, percentage: cell.percentage, closed: cell.closed, minStay: g.minStay, maxStay: g.maxStay,
        })
      }
    }
    await HotelService.saveRates(rates)
    toast.success('Tarifas guardadas')
    await loadRates()
  } catch { toast.error('Error al guardar tarifas') } finally { saving.value = false }
}

onMounted(async () => {
  try {
    const s = await HotelService.seasons()
    seasons.value = (s.data || []).map((x: any) => ({ name: x.name, label: x.label, color: x.color }))
  } catch { /* sin temporadas → columnas por defecto */ }
  await loadRates()
})
</script>
