// bookingengine/usecases/unified-flow.ts — Feature flag F0 0.12
// spec: openspec/changes/solmi-direct-booking/specs/booking-unification/spec.md
//
// Rollback plan: cuando `false`, los endpoints plurales `/api/public/bookings` responden
// exactamente como hoy (flujo viejo sobre `public_bookings`). Cuando `true`, esos endpoints
// devuelven 410 Gone forzando al cliente al flujo unificado `/api/public/booking` (singular).
//
// Defaults (NO hardcodeados — derivan de NODE_ENV):
// - `NODE_ENV='production'` → `false` (prod queda en flujo viejo hasta activarlo explícito).
// - resto (dev, test, sin NODE_ENV) → `true` (dev adoputa el flujo unificado por defecto).
//
// Override explícito: `BOOKING_USE_UNIFIED_FLOW='true' | 'false'`. Cualquier otro valor
// (vacío, typo) cuenta como `false` — fail-closed al flujo viejo, menos riesgo.

export function useUnifiedBookingFlow(): boolean {
  const explicit = process.env.BOOKING_USE_UNIFIED_FLOW
  if (explicit !== undefined) return explicit === 'true'
  return process.env.NODE_ENV !== 'production'
}
