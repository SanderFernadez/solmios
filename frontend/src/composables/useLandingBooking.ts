// composables/useLandingBooking.ts — Canal por el que los bloques de la landing pública abren
// el modal de reserva (`components/landing/BookingModal.vue`) SIN sacar al huésped de `/h/:slug`.
//
// POR QUÉ INJECT Y NO EMITS: los bloques los renderiza `hotel-landing.vue` con
// `<component :is="blockComponent(...)">` desde una lista dinámica. Propagar un emit desde
// `HeroSearchBar` implicaría re-emitirlo en `HeroBlock` (y en cada bloque futuro con CTA),
// atando bloques intermedios a un evento que no les incumbe. La landing YA usa este patrón para
// el tema (`provide('landingTheme')`).
//
// DEGRADACIÓN DELIBERADA: `useLandingBooking()` devuelve `null` cuando NO hay provider. Los
// componentes que lo usan caen a la navegación de siempre hacia `/book/:slug` (el widget
// embebible, que sigue siendo un producto aparte). Así el buscador del hero sirve igual si se
// monta fuera de la landing, y el contrato de URL `?checkIn&checkOut&guests&rooms` no se rompe.

import { inject, provide, type InjectionKey } from 'vue'
import type { OpenBookingOptions } from '@/types/booking'

/** Abre el modal de reserva de la landing con el contexto ya cargado. */
export type OpenBooking = (options?: OpenBookingOptions) => void

export const LANDING_BOOKING_KEY: InjectionKey<OpenBooking> = Symbol('landing-booking')

/** Lo llama SOLO el orquestador de la landing (`pages/public/hotel-landing.vue`). */
export function provideLandingBooking(open: OpenBooking): void {
  provide(LANDING_BOOKING_KEY, open)
}

/** `null` si el componente no vive dentro de la landing → el caller navega como antes. */
export function useLandingBooking(): OpenBooking | null {
  return inject(LANDING_BOOKING_KEY, null)
}
