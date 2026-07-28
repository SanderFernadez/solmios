// types/booking.ts — Tipos del flujo de reserva pública (F0 0.20, solmi-direct-booking).
// Espejo de:
//   - bookingengine/validators/schema.ts ExtendedPublicBookingSchema (POST /api/public/booking)
//   - bookingengine/usecases/public-booking.ts createPublicBookingDirect (respuesta cruda)
//   - bookingengine/usecases/public-reservation.ts getPublicReservation (GET /api/public/reservations/:id)
//
// El DTO público (CreateBookingDTO) es "friendly": slug + guest anidado. El service lo aplana
// al shape que espera el backend (hotelId + guestName/guestEmail/guestPhone planos) resolviendo
// slug→hotelId con PublicHotel.service.getBySlug. Spec booking-unification R-1 pide respuesta
// plana {reservationId, accessToken, checkoutUrl} → el service también aplana la respuesta.

// ─── POST /api/public/booking ──────────────────────────

export interface CreateBookingGuest {
  name: string
  email: string
  phone: string
}

/** Hook F2 (task 2.5): el backend aún no valida contra modelo Upsell, solo lo persiste en
 *  `notes` y reserved el campo para promo. El frontend lo manda igual — cuando F2 cablee el
 *  cálculo del total con upsells, ya va a estar en el body. */
export interface CreateBookingUpsell {
  id: string
  quantity: number
}

/** DTO friendly que recibe `BookingService.createBooking`. El service resuelve slug→hotelId,
 *  mapea `guest` → `guestName/guestEmail/guestPhone`, y postea al backend con el shape del
 *  `ExtendedPublicBookingSchema`. `roomType` es required por el schema del backend (aunque el
 *  usecase solo use `roomId`); el widget lo saca del resultado de disponibilidad. */
export interface CreateBookingDTO {
  slug: string
  roomId: string
  roomType: string
  checkIn: string
  checkOut: string
  adults: number
  children?: number
  guest: CreateBookingGuest
  promoCode?: string
  upsells?: CreateBookingUpsell[]
  /** URLs de vuelta desde Stripe. Si se omiten, el backend deriva de PUBLIC_BASE_URL/Referer.
   *  Pattern: `/h/:slug?booking=:id&token=:token` (spec booking-unification R2). */
  successUrl?: string
  cancelUrl?: string
}

/** Respuesta plana del service (spec booking-unification R-1). El backend devuelve
 *  `{reservation, guest, checkoutUrl, paymentError?}`; el service mapea a ESTE shape limpio.
 *  - `checkoutUrl: null` cuando el hotel no tiene Stripe configurado o el gateway cayó (la
 *    reserva se crea igual con status='pending'; ver robustez F0 en public-booking.ts).
 *  - `paymentError` solo se incluye si hubo un error real de pasarela. */
export interface CreateBookingResponse {
  reservationId: string
  accessToken: string
  checkoutUrl: string | null
  paymentError?: string
}

// ─── GET /api/public/reservations/:id?token= ──────────
// Polling post-redirect (spec booking-unification R3). Token = accessToken de la reserva.

export interface PublicReservationGuest {
  id: string
  name: string
  email?: string | null
  phone?: string | null
}

/** Subset de `Reservations` que el backend devuelve al huésped (anti-enumeración: solo
 *  llega si el token HMAC validó). No se incluye `accessToken` acá — ya vive en la URL. */
export interface PublicReservation {
  id: string
  hotelId: string
  roomId: string
  guestId?: string
  checkIn: string
  checkOut: string
  status: string
  paymentStatus?: string
  source?: string
  adults?: number
  children?: number
  totalAmount?: number
  notes?: string | null
  promoCode?: string | null
}

export interface PublicReservationResponse {
  reservation: PublicReservation
  guest: PublicReservationGuest | null
  paymentStatus: string
}
