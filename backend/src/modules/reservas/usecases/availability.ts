// reservas/usecases/availability.ts
// Verifica que una habitación esté libre en un rango de fechas (sin solapamiento con reservas activas).
// Extraído del service (estaba duplicado en create y update) para mantenerlo <200 líneas.

import type { RepositoryAdapter } from 'arckode-framework'
import { ConflictError } from 'arckode-framework'
import type { ReservasDTO } from '../types'

/**
 * Lanza ConflictError (HTTP 409) si existe solapamiento con otra reserva activa (excluye cancelled/no_show).
 * Es un conflicto de recurso (la habitación ya está ocupada), no un error de autenticación.
 * @param excludeId id de la propia reserva al actualizar (para no chocar consigo misma); undefined en create.
 *
 * INVESTIGACIÓN #645 (2026-08-04): esta función se auditó a fondo (filtrado cancelled/no_show,
 * inclusividad de fechas en el borde checkout=checkin, exclusión de la propia reserva) y NO tiene
 * bug — verificado con curl contra un backend local: habitación libre → 201; solapamiento real →
 * 409 correcto; back-to-back mismo día → 201 correcto; reserva cancelada no bloquea → 201 correcto.
 * El 409 reportado en #645 es una reserva LEGÍTIMA: `rooms.status` ('available'/'occupied'/...)
 * es el estado operativo/housekeeping del cuarto, NO disponibilidad por rango de fechas — un
 * cuarto "available" hoy puede tener una reserva futura en esas fechas igual. El wizard
 * (`ReservationWizardModal.vue`) arma el selector desde `GET /api/habitaciones` (todas, sin
 * filtrar por fecha — no existe endpoint de disponibilidad para el panel de staff) y ese es el
 * bug real: **#648**, ya trackeado por separado, fuera del alcance del módulo `reservas`. Se
 * agrega el detalle del conflicto abajo para que el 409, cuando SÍ corresponde, sea autoexplicativo.
 * SOLO ES SEGURO exponer este detalle porque #668 (IDOR cross-tenant en update) ya está fixeado —
 * antes de ese fix, este mensaje filtraba fechas/id de reservas de OTRO hotel.
 */
export async function assertRoomAvailable(
  repo: RepositoryAdapter<ReservasDTO>,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeId?: string,
): Promise<void> {
  const overlapping = await repo.findMany({ roomId } as any)
  const active = overlapping.filter((r: any) => r.status !== 'cancelled' && r.status !== 'no_show')
  const conflict = active.find((r: any) =>
    r.id !== excludeId && r.checkIn < checkOut && r.checkOut > checkIn,
  )
  if (conflict) {
    throw new ConflictError(`Habitación no disponible en esas fechas (ocupada del ${(conflict as any).checkIn} al ${(conflict as any).checkOut} por la reserva ${(conflict as any).id})`)
  }
}
