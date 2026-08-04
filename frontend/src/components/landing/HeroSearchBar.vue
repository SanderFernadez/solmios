<template>
  <!--
    HeroSearchBar — buscador del hero de la landing pública (`/h/:slug`). ES para el huésped, no
    reusa el wizard del panel. Usado por las 3 variantes de HeroBlock.vue (classic/modern/
    boutique) con distinto wrapper.

    REDISEÑO (motor de reservas de verdad):
    - Fechas: antes eran dos `<input type="date">` sueltos — el huésped tenía que saber de
      memoria qué días hay lugar y cuánto sale cada noche. Ahora es UN campo que abre
      `RateCalendar`: vista de rango conectada, precio por noche en cada celda y días sin
      disponibilidad marcados (Baymard/NN-g: el buscador es el contenido primario del hero).
    - Huéspedes: antes eran steppers de 16px (h-4 w-4) para Adultos y Habitaciones, y los niños
      no se podían elegir en ninguna pantalla (`children` existía en el tipo, sin UI que lo
      alimentara). Ahora es `OccupancySelector`: resumen explícito ("2 adultos, 1 niño") con
      steppers de 36px adentro.

    LAYOUT (fix v3 que se conserva): breakpoints de VIEWPORT (`sm:`/`lg:`) no saben que este
    componente vive dentro de un contenedor `max-w-3xl/4xl` — a un viewport ancho el breakpoint
    fuerza una fila que el ANCHO RENDERIZADO real no puede sostener, y los campos se salían del
    fondo blanco. Por eso TODOS los campos + el botón son hijos DIRECTOS de un único
    `flex flex-wrap` sin breakpoints, cada uno con su `min-width`: el browser decide cuántos
    entran según el espacio real y lo que no entra cae a la línea siguiente, siempre adentro del
    fondo blanco.
    ⚠️ Ya NO lleva `overflow-hidden`: recortaba los paneles flotantes. No hace falta — el wrap lo
    resuelve el flex, y los paneles van teletransportados a <body> (useAnchoredPanel), fuera
    también del `overflow-hidden` del <section> del hero.

    DESTINO DEL SUBMIT (2 caminos, a propósito):
    1. Dentro de la landing (`/h/:slug`) hay un `provideLandingBooking` → se abre `BookingModal`
       ENCIMA de la landing con las fechas y la ocupación ya cargadas y saltando directo al paso
       de habitaciones. El huésped nunca abandona la página del hotel.
    2. Fuera de la landing (sin provider) → se conserva la navegación a `/book/:slug` con el
       contrato de URL `?checkIn&checkOut&guests&rooms&children` que lee `booking-widget.vue`.
       El widget embebible es otro producto y no se toca.
  -->
  <form
    @submit.prevent="onSubmit"
    class="flex flex-wrap items-stretch gap-1 rounded-2xl bg-white p-2 shadow-2xl"
  >
    <RateCalendar
      v-model:check-in="checkIn"
      v-model:check-out="checkOut"
      :hotel-slug="hotelSlug"
      :guests="totalOccupancy"
      @validity="onCalendarValidity"
    />

    <OccupancySelector v-model="occupancy" />

    <button
      type="submit"
      class="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-navy px-7 py-3 text-xs font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-navy-light"
    >
      {{ ctaText }}
      <span aria-hidden="true">→</span>
    </button>

    <p v-if="error" class="basis-full px-2 text-xs font-bold text-danger" role="alert">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import RateCalendar from './RateCalendar.vue'
import OccupancySelector from './OccupancySelector.vue'
import { useLandingBooking } from '@/composables/useLandingBooking'
import { nightsBetween, totalGuests } from '@/utils/rate-calendar'
import type { Occupancy } from '@/types/booking'

const props = defineProps<{
  hotelSlug: string
  ctaText: string
}>()

const router = useRouter()
/** `null` fuera de la landing → se navega al widget como siempre. */
const openBooking = useLandingBooking()

const checkIn = ref('')
const checkOut = ref('')
const occupancy = ref<Occupancy>({ adults: 2, children: 0, rooms: 1 })
const error = ref('')

/** Ocupación FÍSICA por habitación para el calendario: el backend filtra `rooms.capacity >=
 *  guests`, y un niño también ocupa una plaza. No es lo mismo que el `guests` de la URL (ver
 *  `onSubmit`). */
const totalOccupancy = computed(() => totalGuests(occupancy.value))

/** Restricciones que solo conoce el calendario (estadía mínima del día de entrada). Se guardan
 *  acá para frenar el submit con el mismo mensaje que ya se ve dentro del panel. */
const calendarError = ref('')

function onCalendarValidity(payload: { ok: boolean; message: string }): void {
  calendarError.value = payload.ok ? '' : payload.message
  if (payload.ok && error.value === calendarError.value) error.value = ''
}

function onSubmit(): void {
  error.value = ''
  if (!checkIn.value || !checkOut.value) {
    error.value = 'Elegí las fechas de llegada y salida.'
    return
  }
  if (nightsBetween(checkIn.value, checkOut.value) < 1) {
    error.value = 'La salida debe ser posterior a la llegada.'
    return
  }
  if (calendarError.value) {
    error.value = calendarError.value
    return
  }

  // Camino 1 — la landing: el modal abre con TODO el contexto y arranca en habitaciones
  // (`skipToRooms`). `adults` y `children` viajan separados: el motor manda `adults` como tal y
  // consulta las tarifas con la ocupación física (adultos + niños), el mismo criterio con el que
  // este buscador ya alimenta el calendario. Sin esa separación el precio del hero y el del paso
  // de habitaciones podían no coincidir cuando había niños.
  if (openBooking) {
    openBooking({
      checkIn: checkIn.value,
      checkOut: checkOut.value,
      adults: Math.max(1, occupancy.value.adults),
      children: Math.max(0, occupancy.value.children),
      rooms: Math.max(1, occupancy.value.rooms),
      skipToRooms: true,
    })
    return
  }

  // Camino 2 — fuera de la landing: contrato de URL intacto. `guests` sigue siendo la cantidad de
  // ADULTOS; el widget lo mapea a `adults` de la reserva — meter ahí adultos+niños haría que los
  // niños se graben como adultos. `children` viaja aparte y solo si es > 0.
  const qs = new URLSearchParams({
    checkIn: checkIn.value,
    checkOut: checkOut.value,
    guests: String(Math.max(1, occupancy.value.adults)),
    rooms: String(Math.max(1, occupancy.value.rooms)),
  })
  if (occupancy.value.children > 0) qs.set('children', String(occupancy.value.children))

  router.push(`/book/${encodeURIComponent(props.hotelSlug)}?${qs.toString()}`)
}
</script>
