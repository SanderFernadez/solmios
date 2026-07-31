<template>
  <!--
    CalendarView.vue — Calendario estilo Airbnb para SearchStep (F2 2.17, solmi-direct-booking).

    FIX 2026-07-31 (bug off-by-one reportado por QA/usuario) — Click 2 = FECHA DE CHECKOUT
    directa, no "última noche + 1". La versión anterior trataba la segunda celda clickeada
    como la última noche hospedada y sumaba 1 día para el checkout — así, clickear el día 6
    esperando salir el 6 terminaba reservando (y cobrando) hasta el 7. Esto NO es cómo
    funciona Airbnb/Booking real: ahí el segundo click ES el día de salida.

    Selección (Click 1 = llegada, Click 2 = salida):
      - Click 1 = checkIn (pendingStart).
      - Hover/enter en otra celda = preview visual: noches resaltadas = [start, preview-1],
        la celda hovereada se marca aparte como "checkout" (no se pinta como noche pagada).
      - Click 2 (posterior al inicio) = checkOut = esa celda TAL CUAL (sin +1). Las noches
        pagadas son [checkIn, checkOut-1] — un click en el 6 con inicio el 5 = 1 noche.
      - Click en celda anterior o igual al inicio → reinicia el rango (esa celda es el nuevo start).

    Anti-bug (mem): las noches se calculan con un `computed` a partir de store.checkIn/checkOut,
    NUNCA como `ref` fijo que se actualiza a mano. Un `ref` se desincroniza si el usuario
    cambia la selección por teclado o programa; un `computed` siempre refleja el estado real.
    El total (en PayStep) ya es computed sobre `selectedRoom.fromPrice × nights`.

    Escribir directo al store (`store.checkIn`/`store.checkOut`) significa que TODO el widget
    reacciona: el botón "Ver disponibilidad" se habilita, el PayStep muestra el total correcto,
    la urgencia D11 recalcula, etc. Sin wiring extra.

    Mobile-first: 1 mes visible en mobile con nav entre meses, 2 meses lado a lado en sm+.
    Sin librería externa (no vue-calendly/date-fns) — menos bundle, mejor Lighthouse.
  -->
  <div class="space-y-3">
    <!-- Header: navegación entre meses + leyenda de noches seleccionadas. -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        class="rounded-lg p-2 text-navy hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
        :disabled="!canGoPrev"
        :aria-label="i18n.t('calendar.prevMonth')"
        @click="goPrev"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div class="flex gap-4 sm:gap-8">
        <div
          v-for="m in visibleMonths"
          :key="`${m.year}-${m.month}`"
          class="text-center text-sm font-black text-navy"
        >
          {{ i18n.t(monthKey(m.month)) }} {{ m.year }}
        </div>
      </div>
      <button
        type="button"
        class="rounded-lg p-2 text-navy hover:bg-slate-100 disabled:opacity-30"
        :aria-label="i18n.t('calendar.nextMonth')"
        @click="goNext"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>

    <!-- Grid de los meses visibles. -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div v-for="m in visibleMonths" :key="`${m.year}-${m.month}`">
        <!-- Encabezado de weekdays (Lunes-Domingo, Monday-based). -->
        <div class="grid grid-cols-7 mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-text-muted">
          <div v-for="w in weekdayShortKeys" :key="w">{{ i18n.t(weekdayKey(w)) }}</div>
        </div>
        <!-- Celdas del mes. Blank cells al inicio para alinear el día 1 con su weekday. -->
        <div class="grid grid-cols-7 gap-0.5">
          <button
            v-for="cell in cellsOfMonth(m)"
            :key="cell.iso || `blank-${cell.day}-${m.month}`"
            type="button"
            :disabled="cell.disabled || !cell.inMonth"
            :aria-label="cell.inMonth ? cell.iso : ''"
            :class="cellClass(cell)"
            @click="onCellClick(cell)"
            @mouseenter="onCellEnter(cell)"
            @focus="onCellEnter(cell)"
            @touchstart.passive="onCellEnter(cell)"
          >
            <span v-if="cell.inMonth">{{ cell.day }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Summary con la selección confirmada + clear. -->
    <div
      v-if="hasValidSelection"
      class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
    >
      <div class="min-w-0 flex-1 text-text-muted">
        <span class="font-bold text-navy">{{ i18n.t('calendar.checkIn') }}:</span>
        <span class="ml-1 text-navy">{{ store.checkIn }}</span>
        <span class="mx-1 text-text-muted">→</span>
        <span class="font-bold text-navy">{{ i18n.t('calendar.checkOut') }}:</span>
        <span class="ml-1 text-navy">{{ store.checkOut }}</span>
        <span class="ml-2 text-text-muted">·</span>
        <span class="ml-2 font-bold text-cyan">{{ i18n.t('calendar.nightsCount', { count: computedNights }) }}</span>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-text-muted hover:text-navy"
        @click="clearSelection"
      >
        {{ i18n.t('calendar.clear') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore, type BookingMessageKey } from '@/composables/useBookingI18n'

const store = useBookingStore()
const i18n = useBookingI18nStore()

interface Cell {
  iso: string // yyyy-mm-dd (vacío para blank cells)
  day: number
  inMonth: boolean
  disabled: boolean // pasado
  today: boolean
}

/** Lunes-based: 0=Lunes, 6=Domingo (más natural para LATAM que Dom=0 de Date.getDay). */
const weekdayShortKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

// FIX 2026-07-31 (bug real de timezone, encontrado por QA en useBooking.ts:searchValid,
// mismo root cause acá) — `toISOString()` convierte el momento actual a UTC ANTES de cortar
// la fecha: en timezones negativos (Santo Domingo UTC-4), durante la noche local la hora UTC
// ya cruzó a mañana, así que `todayIso` daba la fecha de MAÑANA mientras localmente seguía
// siendo hoy — el día de hoy quedaba deshabilitado en el calendario (`iso < todayIso`) para
// cualquier huésped reservando de noche. Fix: componentes de fecha LOCALES (getFullYear/Month/
// Date), sin pasar por UTC en ningún momento. `isoOf`/`pad` están definidos más abajo en este
// mismo scope (function declarations, hoisted).
const _now = new Date()
const todayIso = isoOf(_now.getFullYear(), _now.getMonth(), _now.getDate())

/** pendingStart = primera celda clickeada (esperando segundo click para definir fin del rango).
 *  pendingPreview = hover/enter actual para feedback visual mientras el usuario decide el fin. */
const pendingStart = ref<string | null>(null)
const pendingPreview = ref<string | null>(null)

/** Mes inicial de la vista: si ya hay checkIn, abre ese mes; si no, el mes actual. */
function initialViewStart(): { year: number; month: number } {
  const iso = store.checkIn || todayIso
  const d = parseIso(iso)
  return d ? { year: d.y, month: d.m } : { year: new Date().getFullYear(), month: new Date().getMonth() }
}
const viewStart = ref(initialViewStart())

// ─── Utilidades de fecha (sin date-fns — menos bundle) ─────────────────────────

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}
function weekdayMondayBased(iso: string): number {
  const dow = new Date(iso + 'T00:00:00').getDay() // 0=Dom, 1=Lun, ..., 6=Sab
  return (dow + 6) % 7
}
function isoMinusOneDay(iso: string): string {
  const p = parseIso(iso)
  if (!p) return iso
  const d = new Date(p.y, p.m, p.d - 1)
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate())
}

// ─── Construcción del grid del mes ─────────────────────────────────────────────

/** Construye las celdas de un mes con leading blanks para alinear el día 1 con su weekday. */
function cellsOfMonth(m: { year: number; month: number }): Cell[] {
  const out: Cell[] = []
  const firstIso = isoOf(m.year, m.month, 1)
  const leading = weekdayMondayBased(firstIso)
  for (let i = 0; i < leading; i++) {
    out.push({ iso: '', day: 0, inMonth: false, disabled: true, today: false })
  }
  const dim = daysInMonth(m.year, m.month)
  for (let d = 1; d <= dim; d++) {
    const iso = isoOf(m.year, m.month, d)
    out.push({
      iso,
      day: d,
      inMonth: true,
      disabled: iso < todayIso,
      today: iso === todayIso,
    })
  }
  return out
}

function monthKey(m: number): BookingMessageKey {
  const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const
  const k = keys[m]
  return MONTH_KEYS[k]
}

/** Lookup estático weekday-short-key → BookingMessageKey. Type-safe sin casts de template
 *  string (que TS no puede verificar). Las 12 keys están garantizadas en `messages.es`. */
const MONTH_KEYS: Record<'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun' | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec', BookingMessageKey> = {
  jan: 'calendar.months.jan',
  feb: 'calendar.months.feb',
  mar: 'calendar.months.mar',
  apr: 'calendar.months.apr',
  may: 'calendar.months.may',
  jun: 'calendar.months.jun',
  jul: 'calendar.months.jul',
  aug: 'calendar.months.aug',
  sep: 'calendar.months.sep',
  oct: 'calendar.months.oct',
  nov: 'calendar.months.nov',
  dec: 'calendar.months.dec',
}

const WEEKDAY_KEYS: Record<typeof weekdayShortKeys[number], BookingMessageKey> = {
  mon: 'calendar.weekdaysShort.mon',
  tue: 'calendar.weekdaysShort.tue',
  wed: 'calendar.weekdaysShort.wed',
  thu: 'calendar.weekdaysShort.thu',
  fri: 'calendar.weekdaysShort.fri',
  sat: 'calendar.weekdaysShort.sat',
  sun: 'calendar.weekdaysShort.sun',
}

function weekdayKey(w: typeof weekdayShortKeys[number]): BookingMessageKey {
  return WEEKDAY_KEYS[w]
}

// ─── Navegación entre meses ────────────────────────────────────────────────────

const visibleMonths = computed(() => {
  const a = viewStart.value
  const nextMonth = (a.month + 1) % 12
  const nextYear = nextMonth === 0 ? a.year + 1 : a.year
  return [
    { year: a.year, month: a.month },
    { year: nextYear, month: nextMonth },
  ]
})

const canGoPrev = computed(() => {
  // No permitir navegar antes del mes actual.
  const now = new Date()
  const cy = now.getFullYear()
  const cm = now.getMonth()
  if (viewStart.value.year < cy) return false
  if (viewStart.value.year === cy && viewStart.value.month <= cm) return false
  return true
})

function goPrev(): void {
  if (!canGoPrev.value) return
  const m = viewStart.value.month - 1
  if (m < 0) viewStart.value = { year: viewStart.value.year - 1, month: 11 }
  else viewStart.value = { ...viewStart.value, month: m }
}

function goNext(): void {
  const m = viewStart.value.month + 1
  if (m > 11) viewStart.value = { year: viewStart.value.year + 1, month: 0 }
  else viewStart.value = { ...viewStart.value, month: m }
}

// ─── Selección inclusiva (anti-bug: nada de ref fijo para noches) ──────────────

/**
 * Rango visual para feedback. `end` = última NOCHE pagada (para el fill de "noches");
 * `checkout` = día de salida real, marcado aparte (no se pinta como noche). Origen:
 *   1. Si hay `pendingStart` activo y un preview posterior: noches tentativas
 *      [start, preview-1], checkout tentativo = preview.
 *   2. Si hay selección confirmada en el store: noches [checkIn, checkout-1], checkout
 *      = store.checkOut tal cual (ya NO +1 — ver FIX arriba).
 */
const rangePreview = computed<{ start: string; end: string; checkout: string } | null>(() => {
  if (pendingStart.value) {
    if (pendingPreview.value && pendingPreview.value > pendingStart.value) {
      return { start: pendingStart.value, end: isoMinusOneDay(pendingPreview.value), checkout: pendingPreview.value }
    }
    return { start: pendingStart.value, end: pendingStart.value, checkout: '' }
  }
  if (store.checkIn && store.checkOut && store.checkOut > store.checkIn) {
    return { start: store.checkIn, end: isoMinusOneDay(store.checkOut), checkout: store.checkOut }
  }
  return null
})

function cellClass(cell: Cell): string {
  if (!cell.inMonth) return 'invisible pointer-events-none h-9'
  const r = rangePreview.value
  const inNights = !!(r && cell.iso >= r.start && cell.iso <= r.end)
  const isStart = !!(r && cell.iso === r.start)
  const isCheckout = !!(r && r.checkout && cell.iso === r.checkout)
  const isPendingStart = cell.iso === pendingStart.value
  return [
    'h-9 w-9 rounded-full text-sm font-semibold transition select-none',
    cell.disabled
      ? 'text-text-muted/40 cursor-not-allowed'
      : 'text-navy hover:bg-cyan/10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan/40',
    isStart ? 'bg-cyan text-white font-black hover:bg-cyan' : '',
    (inNights && !isStart) ? 'bg-cyan/20 text-navy' : '',
    // Checkout: marcado como "fin" pero SIN el fill sólido de noche pagada (no es una noche).
    isCheckout ? 'ring-2 ring-cyan font-black text-navy' : '',
    isPendingStart ? 'ring-2 ring-cyan ring-offset-1' : '',
    (cell.today && !inNights && !isCheckout && !isPendingStart) ? 'ring-1 ring-cyan/40 font-bold' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function onCellClick(cell: Cell): void {
  if (cell.disabled || !cell.inMonth) return
  // Primer click (sin pendingStart): marca el inicio del rango.
  if (!pendingStart.value) {
    pendingStart.value = cell.iso
    pendingPreview.value = cell.iso
    store.checkIn = cell.iso
    store.checkOut = ''
    return
  }
  // Click en misma celda o anterior: reinicia el rango con esa celda como nuevo start.
  if (cell.iso <= pendingStart.value) {
    pendingStart.value = cell.iso
    pendingPreview.value = cell.iso
    store.checkIn = cell.iso
    store.checkOut = ''
    return
  }
  // Click posterior: confirma el rango. checkOut = la celda clickeada DIRECTAMENTE (FIX
  // arriba — antes sumaba +1 día, tratando el click como "última noche" en vez de "fecha
  // de salida"). Las noches pagadas quedan [checkIn, checkOut-1].
  store.checkIn = pendingStart.value
  store.checkOut = cell.iso
  pendingStart.value = null
  pendingPreview.value = null
}

function onCellEnter(cell: Cell): void {
  if (!cell.inMonth || cell.disabled) return
  if (!pendingStart.value) return
  pendingPreview.value = cell.iso
}

function clearSelection(): void {
  pendingStart.value = null
  pendingPreview.value = null
  store.checkIn = ''
  store.checkOut = ''
}

const hasValidSelection = computed(() =>
  !!store.checkIn && !!store.checkOut && store.checkOut > store.checkIn,
)

/** Noches COMPUTED (no ref fijo). Bug histórico (mem `planning-calc-inclusive-selection-static-refs`):
 *  un `ref` que se actualiza a mano se desincroniza al cambiar la selección por teclado.
 *  Este computed SIEMPRE refleja el estado real del store. Se muestra en el summary del calendar
 *  y se usa en PayStep via `store.nights` (que también es computed sobre ratesResponse). */
const computedNights = computed(() => {
  if (!store.checkIn || !store.checkOut) return 0
  const a = parseIso(store.checkIn)
  const b = parseIso(store.checkOut)
  if (!a || !b) return 0
  return Math.round(
    (new Date(b.y, b.m, b.d).getTime() - new Date(a.y, a.m, a.d).getTime()) / 86_400_000,
  )
})
</script>

<style scoped>
/* El grid del calendario respeta mobile-first. Sin CSS custom pesado: Tailwind grid-cols-7
   da 7 columnas iguales, gap-0.5 deja aire entre celdas. En mobile un solo mes cabe cómodo
   en pantalla; en sm+ los dos meses lado a lado ocupan ~600px (max-w-md del wrapper). */
</style>
