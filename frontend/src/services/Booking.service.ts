// services/Booking.service.ts — Cliente API del flujo de RESERVA pública (F0 0.20,
// solmi-direct-booking / Pieza 6a).
//
// Dos endpoints públicos:
//   - POST /api/public/booking              → crea reserva pending + redirige a Stripe
//   - GET  /api/public/reservations/:id      → polling post-redirect (valida token HMAC)
//
// El service acepta DTOs "friendly" (slug + guest anidado) y los aplana al shape que
// requiere el backend (ExtendedPublicBookingSchema). El response crudo del backend
// (`{reservation, guest, checkoutUrl, paymentError?}`) también se aplana al contract limpio
// del spec booking-unification R-1: `{reservationId, accessToken, checkoutUrl, paymentError?}`.
//
// ROBUSTEZ F0 (public-booking.ts:152-171): si Stripe falla (no configurado / gateway caído),
// la reserva SE CREA igual con status='pending' y el backend devuelve 201 con
// `checkoutUrl: null` + `paymentError`. El service NO relanza — el widget muestra el error
// y la reserva sigue viviendo en el panel del hotelero.

import { http } from './http'
import { PublicHotelService } from './PublicHotel.service'
import type {
  CreateBookingDTO,
  CreateBookingResponse,
  PublicReservationResponse,
} from '@/types/booking'

/**
 * Respuesta cruda del backend (espejo de public-booking.ts return body). El service la
 * transforma a `CreateBookingResponse` (spec booking-unification R-1, shape plana).
 */
interface RawCreateBookingResponse {
  reservation: { id: string; accessToken: string; [k: string]: unknown }
  guest: unknown
  checkoutUrl: string | null
  paymentError?: string
}

export const BookingService = {
  /**
   * Crea una reserva pública y dispara el Checkout Session de Stripe.
   *
   * Pasos:
   *   1. Resuelve `dto.slug` → `hotelId` vía `PublicHotelService.getBySlug` (una request
   *      extra; deja el DTO del widget limpio: el widget sabe el slug, no el id interno).
   *   2. Mapea `guest:{name,email,phone}` → `guestName/guestEmail/guestPhone` (schema backend).
   *   3. POST /api/public/booking con el body plano + upsells/promoCode/successUrl/cancelUrl.
   *   4. Aplana la respuesta a `{reservationId, accessToken, checkoutUrl, paymentError?}`.
   *
   * El `accessToken` se devuelve al frontend para que arme la URL de vuelta
   * `/h/:slug?booking=:id&token=:token` (spec R2) — Stripe vuelve a esa URL tras el pago.
   */
  async createBooking(dto: CreateBookingDTO): Promise<CreateBookingResponse> {
    const hotel = await PublicHotelService.getBySlug(dto.slug)
    const body: Record<string, unknown> = {
      hotelId: hotel.id,
      roomId: dto.roomId,
      roomType: dto.roomType,
      guestName: dto.guest.name,
      guestEmail: dto.guest.email,
      guestPhone: dto.guest.phone,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      adults: dto.adults,
    }
    if (dto.children !== undefined) body.children = dto.children
    if (dto.promoCode) body.promoCode = dto.promoCode
    if (dto.upsells && dto.upsells.length > 0) body.upsells = dto.upsells
    if (dto.successUrl) body.successUrl = dto.successUrl
    if (dto.cancelUrl) body.cancelUrl = dto.cancelUrl

    const raw = await http.post<RawCreateBookingResponse>('/public/booking', body)
    const response: CreateBookingResponse = {
      reservationId: raw.reservation.id,
      accessToken: raw.reservation.accessToken,
      checkoutUrl: raw.checkoutUrl,
    }
    if (raw.paymentError) response.paymentError = raw.paymentError
    return response
  },

  /**
   * Consulta pública de reserva por id + token HMAC (anti-IDOR, spec booking-unification).
   *
   * Token = `accessToken` que devolvió `createBooking`. Sin token, token incorrecto, o
   * reserva creada desde panel (accessToken=null) → 404 con mismo body (no revelar existencia).
   * El widget usa esto para hacer polling del estado tras volver de Stripe (confirmed/pending/failed).
   */
  getReservation(id: string, token: string): Promise<PublicReservationResponse> {
    const qs = new URLSearchParams({ token })
    const path = `/public/reservations/${encodeURIComponent(id)}?${qs.toString()}`
    return http.get<PublicReservationResponse>(path)
  },
}
