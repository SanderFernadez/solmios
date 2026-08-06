<template>
  <!--
    PoliciesBlock — "Políticas y condiciones" de la landing pública.

    QUÉ ARREGLA: hasta acá la única mención de la política de cancelación era una respuesta de FAQ
    COLAPSADA, escrita a mano por el hotel, que además remitía a "los términos exactos en el
    detalle de tu reserva" (un detalle que no existe). El huésped no tenía forma de leer, antes de
    reservar, las condiciones que el sistema le va a aplicar.

    REGLAS DE ESTE BLOQUE:
      1. Todo lo que se muestra viene de la configuración real del hotel. NO hay copy legal
         inventado ni texto por defecto.
      2. La cancelación se deriva de `cancellationSummary` (inject) — la MISMA política con la que
         el backend calcula la penalidad al cancelar. El texto libre `cancellationPolicy` no se
         muestra: en producción contradice a la política vigente y no hay forma de saber cuál de
         los dos está desactualizado.
      3. Dato que falta = dato que se OMITE. Sin política resuelta no hay tarjeta de cancelación
         (jamás se afirma que se cancela gratis). Sin ninguna tarjeta, el bloque no se renderiza.
  -->
  <section v-if="cards.length > 0" class="max-w-6xl mx-auto px-6 py-16">
    <header class="mb-8 text-center">
      <p class="text-[11px] uppercase tracking-[0.18em] font-bold text-cyan mb-2">Antes de reservar</p>
      <h2 class="text-3xl sm:text-4xl font-black text-navy tracking-tight">{{ title }}</h2>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="bg-white rounded-xl border border-border p-5"
      >
        <div class="flex items-center gap-3 mb-3">
          <span
            class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-cyan/10 text-cyan [&_svg]:w-4 [&_svg]:h-4"
            v-html="card.icon"
          />
          <h3 class="text-sm font-black text-navy leading-tight">{{ card.label }}</h3>
        </div>
        <dl class="space-y-1.5">
          <div v-for="(row, i) in card.rows" :key="i" class="text-sm leading-relaxed">
            <dt v-if="row.term" class="text-[11px] uppercase tracking-wide font-bold text-text-muted">
              {{ row.term }}
            </dt>
            <dd :class="row.muted ? 'text-text-secondary' : 'font-bold text-navy'">{{ row.value }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LandingBlock, PublicHotelInfo, PublicHotelMedia } from '@/types'
import { useLandingCancellation } from '@/composables/useLandingPolicy'
import { trustIcon, ICON_CLOCK, ICON_CHECK_CIRCLE } from './landing-icons'

const props = defineProps<{
  block: LandingBlock
  hotel: PublicHotelInfo
  media: PublicHotelMedia | null
}>()

/** Política vigente del hotel (misma que rige el cálculo del reembolso). `null` = no se muestra. */
const cancellation = useLandingCancellation()

const cfg = computed(() => (props.block.config ?? {}) as Record<string, unknown>)

const title = computed(() => {
  const t = typeof cfg.value.title === 'string' ? cfg.value.title.trim() : ''
  return t || 'Políticas y condiciones'
})

interface PolicyRow { term?: string; value: string; muted?: boolean }
interface PolicyCard { key: string; label: string; icon: string; rows: PolicyRow[] }

/**
 * "7 días" / "48 horas". Solo redondea a días cuando el número es exacto — un plazo de 30 horas
 * se dice en horas, no en "1,25 días".
 */
function formatAnticipation(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24
    return `${days} ${days === 1 ? 'día' : 'días'}`
  }
  return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
}

/**
 * Tarjeta de cancelación derivada de `cancellationSummary`:
 *   - `penaltyDescription` lo arma el backend a partir de los MISMOS tiers que aplica al cancelar
 *     ("Cancelación gratuita en cualquier momento" / "No reembolsable" / "Después: hasta N% …").
 *   - La ventana sin cargo solo se anuncia si existe de verdad Y hay una penalidad después
 *     (con política sin penalidades, el `deadlineHours` del preset flexible es un centinela de
 *     99999 h que no significa nada para el huésped).
 */
const cancellationCard = computed<PolicyCard | null>(() => {
  const summary = cancellation.value
  if (!summary) return null
  // `source: 'default'` = el hotel NO configuró NINGUNA política (ni filas propias ni
  // `cancellationType`): el backend cae a un flexible de seguridad para no bloquear una
  // cancelación legítima. Ese fallback es una decisión defensiva del sistema, no una condición
  // que el hotel haya ofrecido — publicarlo sería exactamente el error que este bloque corrige
  // (prometer cancelación gratis por default). Se omite; el hotelero la configura y aparece.
  if (summary.source === 'default') return null

  const tiers = Array.isArray(summary.tiers) ? summary.tiers : []
  const penalized = tiers.some((t) => Number(t?.penaltyPercent) > 0)
  const freeHours = summary.freeUntilHours
  const rows: PolicyRow[] = []

  if (penalized && typeof freeHours === 'number' && Number.isFinite(freeHours) && freeHours > 0) {
    rows.push({ value: `Sin cargo hasta ${formatAnticipation(freeHours)} antes del check-in` })
    if (summary.penaltyDescription) rows.push({ value: summary.penaltyDescription, muted: true })
  } else if (summary.penaltyDescription) {
    rows.push({ value: summary.penaltyDescription })
  }

  if (rows.length === 0) return null
  return { key: 'cancellation', label: 'Cancelación', icon: trustIcon('refund'), rows }
})

/** Horarios de entrada/salida (`hotels.checkIn`/`checkOut`). Se omite el que no esté cargado. */
const scheduleCard = computed<PolicyCard | null>(() => {
  const rows: PolicyRow[] = []
  const checkIn = (props.hotel.checkIn ?? '').trim()
  const checkOut = (props.hotel.checkOut ?? '').trim()
  if (checkIn) rows.push({ term: 'Check-in', value: `Desde las ${checkIn}` })
  if (checkOut) rows.push({ term: 'Check-out', value: `Hasta las ${checkOut}` })
  if (rows.length === 0) return null
  return { key: 'schedule', label: 'Horarios', icon: ICON_CLOCK, rows }
})

/**
 * Límites de estadía (`booking_config`). El mínimo solo se anuncia si realmente restringe
 * (minNights > 1: "mínimo 1 noche" no es una condición, es la unidad de venta).
 */
const stayCard = computed<PolicyCard | null>(() => {
  const rows: PolicyRow[] = []
  const min = Number(props.hotel.minNights)
  const max = Number(props.hotel.maxNights)
  if (Number.isFinite(min) && min > 1) {
    rows.push({ term: 'Mínimo', value: `${min} noches` })
  }
  if (Number.isFinite(max) && max > 0) {
    rows.push({ term: 'Máximo', value: `${max} ${max === 1 ? 'noche' : 'noches'}` })
  }
  if (rows.length === 0) return null
  return { key: 'stay', label: 'Estadía', icon: ICON_CHECK_CIRCLE, rows }
})

const cards = computed<PolicyCard[]>(() =>
  [cancellationCard.value, scheduleCard.value, stayCard.value].filter((c): c is PolicyCard => c !== null),
)
</script>
