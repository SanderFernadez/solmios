<template>
  <div class="cc-card flex flex-col overflow-hidden rounded-[20px] border border-border shadow-(--shadow-card)">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div class="flex items-center gap-2.5">
        <span class="grid h-8 w-8 place-items-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/></svg>
        </span>
        <h2 class="text-sm font-black uppercase tracking-wider text-navy">Calendario de Reservas</h2>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Navegación -->
        <div class="flex items-center gap-1 rounded-xl border border-border bg-surface px-1 py-1">
          <button @click="shift(-1)" class="cc-nav-btn" title="Anterior">‹</button>
          <button @click="goToday" class="rounded-lg px-3 py-1 text-[11px] font-extrabold text-navy hover:bg-black/5 cursor-pointer">Hoy</button>
          <button @click="shift(1)" class="cc-nav-btn" title="Siguiente">›</button>
        </div>
        <span class="min-w-[150px] text-center text-xs font-bold text-text-secondary tabular-nums">{{ rangeLabel }}</span>

        <!-- Vista -->
        <div class="flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1">
          <button v-for="v in VIEWS" :key="v.days" @click="viewDays = v.days"
            class="rounded-lg px-3 py-1 text-[11px] font-extrabold transition-colors cursor-pointer"
            :class="viewDays === v.days ? 'bg-[#2563EB] text-white' : 'text-text-secondary hover:text-navy'">
            {{ v.label }}
          </button>
        </div>

        <!-- Zoom -->
        <div class="flex items-center gap-1 rounded-xl border border-border bg-surface px-1 py-1">
          <button @click="zoomBy(-1)" class="cc-nav-btn" title="Alejar">−</button>
          <span class="min-w-[44px] text-center text-[11px] font-extrabold tabular-nums text-text-secondary">{{ zoomPct }}%</span>
          <button @click="zoomBy(1)" class="cc-nav-btn" title="Acercar">+</button>
        </div>
      </div>
    </div>

    <!-- Grid -->
    <div class="cc-scroll relative overflow-x-auto">
      <div class="min-w-max select-none">
        <!-- Header de días -->
        <div class="sticky top-0 z-20 flex border-b border-border bg-white/95 backdrop-blur">
          <div class="sticky left-0 z-10 w-44 shrink-0 border-r border-border bg-white px-4 py-3">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Habitaciones</span>
          </div>
          <div v-for="day in days" :key="day.dateStr" class="shrink-0 border-r border-slate-300 px-1 py-1.5 text-center"
            :style="{ width: `${cellW}px` }" :class="!day.isToday && day.isWeekend ? 'bg-[#2563EB]/8' : ''">
            <div class="mx-auto inline-flex min-w-[44px] flex-col items-center rounded-lg px-2 py-1"
              :class="day.isToday ? 'bg-[#2563EB] shadow-[0_0_14px_rgba(37,99,235,0.35)]' : ''">
              <div class="text-[9px] font-extrabold uppercase tracking-wide" :class="day.isToday ? 'text-white/80' : 'text-text-muted'">{{ day.dayName }}</div>
              <div class="text-sm font-black tabular-nums leading-tight" :class="day.isToday ? 'text-white' : 'text-navy'">{{ day.dayNum }}</div>
            </div>
          </div>
        </div>

        <!-- Filas por habitación -->
        <div class="relative">
          <!-- Línea "ahora" -->
          <div v-if="nowOffsetPx !== null" class="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-[#3B82F6]"
            :style="{ left: `${176 + nowOffsetPx}px`, boxShadow: '0 0 8px rgba(59,130,246,0.5)' }"></div>

          <div v-for="row in rows" :key="row.room.id" class="flex border-b border-slate-200 hover:bg-surface transition-colors">
            <!-- Etiqueta habitación -->
            <div class="sticky left-0 z-10 flex w-44 shrink-0 items-center gap-2.5 border-r border-border bg-white px-4 py-1.5">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="ROOM_DOT[row.room.status] ?? 'bg-slate-500'"></span>
              <div class="min-w-0">
                <div class="text-sm font-black tabular-nums text-navy">{{ row.room.number }}</div>
                <div class="truncate text-[9px] font-semibold uppercase tracking-wide text-text-muted">{{ row.room.name || row.room.type }}</div>
              </div>
            </div>

            <!-- Celdas (drop targets) -->
            <div class="relative flex" :style="{ width: `${days.length * cellW}px`, height: '46px' }">
              <div v-for="day in days" :key="day.dateStr" class="h-full shrink-0 border-r border-slate-200"
                :style="{ width: `${cellW}px` }" :class="day.isToday ? 'bg-[#2563EB]/6' : day.isWeekend ? 'bg-[#2563EB]/8' : ''"
                :data-date="day.dateStr" :data-rid="row.room.id"
                @dragover.prevent @drop="onDrop(row.room, day.dateStr)"></div>

              <!-- Barras de reserva -->
              <div v-for="bar in row.bars" :key="bar.res.id"
                class="cc-bar group absolute top-1.5 flex h-8 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2.5 transition-shadow"
                :style="barStyle(bar)"
                draggable="true"
                @dragstart="onDragStart($event, bar)"
                @click="$emit('open', bar.res)"
                @mouseenter="showTip($event, bar)" @mousemove="moveTip($event)" @mouseleave="hideTip">
                <span class="truncate text-[11px] font-extrabold text-white drop-shadow">{{ bar.res.guestName || 'Huésped' }}</span>
                <span class="hidden shrink-0 text-[9px] font-semibold text-white/70 md:inline">{{ bar.nights }} noche{{ bar.nights === 1 ? '' : 's' }}</span>
                <!-- Handle de resize -->
                <span v-if="!bar.clippedEnd"
                  class="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/0 opacity-0 transition-opacity group-hover:bg-white/25 group-hover:opacity-100"
                  @mousedown.stop.prevent="startResize(bar)"></span>
              </div>
            </div>
          </div>

          <div v-if="!rows.length && !loading" class="px-6 py-10 text-center text-sm text-text-muted">Sin habitaciones para mostrar</div>
        </div>
      </div>
    </div>

    <!-- Leyenda -->
    <div class="flex flex-wrap items-center gap-4 border-t border-border px-5 py-3">
      <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary">
        <span class="h-2.5 w-2.5 rounded" :style="{ background: l.color }"></span>{{ l.label }}
      </span>
      <span class="ml-auto text-[10px] text-text-muted">Arrastrá una reserva para moverla · Estirá el borde derecho para extenderla</span>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div v-if="tip.show && tip.bar" class="pointer-events-none fixed z-[80] w-60 rounded-xl border border-border bg-white p-3 shadow-xl"
        :style="{ left: `${tip.x}px`, top: `${tip.y}px` }">
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-black text-navy">{{ tip.bar.res.guestName || 'Huésped' }}</span>
          <span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase text-white" :style="{ background: STATUS_COLOR[tip.bar.res.status] }">
            {{ STATUS_LABEL[tip.bar.res.status] ?? tip.bar.res.status }}
          </span>
        </div>
        <div class="mt-2 space-y-1 text-[11px] text-text-secondary">
          <div class="flex justify-between"><span class="text-text-muted">Habitación</span><span class="font-bold tabular-nums">{{ tip.bar.res.roomNumber ?? tip.bar.roomNumber }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Estancia</span><span class="font-bold tabular-nums">{{ fmtDate(tip.bar.checkIn) }} → {{ fmtDate(tip.bar.checkOut) }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Noches</span><span class="font-bold tabular-nums">{{ tip.bar.nights }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Canal</span><span class="font-bold capitalize">{{ SOURCE_LABEL[tip.bar.res.source] ?? tip.bar.res.source }}</span></div>
          <div class="flex justify-between"><span class="text-text-muted">Total</span><span class="font-bold tabular-nums">${{ (tip.bar.res.totalAmount ?? 0).toLocaleString() }}</span></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { Reservation, Room } from '@/types'
import { ReservationService } from '@/services/Reservation.service'
import { useToast } from '@/composables/useToast'

interface Bar {
  res: Reservation
  roomNumber: string
  checkIn: string
  checkOut: string
  startIdx: number
  span: number
  nights: number
  clippedStart: boolean
  clippedEnd: boolean
}

const props = defineProps<{ rooms: Room[]; reservations: Reservation[]; loading?: boolean }>()
const emit = defineEmits<{ open: [res: Reservation]; changed: [] }>()

const toast = useToast()

const MS_DAY = 86_400_000
const VIEWS = [
  { label: 'Día', days: 1 },
  { label: 'Semana', days: 7 },
  { label: 'Mes', days: 30 },
]
const BASE_CELL_W = 92
const ZOOM_STEPS = [48, 64, 80, 92, 110, 132, 160]

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#16A34A',
  checked_in: '#0891B2',
  checked_out: '#7C3AED',
  pending: '#D97706',
}
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada',
  checked_in: 'Check-in',
  checked_out: 'Check-out',
  pending: 'Pendiente',
}
const SOURCE_LABEL: Record<string, string> = {
  direct: 'Directo', phone: 'Teléfono', whatsapp: 'WhatsApp', booking: 'Booking.com',
  expedia: 'Expedia', agoda: 'Agoda', airbnb: 'Airbnb', google: 'Google', other: 'Otro',
}
const ROOM_DOT: Record<string, string> = {
  available: 'bg-[#22C55E]',
  occupied: 'bg-[#EF4444]',
  cleaning: 'bg-[#F59E0B]',
  dirty: 'bg-[#F59E0B]',
  pending: 'bg-[#06B6D4]',
  out_of_service: 'bg-slate-600',
}
const LEGEND = [
  { label: 'Confirmada', color: '#16A34A' },
  { label: 'Check-in', color: '#0891B2' },
  { label: 'Check-out', color: '#7C3AED' },
  { label: 'Pendiente', color: '#D97706' },
]

function toDateStr(d: Date) {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
// Arranca en "hoy" (no en el lunes de la semana) — mismo criterio que Planning
// (planning/index.vue), así ambos calendarios muestran por defecto el mismo
// rango de reservas visibles en vez de ventanas desalineadas.
function startOfToday(): Date {
  return new Date(new Date().setHours(0, 0, 0, 0))
}
function fmtDate(ds: string) {
  const d = new Date(`${ds}T00:00:00`)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

const viewDays = ref(7)
const anchor = ref(startOfToday())
const cellW = ref(BASE_CELL_W)
const zoomPct = computed(() => Math.round((cellW.value / BASE_CELL_W) * 100))

function zoomBy(dir: 1 | -1) {
  const idx = ZOOM_STEPS.indexOf(cellW.value)
  const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (idx === -1 ? 3 : idx) + dir))]
  cellW.value = next
}
function shift(dir: 1 | -1) {
  const d = new Date(anchor.value); d.setDate(d.getDate() + dir * viewDays.value)
  anchor.value = d
}
function goToday() {
  anchor.value = startOfToday()
}

const days = computed(() => {
  const todayStr = toDateStr(new Date())
  return Array.from({ length: viewDays.value }, (_, i) => {
    const d = new Date(anchor.value); d.setDate(d.getDate() + i)
    const dateStr = toDateStr(d)
    return {
      dateStr,
      dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
      dayNum: d.getDate(),
      isToday: dateStr === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  })
})

const rangeLabel = computed(() => {
  const first = days.value[0]; const last = days.value[days.value.length - 1]
  if (!first || !last) return ''
  const f = new Date(`${first.dateStr}T00:00:00`); const l = new Date(`${last.dateStr}T00:00:00`)
  if (first.dateStr === last.dateStr) return f.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  if (f.getMonth() !== l.getMonth()) {
    return `${f.getDate()} ${f.toLocaleDateString('es-ES', { month: 'short' })} – ${l.getDate()} ${l.toLocaleDateString('es-ES', { month: 'short' })}, ${l.getFullYear()}`
  }
  return `${f.getDate()} – ${l.getDate()} de ${l.toLocaleDateString('es-ES', { month: 'long' })}, ${l.getFullYear()}`
})

const nowOffsetPx = computed(() => {
  const todayIdx = days.value.findIndex(d => d.isToday)
  if (todayIdx === -1) return null
  const now = new Date()
  const frac = (now.getHours() * 3600 + now.getMinutes() * 60) / 86400
  return (todayIdx + frac) * cellW.value
})

const rows = computed(() => {
  const windowStart = days.value[0]?.dateStr ?? ''
  const windowEndExcl = (() => {
    const d = new Date(anchor.value); d.setDate(d.getDate() + viewDays.value)
    return toDateStr(d)
  })()

  const sorted = [...props.rooms].sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))

  return sorted.map(room => {
    const bars: Bar[] = []
    for (const res of props.reservations) {
      if (res.status === 'cancelled') continue
      if (String(res.roomId) !== String(room.id)) continue
      const ci = String(res.checkIn ?? '').slice(0, 10)
      const co = String(res.checkOut ?? '').slice(0, 10)
      if (!ci || !co || co <= windowStart || ci >= windowEndExcl) continue

      const clippedStart = ci < windowStart
      const clippedEnd = co > windowEndExcl
      const visStart = clippedStart ? windowStart : ci
      const visEnd = clippedEnd ? windowEndExcl : co
      const startIdx = days.value.findIndex(d => d.dateStr === visStart)
      const span = Math.max(1, Math.round((new Date(visEnd).getTime() - new Date(visStart).getTime()) / MS_DAY))
      const nights = Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / MS_DAY))
      bars.push({ res, roomNumber: String(room.number), checkIn: ci, checkOut: co, startIdx: Math.max(0, startIdx), span, nights, clippedStart, clippedEnd })
    }
    return { room, bars }
  })
})

function barStyle(bar: Bar) {
  const color = STATUS_COLOR[bar.res.status] ?? '#475569'
  return {
    left: `${bar.startIdx * cellW.value + 3}px`,
    width: `${bar.span * cellW.value - 6}px`,
    background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
    boxShadow: `0 2px 10px ${color}55`,
    borderTopLeftRadius: bar.clippedStart ? '0' : undefined,
    borderBottomLeftRadius: bar.clippedStart ? '0' : undefined,
    borderTopRightRadius: bar.clippedEnd ? '0' : undefined,
    borderBottomRightRadius: bar.clippedEnd ? '0' : undefined,
  }
}

// ── Tooltip ─────────────────────────────────────────────────────────────
const tip = ref<{ show: boolean; x: number; y: number; bar: Bar | null }>({ show: false, x: 0, y: 0, bar: null })
function showTip(e: MouseEvent, bar: Bar) { tip.value = { show: true, x: clampX(e.clientX), y: clampY(e.clientY), bar } }
function moveTip(e: MouseEvent) { if (tip.value.show) { tip.value.x = clampX(e.clientX); tip.value.y = clampY(e.clientY) } }
function hideTip() { tip.value.show = false }
function clampX(x: number) { return Math.min(x + 14, window.innerWidth - 260) }
function clampY(y: number) { return Math.min(y + 14, window.innerHeight - 190) }

// ── Drag & drop (mover reserva de habitación/fecha) ─────────────────────
const dragging = ref<{ id: string; grabOffsetDays: number; nights: number } | null>(null)

function onDragStart(e: DragEvent, bar: Bar) {
  hideTip()
  // offset: día de la barra donde se agarró, para conservar la posición relativa al soltar
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const dayInBar = Math.floor((e.clientX - rect.left) / cellW.value)
  const clipOffset = bar.clippedStart
    ? Math.round((new Date(days.value[0].dateStr).getTime() - new Date(bar.checkIn).getTime()) / MS_DAY)
    : 0
  dragging.value = { id: bar.res.id, grabOffsetDays: dayInBar + clipOffset, nights: bar.nights }
  e.dataTransfer!.effectAllowed = 'move'
}

async function onDrop(room: Room, dateStr: string) {
  const drag = dragging.value
  dragging.value = null
  if (!drag) return
  const res = props.reservations.find(r => r.id === drag.id)
  if (!res) return

  const newCi = new Date(`${dateStr}T00:00:00`)
  newCi.setDate(newCi.getDate() - drag.grabOffsetDays)
  const newCo = new Date(newCi); newCo.setDate(newCo.getDate() + drag.nights)
  const ciStr = toDateStr(newCi); const coStr = toDateStr(newCo)

  const sameRoom = String(res.roomId) === String(room.id)
  const sameDates = String(res.checkIn).slice(0, 10) === ciStr
  if (sameRoom && sameDates) return

  try {
    await ReservationService.update(res.id, { roomId: room.id, checkIn: ciStr, checkOut: coStr })
    toast.success(`Reserva movida a Hab. ${room.number} · ${fmtDate(ciStr)}`)
    emit('changed')
  } catch {
    toast.error('No se pudo mover la reserva')
  }
}

// ── Resize (extender/acortar checkout) ──────────────────────────────────
const resizing = ref<{ bar: Bar; previewEnd: string } | null>(null)

function startResize(bar: Bar) {
  hideTip()
  resizing.value = { bar, previewEnd: bar.checkOut }
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeUp)
}
function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  const cell = el?.closest('[data-date]') as HTMLElement | null
  const date = cell?.dataset.date
  if (date) resizing.value.previewEnd = date
}
async function onResizeUp() {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
  const r = resizing.value
  resizing.value = null
  if (!r) return

  // checkout exclusivo: la nueva salida es el día siguiente a la última celda apuntada
  const end = new Date(`${r.previewEnd}T00:00:00`); end.setDate(end.getDate() + 1)
  const ci = r.bar.checkIn
  let coStr = toDateStr(end)
  if (coStr <= ci) { const min = new Date(`${ci}T00:00:00`); min.setDate(min.getDate() + 1); coStr = toDateStr(min) }
  if (coStr === r.bar.checkOut) return

  try {
    await ReservationService.update(r.bar.res.id, { checkOut: coStr })
    toast.success(`Salida actualizada al ${fmtDate(coStr)}`)
    emit('changed')
  } catch {
    toast.error('No se pudo cambiar la salida')
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeUp)
})
</script>

<style scoped>
.cc-card { background: white; }
.cc-nav-btn {
  width: 26px; height: 26px;
  display: grid; place-items: center;
  border-radius: 8px;
  color: rgb(100 116 139);
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cc-nav-btn:hover { background: rgba(0, 0, 0, 0.06); color: #0D2B4E; }
.cc-bar:hover { filter: brightness(1.1); }
.cc-scroll { max-height: 460px; overflow-y: auto; }
.cc-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.02); }
.cc-scroll::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); }
</style>
