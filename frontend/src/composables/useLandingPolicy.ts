// composables/useLandingPolicy.ts — Canal por el que el orquestador de la landing pública
// (`pages/public/hotel-landing.vue`) le pasa a los bloques la política de cancelación REAL del
// hotel, tal como la devuelve `GET /api/public/hotels/:slug/rates` (`cancellationSummary`).
//
// POR QUÉ INJECT Y NO PROP: los bloques se montan con `<component :is>` desde una lista dinámica
// y una prop nueva se le pasaría a los 12 types (los que no la declaran la reciben como atributo
// suelto en su elemento raíz). Mismo patrón que `provide('landingTheme')` y
// `useLandingBooking()`, ya establecidos en esta página.
//
// POR QUÉ IMPORTA QUE SEA ESTA FUENTE: `cancellationSummary` es lo que deriva
// `shared/usecases/cancellation-math.ts:resolvePolicy` — exactamente la misma política con la
// que el backend calcula la penalidad y el reembolso al cancelar. El texto libre
// `booking_config.cancellationPolicy` NO se usa acá: es un campo sin estructura que en producción
// contradice a la política vigente (guarda 'flexible' en un hotel con `cancellationType='strict'`).
//
// DEGRADACIÓN: sin provider (o con `/rates` caído) el ref vale `null` y el bloque que lo consume
// OMITE la sección de cancelación. Nunca cae a un texto por defecto: "no sé cuál es la política"
// jamás puede leerse como "se cancela gratis".
import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import type { CancellationSummary } from '@/types/booking'

export const LANDING_CANCELLATION_KEY: InjectionKey<Ref<CancellationSummary | null>> =
  Symbol('landing-cancellation')

/** Ref vacío compartido para los montajes sin provider (nunca se escribe). */
const NO_POLICY: Ref<CancellationSummary | null> = ref(null)

/** Lo llama SOLO el orquestador de la landing (`pages/public/hotel-landing.vue`). */
export function provideLandingCancellation(summary: Ref<CancellationSummary | null>): void {
  provide(LANDING_CANCELLATION_KEY, summary)
}

/** `null` mientras no haya política resuelta (sin provider, `/rates` caído, o hotel sin política). */
export function useLandingCancellation(): Ref<CancellationSummary | null> {
  return inject(LANDING_CANCELLATION_KEY, NO_POLICY)
}
