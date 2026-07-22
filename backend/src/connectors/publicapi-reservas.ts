// connectors/publicapi-reservas.ts — Conector para la API pública v1 (módulo `publicapi`).
// `publicapi` NUNCA importa habitaciones/reservas/huespedes directo (regla del framework): este
// connector resuelve los tres módulos y le inyecta a `publicapi` los "puertos" rooms/reservations
// vía `setDeps()` — mismo patrón que `apikeys-auditlog.ts` inyectando el audit port.
//
// La lógica (disponibilidad, creación de huésped+reserva) vive en shared/usecases/ — un connector
// SOLO wirea (CLAUDE #3 / `arckode analyze` bloquea lógica de negocio en connectors/).

import type { ConnectorContext } from 'arckode-framework'
import { listPublicRoomsAvailability, type RoomsListPort, type ReservasListPort } from '../shared/usecases/public-api-availability'
import { createPublicReservation, getPublicReservation, type HuespedesCreatePort, type ReservasCreatePort } from '../shared/usecases/public-api-reservations'

interface PublicapiModulePort { setDeps: (deps: any) => void }

export function publicapiReservasConnector(ctx: ConnectorContext): void {
  const publicapi = ctx.resolveModule<PublicapiModulePort>('publicapi')
  const habitaciones = ctx.resolveModule<RoomsListPort>('habitaciones')
  const reservas = ctx.resolveModule<ReservasListPort & ReservasCreatePort>('reservas')
  const huespedes = ctx.resolveModule<HuespedesCreatePort>('huespedes')

  publicapi.setDeps({
    rooms: {
      listAvailability: (hotelId: string, query: any) => listPublicRoomsAvailability(habitaciones, reservas, hotelId, query),
    },
    reservations: {
      create: (hotelId: string, dto: any) => createPublicReservation(huespedes, reservas, hotelId, dto),
      getById: (hotelId: string, id: string) => getPublicReservation(reservas, hotelId, id),
    },
  })
}
