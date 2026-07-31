<template>
  <!--
    PayStep.vue — Step 4 del widget (F2 2.9 + D1, solmi-direct-booking).
    Resumen final + input de promo code + botón "Reservar y Pagar" que dispara store.pay()
    (crea la reserva pending + redirect a Stripe Checkout).

    IDEMPOTENCIA (anti-doble-submit, acceptance 2.8):
      - El botón está `:disabled` mientras `store.isSubmitting === true`.
      - `store.pay()` tiene un guard extra (`if (isSubmitting) return`) por si el botón se
        habilita entre el click y el handler (race de eventos).
      - El idempotencyKey client-side viaja en el body; el backend dedupea por reservation.id.
    Tras el click exitoso, el redirect a Stripe descarga la página — el botón queda en "Procesando…".

    PROMO (spec booking-widget R-promo): input + botón "Aplicar" que llama store.applyPromo
    (valida contra promo_codes, NO incrementa uses — eso lo hace el backend al crear). Muestra
    descuento aplicado o razón de rechazo. No stackeable (un promo por reserva).

    DESGLOSE: pre-create mostramos la estimación (subtotal - promo + taxes). Post-create el
    backend devuelve `totalBreakdown` (definitivo); lo mostramos si está disponible. El botón
    siempre confía en `store.estimatedTotal` antes del click, y en `totalBreakdown.total` después.
    Todos los textos via i18n (es/en/pt, task 2.14).
  -->
  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-xl font-black text-navy">{{ t('pay.title') }}</h2>
      <p class="text-sm text-text-muted">{{ t('pay.subtitle') }}</p>
    </header>

    <!-- Resumen de la reserva (editable: click → goToStep) -->
    <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 text-sm">
      <button type="button" class="w-full flex items-center justify-between text-left" @click="store.goToStep(0)">
        <span class="text-text-muted">{{ t('pay.dates') }}</span>
        <span class="font-bold text-navy underline decoration-dotted">
          {{ store.checkIn }} → {{ store.checkOut }} ({{ t('search.nights', { count: store.nights }) }})
        </span>
      </button>
      <button type="button" class="w-full flex items-center justify-between text-left" @click="store.goToStep(1)">
        <span class="text-text-muted">{{ t('pay.room') }}</span>
        <span class="font-bold text-navy underline decoration-dotted capitalize">
          {{ prettify(store.selectedRoom?.name || '') }}
        </span>
      </button>
      <div v-if="store.selectedUpsells.length > 0" class="flex items-center justify-between">
        <span class="text-text-muted">{{ t('pay.extras') }}</span>
        <button type="button" class="font-bold text-navy underline decoration-dotted" @click="store.goToStep(2)">
          {{ extrasLabel }}
        </button>
      </div>
      <button type="button" class="w-full flex items-center justify-between text-left" @click="store.goToStep(3)">
        <span class="text-text-muted">{{ t('pay.guest') }}</span>
        <span class="font-bold text-navy underline decoration-dotted truncate max-w-[60%]">
          {{ store.guest.name || '—' }}
        </span>
      </button>
    </div>

    <!-- Promo code input -->
    <div class="space-y-2">
      <label class="block">
        <span class="block text-xs font-bold text-text-muted uppercase tracking-wide mb-1">{{ t('pay.promoPrompt') }}</span>
        <div class="flex gap-2">
          <input
            v-model="store.promoCode"
            type="text"
            autocomplete="off"
            :placeholder="t('pay.promoPlaceholder')"
            class="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base uppercase text-navy focus:border-cyan focus:ring-2 focus:ring-cyan/30 focus:outline-none"
            :disabled="store.promoLoading"
            @keyup.enter="onApplyPromo"
          />
          <button
            type="button"
            :disabled="!store.promoCode.trim() || store.promoLoading"
            class="shrink-0 rounded-xl bg-navy px-4 py-3 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50"
            @click="onApplyPromo"
          >
            {{ t('pay.promoApply') }}
          </button>
        </div>
      </label>

      <p v-if="store.promoResult?.valid" class="text-sm font-bold text-green-700">
        {{ t('pay.promoApplied', { amount: formatPrice(store.promoDiscount, displayOrCharge) }) }}
      </p>
      <p v-else-if="store.promoResult && !store.promoResult.valid" class="text-sm font-semibold text-red-600">
        {{ promoReasonLabel(store.promoResult.reason) }}
      </p>
    </div>

    <!-- Desglose de totales -->
    <div class="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-text-muted">{{ t('pay.roomLine', { count: store.nights }) }}</span>
        <span class="font-semibold text-navy">{{ formatPrice(store.selectedRoom?.fromPrice ?? 0, displayOrCharge) }}</span>
      </div>
      <div v-if="store.upsellsTotal > 0" class="flex justify-between">
        <span class="text-text-muted">{{ t('pay.extras') }}</span>
        <span class="font-semibold text-navy">{{ formatPrice(store.upsellsTotal, displayOrCharge) }}</span>
      </div>
      <div v-if="store.promoDiscount > 0" class="flex justify-between text-green-700">
        <span>{{ t('pay.discount') }}</span>
        <span class="font-semibold">−{{ formatPrice(store.promoDiscount, displayOrCharge) }}</span>
      </div>
      <div v-if="store.estimatedTaxes > 0" class="flex justify-between">
        <span class="text-text-muted">{{ t('pay.taxes') }}</span>
        <span class="font-semibold text-navy">{{ formatPrice(store.estimatedTaxes, displayOrCharge) }}</span>
      </div>
      <div class="border-t border-slate-200 pt-2 flex justify-between items-baseline">
        <span class="font-black text-navy">{{ t('pay.total') }}</span>
        <span class="text-xl font-black text-navy">{{ formatPrice(currentTotal, displayOrCharge) }}</span>
      </div>
    </div>

    <!-- FIX 2026-07-31 — el admin la escribe en /panel/booking-engine; antes se guardaba y
         nunca llegaba hasta acá. Texto libre del merchant, sin traducir (no i18n). -->
    <p v-if="store.cancellationPolicy" class="text-xs text-text-muted leading-relaxed">
      <span class="font-bold text-navy">{{ t('pay.cancellationPolicy') }}:</span>
      {{ store.cancellationPolicy }}
    </p>

    <p v-if="store.error" class="text-sm font-semibold text-red-600">{{ store.error }}</p>

    <button
      type="button"
      :disabled="store.isSubmitting"
      class="w-full rounded-xl bg-cyan px-6 py-4 text-base font-black text-white shadow-card transition hover:bg-cyan-light disabled:cursor-not-allowed disabled:opacity-60"
      @click="store.pay()"
    >
      <span v-if="store.isSubmitting" class="inline-flex items-center justify-center gap-2">
        <span class="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        {{ t('pay.processing') }}
      </span>
      <span v-else>{{ t('pay.cta', { amount: formatPrice(currentTotal, displayOrCharge) }) }}</span>
    </button>

    <p v-if="hasDifferentChargeCurrency" class="text-[11px] text-center text-text-muted">
      {{ t('pay.chargeNote', { charge: store.chargeCurrency, display: store.displayCurrency }) }}
    </p>
    <p v-else class="text-[11px] text-center text-text-muted">
      {{ t('pay.secureNote') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBookingStore } from '@/composables/useBooking'
import { useBookingI18nStore } from '@/composables/useBookingI18n'
import type { PromoValidationReason } from '@/types/booking'

const store = useBookingStore()
const { t, formatPrice } = useBookingI18nStore()

// Si el backend ya devolvió `totalBreakdown` (post-create), confiamos en ese total. Pre-create
// usamos la estimación (que coincide porque aplica la misma promo y taxRate).
const currentTotal = computed(() => store.totalBreakdown?.total ?? store.estimatedTotal)

const displayOrCharge = computed(() => store.displayCurrency || store.chargeCurrency)

const hasDifferentChargeCurrency = computed(
  () => !!store.displayCurrency && !!store.chargeCurrency && store.displayCurrency !== store.chargeCurrency,
)

const extrasLabel = computed(() => {
  const c = store.selectedUpsells.length
  return c === 1 ? t('pay.extrasCountOne') : t('pay.extrasCountMany', { count: c })
})

async function onApplyPromo() {
  if (!store.promoCode.trim()) return
  await store.applyPromo()
}

function promoReasonLabel(reason?: PromoValidationReason): string {
  switch (reason) {
    case 'not_found': return t('pay.promoReasonNotFound')
    case 'expired': return t('pay.promoReasonExpired')
    case 'max_uses_reached': return t('pay.promoReasonMaxUses')
    case 'min_amount_not_met': return t('pay.promoReasonMinAmount')
    case 'inactive': return t('pay.promoReasonInactive')
    default: return t('pay.promoReasonDefault')
  }
}

function prettify(name: string): string {
  if (!name) return '—'
  return name.charAt(0).toUpperCase() + name.slice(1)
}
</script>
