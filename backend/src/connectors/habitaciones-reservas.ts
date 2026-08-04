// connectors/habitaciones-reservas.ts — Wire: habitaciones → reservas
//
// Permite que `GET /api/habitaciones?checkIn&checkOut` anote disponibilidad real por rango de
// fechas en cada habitación (`available`/`unavailableReason`), usando el MISMO criterio de
// solapamiento que `reservas/usecases/availability.ts` (vía `shared/usecases/room-overlap.ts`).
//
// Sin esto, el selector de habitación del wizard de reservas del staff
// (`ReservationWizardModal.vue`) ofrecía cuartos ocupados como disponibles y el backend recién
// los rechazaba al guardar con un 409 (#645/#648). `habitaciones` NUNCA importa `reservas`
// directo (regla del framework) — este connector solo wirea el puerto de lectura vía
// `setAvailabilityDeps()`, mismo patrón que `habitaciones-auditlog.ts` con `setAuditDeps()`.
import type { ConnectorContext } from 'arckode-framework'
import type { ReservationsListPort } from '../shared/usecases/habitaciones-availability'

interface HabitacionesModulePort {
  setAvailabilityDeps: (port: ReservationsListPort) => void
}

export function habitacionesReservasConnector(ctx: ConnectorContext): void {
  const habitaciones = ctx.resolveModule<HabitacionesModulePort>('habitaciones')
  const reservas = ctx.resolveModule<ReservationsListPort>('reservas')

  habitaciones.setAvailabilityDeps({
    list: (query, user) => reservas.list(query, user),
  })
}
