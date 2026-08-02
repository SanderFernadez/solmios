// canales/usecases/booking-ingestion.ts
// Aplica una revisión de booking OTA al PMS: dedupe por locator, resolución de roomId, persistencia.
// Extraído del service para mantenerlo <200 líneas. Lógica preservada de la POC Channex.
//
// Cancelaciones → refrescan la reserva existente.
// Modificaciones → se ack sin sobreescribir datos en vivo (requiere reconciliación humana).

import type { ORM } from 'arckode-framework'
import type { ChannexUseCase } from './channex'
import type { BookingRevisionDTO } from '../types'

export interface BookingIngestDeps {
  orm: ORM
  channex: ChannexUseCase
  hotelId: string
  apiKey: string
}

/** Resultado de aplicar una revisión: distingue reserva creada vs dedupe (ya existía). */
export interface ApplyBookingResult {
  /** true → se creó una reserva nueva; false → dedupe (posiblemente actualizada por cancelación). */
  created: boolean
}

/**
 * DTO de reserva mapeado desde una revisión OTA de Channex.
 * hotelId llega por parámetro (no desde cfg) → permite el path global multi-tenancy.
 */
export interface MappedBookingDTO {
  hotelId: string
  channel: string
  source: string
  externalLocator: string
  checkIn: string
  checkOut: string
  totalAmount: number
  currency: string
  status: string
  adults: number
  children: number
  notes: string
  otaNotes: string
  channexRevisionId: string
  channexBookingId: string
  channexRoomTypeId: string | null
}

/**
 * Mapea una revisión de booking de Channex al DTO de reserva del PMS.
 * Función PURA: sin IO, sin side-effects. El hotelId se inyecta (resolución multi-tenancy
 * la hace el caller vía revision.propertyId → channel_config.channexPropertyId).
 *
 * Preserva el mapeo histórico de channex.ingestBookings (guestName, occupancy, locator, etc.).
 */
export function mapBookingRevision(booking: BookingRevisionDTO, hotelId: string): MappedBookingDTO {
  const guestName = [booking.customer?.name, booking.customer?.surname].filter(Boolean).join(' ') || 'OTA Guest'
  const guestEmail = booking.customer?.mail || ''
  const guestPhone = booking.customer?.phone || ''
  const firstRoom = (booking.rooms || [])[0] || ({} as BookingRevisionDTO['rooms'][number])
  const adults = firstRoom.occupancy?.adults ?? 2
  const children = (firstRoom.occupancy?.children || 0) + (firstRoom.occupancy?.infants || 0)
  return {
    hotelId,
    channel: booking.otaName,
    source: 'ota',
    externalLocator: booking.otaReservationCode || booking.uniqueId,
    checkIn: booking.arrivalDate,
    checkOut: booking.departureDate,
    totalAmount: parseFloat(booking.amount) || 0,
    currency: booking.currency,
    status: booking.status === 'cancelled' ? 'cancelled' : 'confirmed',
    adults,
    children,
    notes: `OTA: ${booking.otaName} | Ref: ${booking.uniqueId}`,
    otaNotes: `Guest: ${guestName} <${guestEmail}> ${guestPhone} | revision ${booking.id} | booking ${booking.bookingId}`,
    channexRevisionId: booking.id,
    channexBookingId: booking.bookingId,
    channexRoomTypeId: firstRoom.roomTypeId || null,
  }
}

/**
 * Aplica UNA revisión de booking al PMS.
 * - Dedupe por externalLocator (ota_reservation_code / unique id de Channex).
 * - Cancelación OTA (status 'cancelled') → actualiza la reserva existente.
 * - Creación → resuelve roomId desde el roomTypeId de Channex (fallback a cualquier room + flag).
 * - Nunca dropea un booking OTA: si no hay room libre, igual ingest con auto-asignación.
 */
export async function applyBookingRevision(deps: BookingIngestDeps, dto: any): Promise<ApplyBookingResult> {
  const { orm, channex, hotelId, apiKey } = deps

  // Dedupe por locator externo.
  if (dto.externalLocator) {
    const existing = await orm.findMany('Reservations', { hotelId, externalLocator: dto.externalLocator })
    if (existing && existing.length > 0) {
      if (dto.status === 'cancelled') {
        await orm.update('Reservations', existing[0].id, { status: 'cancelled' })
      }
      return { created: false }
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
  return { created: true }
}
