<template>
  <!--
    RoomsStep.vue — Step 1 del widget (F2 2.9 + D11 urgencia real, solmi-direct-booking).
    Renderiza los room types disponibles de `ratesResponse.roomTypes`. Cada tarjeta muestra:
      - nombre + "From $X total" (fromPrice = TOTAL de la estadía, no por noche)
      - desglose de noches + ITBIS
      - badge de urgencia REAL según availableCount (D11):
          ≤1 → "Última disponible" (rojo)
          ≤3 → "Pocas habitaciones a este precio" (ámbar)
          >3 → sin badge (NEVER falsificar urgencia — destruye confianza)
    Click en una tarjeta la selecciona y avanza al step Upsells (store.selectRoom + store.next).

    El desglose de impuestos viene pre-computado por el backend (roomType.taxBreakdown). Para
    promo, el recálculo lo hace el backend al crear la reserva — acá solo mostramos el base.
    Todos los textos via i18n (es/en/pt, task 2.14).
  -->
  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-xl font-black text-navy">{{ t('rooms.title') }}</h2>
      <p class="text-sm text-text-muted">
        {{ t('rooms.nightsSuffix', { count: store.nights }) }}
        <span v-if="store.displayCurrency"> · {{ t('rooms.pricesIn', { currency: store.displayCurrency }) }}</span>
      </p>
      <!-- F3 3.16 — Aggregate score compacto del widget. Solo se muestra si el hotel tiene
           reviews publicadas y el bloque ReviewsBlock de la landing le pasó el aggregate.
           El widget recibe `reviews` por props desde el wrapper (booking-widget.vue pasa el
           fetch del ReviewsBlock de la landing al widget cuando ambos viven en /book/:slug).
           Si no hay reviews (count=0), AggregateScore se omite. -->
      <div v-if="showAggregateCompact" class="pt-1">
        <AggregateScore
          :aggregate="reviewsAggregate"
          variant="inline"
        />
        <MultiChannelBadges
          v-if="hasExternalSources"
          :aggregate="reviewsAggregate"
          variant="compact"
          class="mt-1.5"
        />
      </div>
    </header>

    <div v-if="availableRooms.length === 0" class="text-center py-10 px-4">
      <div class="text-4xl mb-2">🗓️</div>
      <p class="font-bold text-navy">{{ t('rooms.empty') }}</p>
      <p class="text-sm text-text-muted mt-1">{{ t('rooms.emptyHint') }}</p>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="rt in availableRooms" :key="rt.id">
        <button
          type="button"
          :class="[
            'w-full text-left rounded-2xl border-2 bg-white p-4 shadow-card transition hover:border-cyan',
            store.selectedRoom?.id === rt.id ? 'border-cyan ring-2 ring-cyan/20' : 'border-slate-200',
          ]"
          @click="select(rt)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="font-black text-navy capitalize">{{ prettify(rt.name) }}</h3>
              <p v-if="rt.availableCount > 0" class="text-xs text-text-muted mt-0.5">
                {{ availableLabel(rt.availableCount) }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xs text-text-muted">{{ t('rooms.fromLabel') }}</p>
              <p class="text-lg font-black text-navy">{{ formatPrice(rt.fromPrice, store.displayCurrency) }}</p>
              <p class="text-[11px] text-text-muted">{{ t('rooms.totalSuffix') }} · {{ perNight(rt) }}/{{ t('rooms.perNight') }}</p>
            </div>
          </div>

          <div v-if="rt.taxBreakdown.length > 0" class="mt-2 text-[11px] text-text-muted">
            {{ t('rooms.includes') }}
            <span v-for="(tax, i) in rt.taxBreakdown" :key="tax.name">
              <span v-if="i > 0"> + </span>{{ tax.rate }}% {{ tax.name }}
            </span>
          </div>

          <div v-if="urgency(rt.availableCount)" class="mt-2">
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold',
                rt.availableCount <= 1
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700',
              ]"
            >
              ⚡ {{ urgency(rt.availableCount) }}
            </span>
          </div>
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore } from '@/composables/useBookingI18n'
import type { RoomTypeRate } from '@/types/booking'
import type { PublicReviewAggregate, PublicReviewsResponse } from '@/types'
import MultiChannelBadges from '@/components/reviews/MultiChannelBadges.vue'
import AggregateScore from '@/components/reviews/AggregateScore.vue'

const store = useBookingStore()
const i18n = useBookingI18nStore()
const { t, formatPrice } = i18n

/**
 * F3 3.16 — El widget puede recibir `reviews` por props (desde el wrapper que comparte el
 * fetch con el bloque reviews de la landing). Es opcional: si el wrapper no pasa nada, no
 * se muestran badges (comportamiento pre-F3). En /book/:slug standalone, hoy el wrapper no
 * hace fetch de reviews → quedamos en estado pre-F3 sin romper.
 */
const props = withDefaults(defineProps<{
  reviews?: PublicReviewsResponse | null
}>(), {
  reviews: null,
})

const reviewsAggregate = computed<PublicReviewAggregate>(() =>
  props.reviews?.aggregate ?? { score: null, count: 0, perSource: {} },
)

const showAggregateCompact = computed(() => reviewsAggregate.value.count > 0)

const EXTERNAL_SOURCE_CHANNELS = new Set(['google', 'tripadvisor', 'booking', 'airbnb', 'expedia'])
const hasExternalSources = computed(() => {
  const per = reviewsAggregate.value.perSource
  if (!per) return false
  for (const ch of EXTERNAL_SOURCE_CHANNELS) {
    const stat = per[ch]
    if (stat && Number(stat.count) > 0) return true
  }
  return false
})

// Solo mostramos rooms efectivamente disponibles. El backend podría devolver
// availableCount=0 para un type sin stock; no los mostramos (mejor UX que una card tachada).
const availableRooms = computed(() =>
  (store.ratesResponse?.roomTypes ?? []).filter((rt) => rt.availableCount > 0),
)

/** Urgencia REAL con dato vivo del PMS (D11). Nunca falsificar — si count > 3, sin badge.
 *  Textos via i18n para es/en/pt. */
function urgency(count: number): string {
  if (count <= 0) return ''
  if (count <= 1) return t('rooms.urgency.last')
  if (count <= 3) return t('rooms.urgency.few')
  return '' // >3: sin badge (no falsificar urgencia — D11).
}

function availableLabel(count: number): string {
  if (count === 1) return t('rooms.availableOne')
  return t('rooms.availableMany', { count })
}

function perNight(rt: RoomTypeRate): string {
  const n = store.nights > 0 ? store.nights : 1
  return formatPrice(rt.fromPrice / n, store.displayCurrency)
}

// Prettify del roomType string: 'double' → 'Double', 'standard' → 'Standard'. El backend
// usa ambos id/name = room.type (string libre). El widget puede mostrar el valor crudo.
function prettify(name: string): string {
  if (!name) return 'Habitación'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

async function select(rt: RoomTypeRate) {
  await store.selectRoom(rt)
  store.next()
}
</script>
