// shared/usecases/public-api-reservations.ts — Lógica de creación/lectura de reservas para la API
// pública v1. Extraído del connector `publicapi-reservas.ts` (los conectores SOLO deben wirear).

import type { CreatePublicReservationDTO, PublicReservationDTO } from '../../modules/publicapi/types'
import { publicApiSystemUser } from './public-api-availability'

export interface HuespedesCreatePort { create: (dto: any, user: any) => Promise<any> }
export interface ReservasCreatePort {
  create: (dto: any, user: any) => Promise<any>
  getById: (id: string, user: any) => Promise<any>
}

export async function createPublicReservation(
  huespedes: HuespedesCreatePort,
  reservas: ReservasCreatePort,
  hotelId: string,
  dto: CreatePublicReservationDTO,
): Promise<PublicReservationDTO> {
  const user = publicApiSystemUser(hotelId)
  // La API pública recibe datos de contacto (nombre/email/teléfono), no un guestId: se crea un
  // huésped por reserva. v1 simplificado — sin dedupe por email (ver reporte final).
  const guest = await huespedes.create({ name: dto.guestName, email: dto.guestEmail, phone: dto.guestPhone }, user)
  const reservation = await reservas.create({
    hotelId,
    roomId: dto.roomId,
    checkIn: dto.checkIn,
    checkOut: dto.checkOut,
    adults: dto.adults,
    children: dto.children,
    totalAmount: dto.totalAmount,
    currency: dto.currency,
    notes: dto.notes,
    guestId: guest.id,
    status: 'pending',
    channel: 'direct',
    source: 'public-api',
  }, user)
  return reservation as PublicReservationDTO
}

export async function getPublicReservation(
  reservas: ReservasCreatePort,
  hotelId: string,
  id: string,
): Promise<PublicReservationDTO> {
  const user = publicApiSystemUser(hotelId)
  // reservas.getById ya lanza AuthError si item.hotelId !== user.hotelId (ownership real: el
  // usuario sintético NO es super_admin).
  return reservas.getById(id, user) as Promise<PublicReservationDTO>
}
