<template>
  <SectionCard title="Tarifas por canal" subtitle="Precio base + ajuste por temporada" class="mb-8">
    <template #actions>
      <select v-if="channels.length > 1" v-model="selectedChannel" @change="loadRates"
        class="px-3 py-2 rounded-lg border-2 border-white/20 bg-white/10 text-sm font-bold text-white outline-none cursor-pointer">
        <option v-for="c in channels" :key="c.code" :value="c.code" class="text-navy">{{ c.name }}</option>
      </select>
      <span v-else class="px-3 py-2 rounded-lg bg-white/10 text-sm font-bold text-white">{{ channels[0]?.name }}</span>
      <button @click="save" :disabled="saving || !selectedChannel"
        class="rounded-lg bg-cyan text-navy text-sm font-extrabold px-5 py-2 border-2 border-cyan hover:bg-cyan-light transition-all cursor-pointer disabled:opacity-50">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </template>

    <!-- Leyenda de temporadas -->
      <div class="flex flex-wrap gap-x-4 gap-y-2 mb-4">
        <span v-for="s in seasons" :key="s.name" class="flex items-center gap-1.5 text-[11px] font-bold text-text-secondary">
          <span class="w-3 h-3 rounded-full border border-navy/20" :style="{ background: s.color }"></span>{{ s.label || s.name }}
        </span>
      </div>

      <div v-if="loading" class="text-center py-10 text-text-muted text-sm">Cargando tarifas…</div>
      <div v-else-if="groups.length === 0" class="text-center py-10 text-text-muted text-sm">
        No hay habitaciones con tipo definido para configurar tarifas.
      </div>

      <!-- Una tarjeta por habitación (roomType × ocupación) -->
      <div v-else class="space-y-4">
        <div v-for="g in groups" :key="g.key" class="rounded-2xl border-2 border-navy overflow-hidden">
          <div class="bg-surface border-b-2 border-navy px-4 py-2.5">
            <h3 class="text-sm font-black text-navy capitalize">{{ g.roomType }} <span class="text-text-muted font-bold normal-case">· {{ g.occupancy }} pers.</span></h3>
          </div>
          <!-- Responsive: en móvil General arriba + temporadas 2×2; en desktop General a la izq + 4 temporadas en fila -->
          <div class="p-3 grid grid-cols-1 lg:grid-cols-[190px_1fr] gap-3">
            <!-- General + días mín/máx -->
            <div class="rounded-xl border-2 border-navy bg-surface p-3">
              <div class="text-[10px] font-black text-text-muted uppercase mb-1">Tarifa base (General)</div>
              <div class="flex items-center gap-1 mb-2">
                <input type="number" min="0" step="0.01" inputmode="decimal" v-model.number="g.basePrice"
                  class="w-full px-2 py-1.5 rounded-lg border-2 border-navy/30 text-sm font-black text-navy text-right focus:border-navy outline-none" />
                <span class="text-xs text-text-muted shrink-0">{{ currency }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <div class="text-[10px] text-text-muted">Días mín.</div>
                  <input type="number" min="0" inputmode="numeric" v-model.number="g.minStay" class="w-full px-2 py-1 rounded-lg border-2 border-navy/30 text-xs text-right focus:border-navy outline-none" />
                </div>
                <div>
                  <div class="text-[10px] text-text-muted">Días máx.</div>
                  <input type="number" min="0" inputmode="numeric" v-model.number="g.maxStay" class="w-full px-2 py-1 rounded-lg border-2 border-navy/30 text-xs text-right focus:border-navy outline-none" />
                </div>
              </div>
            </div>

            <!-- Temporadas: 2 columnas en móvil, 4 en desktop -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div v-for="cell in g.cells" :key="cell.season" class="rounded-xl border-2 border-navy overflow-hidden flex flex-col">
                <div class="px-2.5 py-1.5 text-[10px] font-black uppercase text-white truncate" :style="{ background: seasonColor(cell.season) }">{{ seasonLabel(cell.season) }}</div>
                <div class="p-2.5 flex flex-col gap-1.5 flex-1">
                  <div class="flex items-center gap-1">
                    <span class="text-xs font-black text-navy">+</span>
                    <input type="number" step="0.01" inputmode="decimal" v-model.number="cell.percentage"
                      class="w-full min-w-0 px-2 py-1.5 rounded-lg border-2 border-navy/30 text-sm font-black text-navy text-right focus:border-navy outline-none" />
                    <span class="text-xs text-text-muted">%</span>
                  </div>
                  <div class="text-sm font-black text-teal">= {{ resultPrice(g.basePrice, cell.percentage) }} <span class="text-[10px] text-text-muted">{{ currency }}</span></div>
                  <button @click="cell.closed = cell.closed ? 0 : 1"
                    class="mt-auto w-full py-1.5 text-[10px] font-black rounded-lg border-2 transition-colors cursor-pointer"
                    :class="cell.closed ? 'bg-coral border-coral text-white' : 'border-navy/30 text-text-secondary hover:border-coral hover:text-coral'">
                    {{ cell.closed ? 'Ventas cerradas' : 'Cerrar ventas' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  </SectionCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SectionCard from '@/components/ui/SectionCard.vue'
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
