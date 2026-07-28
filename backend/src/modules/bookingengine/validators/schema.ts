// bookingengine/validators/schema.ts — Validación de entrada
// Schemas para config, disponibilidad pública, reservas, eventos

import type { ValidationRule } from 'arckode-framework'

// ─── Config (admin) ────────────────────────────────────

export const UpdateBookingConfigSchema: Record<string, ValidationRule> = {
  enabled: { type: 'boolean' as const },
  theme: { type: 'string' as const },
  position: { type: 'string' as const },
  currency: { type: 'string' as const },
  language: { type: 'string' as const },
  minNights: { type: 'number' as const, min: 1 },
  maxNights: { type: 'number' as const, min: 1 },
  cancellationPolicy: { type: 'string' as const },
  showComparison: { type: 'boolean' as const },
  googleAdsEnabled: { type: 'boolean' as const },
  whatsappConfirmation: { type: 'boolean' as const },
  instantConfirmation: { type: 'boolean' as const },
  stripeAccountId: { type: 'string' as const },
}

// ─── Disponibilidad pública ─────────────────────────────

export const CheckAvailabilitySchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  checkIn: { type: 'string' as const, required: true },
  checkOut: { type: 'string' as const, required: true },
  adults: { type: 'number' as const, min: 1 },
  children: { type: 'number' as const, min: 0 },
  promoCode: { type: 'string' as const },
}

// ─── Reserva pública ────────────────────────────────────

export const CreatePublicBookingSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  roomType: { type: 'string' as const, required: true },
  guestName: { type: 'string' as const, required: true, min: 2, max: 200 },
  guestEmail: { type: 'string' as const, required: true },
  guestPhone: { type: 'string' as const, required: true },
  checkIn: { type: 'string' as const, required: true },
  checkOut: { type: 'string' as const, required: true },
  adults: { type: 'number' as const, required: true, min: 1 },
  children: { type: 'number' as const, min: 0 },
  promoCode: { type: 'string' as const },
}

// ─── Eventos ────────────────────────────────────────────

export const TrackEventSchema: Record<string, ValidationRule> = {
  hotelId: { type: 'string' as const, required: true },
  sessionId: { type: 'string' as const, required: true },
  event: { type: 'string' as const, required: true },
  roomType: { type: 'string' as const },
  amount: { type: 'number' as const },
  source: { type: 'string' as const },
  utmSource: { type: 'string' as const },
  utmMedium: { type: 'string' as const },
  utmCampaign: { type: 'string' as const },
  device: { type: 'string' as const },
  country: { type: 'string' as const },
}

// ─── Validator compuesto ────────────────────────────────

export const BookingengineValidator = {
  updateConfig: UpdateBookingConfigSchema,
  checkAvailability: CheckAvailabilitySchema,
  createBooking: CreatePublicBookingSchema,
  trackEvent: TrackEventSchema,
}

export const CreateCheckoutSessionSchema: Record<string, ValidationRule> = {
  successUrl: { type: 'string' as const, required: true },
  cancelUrl: { type: 'string' as const, required: true },
}

/**
 * F0 0.16 — Extensión del schema `POST /api/public/booking` para aceptar `successUrl`/
 * `cancelUrl` (opcional, para que el widget F2 pueda pasar las URLs de vuelta). `promoCode`
 * ya está en el schema base; `upsells` no se agrega porque el framework no soporta `type:'json'`
 * en validators (ValidationType = string|number|boolean|email|url|date). El usecase lee
 * `upsells` directo del body como HOOK para F2 task 2.5; cuando F2 lo materialice como modelo
 * Upsell propio, este schema se amplía con el tipo correcto.
 */
export const ExtendedPublicBookingSchema: Record<string, ValidationRule> = {
  ...CreatePublicBookingSchema,
  successUrl: { type: 'string' as const },
  cancelUrl: { type: 'string' as const },
}
