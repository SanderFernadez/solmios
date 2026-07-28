<template>
  <!--
    booking-widget.vue — Wrapper SPA del motor de reserva (F2 2.10, solmi-direct-booking).

    Orquesta los 6 steps (SearchStep → RoomsStep → UpsellsStep → GuestCheckoutStep → PayStep →
    ConfirmStep) usando el Pinia store `useBookingStore` (state machine). Layout mobile-first,
    embebible en iframe o como ruta `/book/:slug` (la Pieza 3 registra la ruta — este componente
    se crea sin tocar el router).

    Performance (D9): los steps se cargan lazy (defineAsyncComponent) salvo SearchStep, que es
    el único en el bundle inicial. Cada step se trae su chunk solo al mostrarse → sub-2s mobile
    4G (acceptance 2.10). Sin librerías pesadas (calendar Airbnb es task 2.17, mapa no aplica).

    Header con nombre del hotel (resuelto por slug al montar) + stepper indicator (1-6 puntos).
    CTA del primer step es "Ver disponibilidad" (NO "Reservar") — reduce fricción (spec).

    Rutas hacia acá (NO registradas en esta pieza):
      - `/book/:slug` (Pieza 3 reemplaza el widget viejo por este)
      - `/h/:slug?booking=:id&token=:token` (post-redirect Stripe, F3 3.17 confirma)
  -->
  <div class="min-h-screen bg-surface">
    <!-- Header mobile-first: nombre del hotel + stepper.
         F2 2.13: cuando ?embed=1 (iframe en sitio externo), no se renderiza. El sitio host
         ya aporta branding propio; mostrar el header acá sería redundante y robaría espacio
         vertical dentro del iframe. El stepper pasa al main para no perder el contexto. -->
    <header v-if="!embed" class="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div class="max-w-md mx-auto px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p v-if="hotelLoading" class="text-sm text-text-muted">Cargando…</p>
            <h1 v-else-if="hotelName" class="font-black text-navy truncate">{{ hotelName }}</h1>
            <h1 v-else class="font-black text-navy">Reservá tu estadía</h1>
          </div>
        </div>

        <!-- Stepper indicator: 6 puntos, el actual resaltado. Solo se muestra tras el step 0. -->
        <div v-if="store.currentStep > 0 || store.status === 'searching'" class="flex items-center gap-1.5 mt-3">
          <button
            v-for="(label, idx) in stepLabels"
            :key="label"
            type="button"
            class="flex items-center gap-1.5"
            :disabled="idx > store.currentStep"
            @click="store.goToStep(idx)"
          >
            <span
              :class="[
                'h-2 rounded-full transition-all',
                idx === store.currentStep ? 'w-6 bg-cyan'
                : idx < store.currentStep ? 'w-2 bg-cyan'
                : 'w-2 bg-slate-300',
              ]"
            />
          </button>
          <span class="ml-auto text-[11px] font-bold text-text-muted uppercase tracking-wide">
            Paso {{ store.currentStep + 1 }} / 6
          </span>
        </div>
      </div>
    </header>

    <!-- Cuerpo: el step actual.
         F2 2.13: en embed mode el main ocupa todo el iframe (sin max-w-md centrado) y monta
         el stepper compacto arriba — el sitio host aporta branding, pero el usuario del widget
         embebido sigue necesitando saber en qué paso está. -->
    <main :class="embed ? 'max-w-full px-3 py-4' : 'max-w-md mx-auto px-4 py-6'">
      <div
        v-if="embed && (store.currentStep > 0 || store.status === 'searching')"
        class="flex items-center gap-1.5 mb-3"
      >
        <button
          v-for="(label, idx) in stepLabels"
          :key="label"
          type="button"
          class="flex items-center gap-1.5"
          :disabled="idx > store.currentStep"
          @click="store.goToStep(idx)"
        >
          <span
            :class="[
              'h-2 rounded-full transition-all',
              idx === store.currentStep ? 'w-6 bg-cyan'
              : idx < store.currentStep ? 'w-2 bg-cyan'
              : 'w-2 bg-slate-300',
            ]"
          />
        </button>
        <span class="ml-auto text-[11px] font-bold text-text-muted uppercase tracking-wide">
          Paso {{ store.currentStep + 1 }} / 6
        </span>
      </div>

      <component :is="currentComponent" />

      <!-- Nav back (común a todos los steps salvo Search y Confirm). -->
      <div v-if="showBack" class="mt-6">
        <button
          type="button"
          class="text-sm font-bold text-text-muted hover:text-navy inline-flex items-center gap-1"
          :disabled="store.isSubmitting"
          @click="store.back()"
        >
          ← Volver
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBookingStore } from '@/composables/useBooking'
import { PublicHotelService } from '@/services/PublicHotel.service'
import SearchStep from '@/components/booking/SearchStep.vue'

// Lazy-load de los steps > 0 para mantener el bundle inicial mínimo (D9 performance).
// Cada step se trae su chunk solo al llegar — SearchStep va en el bundle base.
const RoomsStep = defineAsyncComponent(() => import('@/components/booking/RoomsStep.vue'))
const UpsellsStep = defineAsyncComponent(() => import('@/components/booking/UpsellsStep.vue'))
const GuestCheckoutStep = defineAsyncComponent(() => import('@/components/booking/GuestCheckoutStep.vue'))
const PayStep = defineAsyncComponent(() => import('@/components/booking/PayStep.vue'))
const ConfirmStep = defineAsyncComponent(() => import('@/components/booking/ConfirmStep.vue'))

const route = useRoute()
const store = useBookingStore()

const hotelName = ref('')
const hotelLoading = ref(true)

// F2 2.13 — `?embed=1` indica que el widget se renderiza dentro de un <iframe> embebido en
// un sitio externo (cargado por /widget/loader.js). En ese modo se oculta el header ( branding
// redundante con el host) y el main ocupa todo el iframe. El stepper se mantiene arriba del
// contenido para no perder el contexto del paso actual.
const embed = computed(() => route.query.embed === '1')

// Labels del stepper (para el tooltip / aria-label; visible solo como puntos).
const stepLabels = ['Fechas', 'Habitación', 'Extras', 'Datos', 'Pago', 'Confirmación']

// Step component según status. El mapeo está en STEP_INDEX del store; acá elegimos la vista.
const currentComponent = computed(() => {
  switch (store.status) {
    case 'idle':
    case 'searching':
      return SearchStep
    case 'selecting':
      return RoomsStep
    case 'upselling':
      return UpsellsStep
    case 'checkingout':
      return GuestCheckoutStep
    case 'paying':
    case 'failed':
      // 'failed' se queda en PayStep mostrando el error (para que el usuario reintente desde
      // el mismo lugar, no pierde el contexto del pago).
      return PayStep
    case 'confirmed':
      return ConfirmStep
  }
})

// Botón "Volver" visible salvo en Search (no hay previo) y en Confirm/failed-post-create
// (no se puede "volver" de un pago ya enviado al gateway).
const showBack = computed(() => {
  if (store.isSubmitting) return false
  return store.status === 'selecting'
    || store.status === 'upselling'
    || store.status === 'checkingout'
    || store.status === 'paying'
})

// slug desde la ruta. La ruta `/book/:slug` (Pieza 3) o embed via query. Fallback a query.slug
// para poder usarse en una ruta temporal `/h/:slug` con query ?widget=1 sin registrar path nuevo.
const slug = computed(() => {
  const param = typeof route.params.slug === 'string' ? route.params.slug : ''
  if (param) return param
  const q = route.query.slug
  return typeof q === 'string' ? q : ''
})

function readInitParams() {
  return {
    checkIn: typeof route.query.checkIn === 'string' ? route.query.checkIn : undefined,
    checkOut: typeof route.query.checkOut === 'string' ? route.query.checkOut : undefined,
    guests: typeof route.query.guests === 'string' ? Number(route.query.guests) : undefined,
    rooms: typeof route.query.rooms === 'string' ? Number(route.query.rooms) : undefined,
  }
}

// (Re)init cuando cambia el slug (deep-link nuevo). Limpia el estado previo.
watch(slug, (s) => {
  if (!s) return
  store.reset()
  store.init(s, readInitParams())
}, { immediate: false })

onMounted(async () => {
  const s = slug.value
  if (!s) {
    hotelLoading.value = false
    return
  }
  store.init(s, readInitParams())
  try {
    const hotel = await PublicHotelService.getBySlug(s)
    hotelName.value = hotel.name
  } catch {
    // Si el hotel no carga, no bloqueamos el widget — el usuario igual puede buscar. El
    // header queda con el fallback "Reservá tu estadía".
    hotelName.value = ''
  } finally {
    hotelLoading.value = false
  }
})
</script>
