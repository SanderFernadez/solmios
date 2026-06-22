// canales/usecases/booking-ingestion.ts
// Aplica una revisión de booking OTA al PMS: dedupe por locator, resolución de roomId, persistencia.
// Extraído del service para mantenerlo <200 líneas. Lógica preservada de la POC Channex.
//
// Cancelaciones → refrescan la reserva existente.
// Modificaciones → se ack sin sobreescribir datos en vivo (requiere reconciliación humana).

import type { ORM } from 'arckode-framework'
import type { ChannexUseCase } from './channex'

export interface BookingIngestDeps {
  orm: ORM
  channex: ChannexUseCase
  hotelId: string
  apiKey: string
}

/**
 * Aplica UNA revisión de booking al PMS.
 * - Dedupe por externalLocator (ota_reservation_code / unique id de Channex).
 * - Cancelación OTA (status 'cancelled') → actualiza la reserva existente.
 * - Creación → resuelve roomId desde el roomTypeId de Channex (fallback a cualquier room + flag).
 * - Nunca dropea un booking OTA: si no hay room libre, igual ingest con auto-asignación.
 */
export async function applyBookingRevision(deps: BookingIngestDeps, dto: any): Promise<void> {
  const { orm, channex, hotelId, apiKey } = deps

  // Dedupe por locator externo.
  if (dto.externalLocator) {
    const existing = await orm.findMany('Reservations', { hotelId, externalLocator: dto.externalLocator })
    if (existing && existing.length > 0) {
      if (dto.status === 'cancelled') {
        await orm.update('Reservations', existing[0].id, { status: 'cancelled' })
      }
      return
    }
  }

  // Resolver roomId: Channex referencia roomTypeId (tipo), el PMS exige habitación individual.
  const { channexRoomTypeId, channexRevisionId, channexBookingId, ...payload } = dto
  let roomId: string | null = null
  if (channexRoomTypeId) {
    const rt = await channex.getRoomTypeById(apiKey, channexRoomTypeId)
    if (rt?.title) {
      const rooms = await orm.findMany('Rooms', { hotelId, type: rt.title })
      roomId = rooms?.[0]?.id || null
    }
  }
  if (!roomId) {
    // Fallback: cualquier habitación del hotel + flag de auto-asignación (nunca dropear un OTA booking).
    const any = await orm.findMany('Rooms', { hotelId })
    roomId = any?.[0]?.id || null
    if (roomId && payload.notes) payload.notes = `${payload.notes} | ⚠ AUTO-ASSIGNED ROOM (no type match)`
  }
  if (!roomId) throw new Error(`Sin habitaciones para el hotel ${hotelId}`)

  payload.id = crypto.randomUUID()
  payload.roomId = roomId
  await orm.create('Reservations', payload)
}
