<template>
  <!--
    ConfirmStep.vue — Step 5 del widget (F2 2.9, solmi-direct-booking).
    Estado post-redirect desde Stripe. Lee `reservationId` + `accessToken` de query params
    (`?booking=:id&token=:token`) o, si los placeholders no llegaron reemplazados, del
    sessionStorage (backup que dejó `store.pay()` antes del redirect).

    Hace polling de `GET /api/public/reservations/:id?token=` hasta 10 intentos (3s c/u)
    esperando `paymentStatus: 'paid'`. Estados:
      - paid/confirmed → confirmación con datos
      - pending → "aún procesando, no cierres"
      - failed/cancelled → error + CTA reintentar

    NOTA: la página de confirmación DEFINITIVA (con wallet pass, código TTLock, email
    recovery) es F3 3.17. Este step es el mínimo viable del widget — muestra el estado
    del pago tras volver de Stripe y desambigua los 3 outcomes.
  -->
  <section class="space-y-4 text-center">
    <div v-if="pollingState === 'loading'" class="py-8">
      <div class="h-12 w-12 mx-auto rounded-full border-4 border-cyan/30 border-t-cyan animate-spin" />
      <h2 class="text-lg font-black text-navy mt-4">Confirmando tu reserva…</h2>
      <p class="text-sm text-text-muted mt-1">No cierres esta ventana.</p>
    </div>

    <div v-else-if="pollingState === 'success'" class="py-6">
      <div class="text-5xl mb-3">✅</div>
      <h2 class="text-xl font-black text-navy">¡Reserva confirmada!</h2>
      <p class="text-sm text-text-muted mt-2">
        Te enviamos los detalles a <span class="font-bold text-navy">{{ reservation?.guest?.email || store.guest.email }}</span>.
      </p>

      <div v-if="reservation" class="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm space-y-1">
        <div class="flex justify-between">
          <span class="text-text-muted">Check-in</span>
          <span class="font-bold text-navy">{{ reservation.reservation.checkIn }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-text-muted">Check-out</span>
          <span class="font-bold text-navy">{{ reservation.reservation.checkOut }}</span>
        </div>
        <div v-if="reservation.guest?.name" class="flex justify-between">
          <span class="text-text-muted">Huésped</span>
          <span class="font-bold text-navy">{{ reservation.guest.name }}</span>
        </div>
        <div v-if="reservation.reservation.totalAmount" class="flex justify-between border-t border-slate-200 pt-1 mt-1">
          <span class="text-text-muted">Total</span>
          <span class="font-bold text-navy">{{ reservation.reservation.totalAmount }}</span>
        </div>
      </div>

      <p class="text-[11px] text-text-muted mt-4">
        Guardá tu número de reserva: <span class="font-mono font-bold">{{ reservation?.reservation.id?.slice(0, 8) }}</span>
      </p>
    </div>

    <div v-else-if="pollingState === 'pending'" class="py-6">
      <div class="text-5xl mb-3">⏳</div>
      <h2 class="text-xl font-black text-navy">Pago en proceso</h2>
      <p class="text-sm text-text-muted mt-2">
        Tu pago está siendo confirmado. Te avisaremos por email en unos minutos.
      </p>
      <button
        type="button"
        class="mt-5 rounded-xl border-2 border-cyan px-6 py-3 text-sm font-bold text-cyan hover:bg-cyan hover:text-white"
        @click="startPolling"
      >
        Revisar de nuevo
      </button>
    </div>

    <div v-else class="py-6">
      <div class="text-5xl mb-3">⚠️</div>
      <h2 class="text-xl font-black text-navy">No pudimos confirmar</h2>
      <p class="text-sm text-text-muted mt-2">{{ errorMessage }}</p>
      <a
        :href="`/book/${store.slug}`"
        class="inline-block mt-5 rounded-xl bg-cyan px-6 py-3 text-sm font-bold text-white hover:bg-cyan-light"
      >
        Volver a intentar
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useBookingStore, readStoredReservation, clearStoredReservation } from '@/composables/useBooking'
import type { PublicReservationResponse } from '@/types/booking'

const store = useBookingStore()
const route = useRoute()

type PollingState = 'loading' | 'success' | 'pending' | 'error'
const pollingState = ref<PollingState>('loading')
const reservation = ref<PublicReservationResponse | null>(null)
const errorMessage = ref('No encontramos tu reserva o el pago fue cancelado.')

const MAX_ATTEMPTS = 10
const POLL_INTERVAL_MS = 3000
let timer: ReturnType<typeof setTimeout> | null = null
let attempts = 0

/** Resuelve (reservationId, accessToken) desde query params o sessionStorage.
 *  Query params llegan si el backend reemplazó `:id`/`:token` en successUrl. Si no, caemos
 *  al backup que dejó store.pay() en sessionStorage antes del redirect. */
function resolveIds(): { id: string; token: string } | null {
  const qId = typeof route.query.booking === 'string' ? route.query.booking : ''
  const qToken = typeof route.query.token === 'string' ? route.query.token : ''
  if (qId && qToken && qId !== ':id' && qToken !== ':token') {
    return { id: qId, token: qToken }
  }
  // Placeholders sin reemplazar o sin params → backup de sessionStorage.
  const stored = readStoredReservation(store.slug)
  if (stored) return { id: stored.reservationId, token: stored.accessToken }
  return null
}

async function tick() {
  const ids = resolveIds()
  if (!ids) {
    pollingState.value = 'error'
    errorMessage.value = 'No encontramos tu reserva. Revisá el link del email de confirmación.'
    return
  }
  const res = await store.pollConfirmation(ids.id, ids.token)
  if (!res) {
    pollingState.value = 'error'
    errorMessage.value = 'El enlace no es válido o expiró.'
    return
  }
  reservation.value = res
  const ps = String(res.paymentStatus || '').toLowerCase()
  const rs = String(res.reservation.status || '').toLowerCase()
  if (ps === 'paid' || rs === 'confirmed' || rs === 'checked_in' || rs === 'checked_out') {
    pollingState.value = 'success'
    clearStoredReservation(store.slug) // limpieza: ya confirmada
    return
  }
  if (ps === 'failed' || rs === 'cancelled' || rs === 'no_show') {
    pollingState.value = 'error'
    errorMessage.value = 'El pago fue rechazado o cancelado. Probá de nuevo.'
    clearStoredReservation(store.slug)
    return
  }
  // pending / partial / unpaid → seguir pollando si quedan intentos.
  pollingState.value = 'pending'
  attempts++
  if (attempts >= MAX_ATTEMPTS) return // dejamos "pending" visible con botón reintentar
  timer = setTimeout(tick, POLL_INTERVAL_MS)
}

function startPolling() {
  if (timer) clearTimeout(timer)
  attempts = 0
  pollingState.value = 'loading'
  void tick()
}

onMounted(startPolling)
onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>
