<template>
  <div class="rounded-[20px] border border-white/8 bg-[#0B1526] p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-xs font-black uppercase tracking-wider text-white">Mapa de Habitaciones</h2>
      <div class="flex flex-wrap gap-3">
        <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <span class="h-2.5 w-2.5 rounded-sm" :style="{ background: l.color }"></span>{{ l.label }}
        </span>
      </div>
    </div>

    <div class="mt-5 space-y-5">
      <div v-for="floor in floors" :key="floor.number">
        <div class="mb-2 flex items-center gap-2">
          <span class="text-[10px] font-extrabold uppercase tracking-[2px] text-slate-500">Piso {{ floor.number }}</span>
          <span class="h-px flex-1 bg-white/6"></span>
          <span class="text-[10px] font-bold tabular-nums text-slate-500">{{ floor.occupied }}/{{ floor.rooms.length }} ocupadas</span>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
          <button v-for="room in floor.rooms" :key="room.id" @click="$emit('select', room)"
            class="cc-cell group relative flex aspect-square flex-col items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer"
            :style="cellStyle(room)"
            :title="`Hab. ${room.number} · ${STATUS_LABEL[room.status] ?? room.status}`">
            <span class="text-sm font-black tabular-nums text-white drop-shadow">{{ room.number }}</span>
            <span class="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-white/70">{{ STATUS_SHORT[room.status] ?? '' }}</span>
            <span v-if="room.status === 'occupied'" class="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white/80"></span>
          </button>
        </div>
      </div>
      <div v-if="!floors.length" class="py-6 text-center text-xs text-slate-500">Sin habitaciones registradas</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Room } from '@/types'

const props = defineProps<{ rooms: Room[] }>()
defineEmits<{ select: [room: Room] }>()

const STATUS_COLOR: Record<string, string> = {
  available: '#22C55E',
  occupied: '#EF4444',
  cleaning: '#F59E0B',
  dirty: '#FB923C',
  pending: '#06B6D4',
  out_of_service: '#475569',
}
const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible', occupied: 'Ocupada', cleaning: 'En limpieza',
  dirty: 'Sucia', pending: 'Check-in pendiente', out_of_service: 'Mantenimiento',
}
const STATUS_SHORT: Record<string, string> = {
  available: 'Libre', occupied: 'Ocupada', cleaning: 'Limpieza',
  dirty: 'Sucia', pending: 'Llegada', out_of_service: 'F/S',
}
const LEGEND = [
  { label: 'Disponible', color: '#22C55E' },
  { label: 'Ocupada', color: '#EF4444' },
  { label: 'Limpieza', color: '#F59E0B' },
  { label: 'Llegada', color: '#06B6D4' },
  { label: 'F/S', color: '#475569' },
]

const floors = computed(() => {
  const byFloor = new Map<number, Room[]>()
  for (const r of props.rooms) {
    const f = r.floor ?? 0
    if (!byFloor.has(f)) byFloor.set(f, [])
    byFloor.get(f)!.push(r)
  }
  return [...byFloor.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, rooms]) => ({
      number,
      rooms: rooms.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true })),
      occupied: rooms.filter(r => r.status === 'occupied').length,
    }))
})

function cellStyle(room: Room) {
  const c = STATUS_COLOR[room.status] ?? '#475569'
  return {
    background: `linear-gradient(160deg, ${c}33 0%, ${c}14 100%)`,
    borderColor: `${c}55`,
    boxShadow: `inset 0 0 12px ${c}22`,
  }
}
</script>

<style scoped>
.cc-cell:hover {
  transform: translateY(-2px) scale(1.04);
  filter: brightness(1.3);
}
</style>
