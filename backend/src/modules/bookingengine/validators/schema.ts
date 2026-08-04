// bookingengine/validators/schema.ts — Validación de entrada
// Schemas para config, disponibilidad pública, reservas, eventos

import type { ValidationRule } from 'arckode-framework'
// `BodyRule` del shared (superconjunto del framework): incluye 'text' multilinea,
// 'array', 'object', 'json'. Necesario para `description` de upsells (texto libre con
// saltos de línea — el `type: 'string'` del framework aplasta los \n a espacios).
import type { BodyRule } from '../../../shared/validators/validate-body'

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
 *
 * B5 fix (audit solmi-direct-booking) — Agregado `roomId` como string: el widget unificado (F2)
 * podía mandar `roomId` (la habitación específica). Antes el schema no lo declaraba → el
 * controller NO validaba el body y pasaba `req.body` crudo al usecase.
 *
 * FIX 2026-07-30 (bug 404 "Habitación no encontrada") — `roomId` pasa a ser OPCIONAL. Root
 * cause: `public-rates.ts` no tiene entidad RoomType propia — el `id` que devuelve por room
 * type ES el string `roomType` ("double"), NO un UUID de `Rooms`. El widget lo mandaba como
 * `roomId` → `orm.findById('Rooms', 'double')` → 404 en el 100% de los intentos. Decisión de
 * diseño: el guest elige un TIPO de habitación, no una unidad física — la asignación de la
 * habitación concreta es responsabilidad del BACKEND al crear la reserva (usecase resuelve por
 * `roomType` + hotelId + disponibilidad, ver `createPublicBookingDirect`). `roomType` sigue
 * required (heredado del schema base, ya lo era). `roomId` queda como alternativa opcional
 * para compat con callers/integradores viejos que ya mandan un id real de `Rooms`.
 */
export const ExtendedPublicBookingSchema: Record<string, ValidationRule> = {
  ...CreatePublicBookingSchema,
  roomId: { type: 'string' as const },
  successUrl: { type: 'string' as const },
  cancelUrl: { type: 'string' as const },
}

// ─── Upsells (F2 2.3) ──────────────────────────────────────────────────────
// `description` usa `text` (BodyRule structured) para no aplastar saltos de línea: el
// admin podría escribir "Incluye jugo, frutas y café.\nServicio de 6 a 10 am.".

/** POST /api/upsells — alta de upsell. */
export const CreateUpsellSchema: Record<string, BodyRule> = {
  name: { type: 'string' as const, required: true },
  description: { type: 'text' as const },
  price: { type: 'number' as const, required: true },
  kind: { type: 'string' as const, required: true },
  active: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const },
}

/** PUT /api/upsells/:id — edición (partial). */
export const UpdateUpsellSchema: Record<string, BodyRule> = {
  name: { type: 'string' as const },
  description: { type: 'text' as const },
  price: { type: 'number' as const },
  kind: { type: 'string' as const },
  active: { type: 'boolean' as const },
  sortOrder: { type: 'number' as const },
}

// ─── Calendario público de tarifas ─────────────────────────────────────────
// `GET /api/public/hotels/:slug/calendar?from&to&guests&currency`.
//
// No usa `validateSchema` del framework: eso valida BODIES tipados (POST/PUT/PATCH) y acá
// todo llega como string en el query. Mismo criterio que el resto de los GET públicos del
// módulo (/rates, /ota-prices), pero centralizado en una función pura para poder testearla
// sin levantar el usecase entero.

/** Máximo de días que devuelve el calendario en una sola llamada. Única fuente de verdad:
 *  el usecase y el mensaje de error de arriba lo importan de acá, no lo repiten. */
export const MAX_CALENDAR_DAYS = 90

const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CALENDAR_MS_PER_DAY = 86_400_000

export interface PublicCalendarQueryInput {
  from?: string
  to?: string
  guests?: number
  currency?: string
}

export interface PublicCalendarQueryValid {
  from: string
  to: string
  guests: number
  currency?: string
}

/**
 * Valida el query del calendario. Devuelve `{ error }` con el mensaje listo para el 400, o
 * `{ value }` normalizado. No lanza: los handlers públicos del módulo devuelven `{status, body}`.
 */
export function validatePublicCalendarQuery(
  input: PublicCalendarQueryInput,
): { error: string } | { value: PublicCalendarQueryValid } {
  const from = String(input.from || '')
  const to = String(input.to || '')
  if (!from || !to) return { error: 'from y to son requeridos' }
  if (!CALENDAR_DATE_RE.test(from) || !CALENDAR_DATE_RE.test(to)) {
    return { error: 'from y to deben tener formato YYYY-MM-DD' }
  }
  const tFrom = Date.parse(`${from}T00:00:00Z`)
  const tTo = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(tFrom) || !Number.isFinite(tTo)) {
    return { error: 'from y to deben ser fechas válidas' }
  }
  const span = Math.round((tTo - tFrom) / CALENDAR_MS_PER_DAY)
  if (span < 0) return { error: 'to debe ser igual o posterior a from' }
  if (span + 1 > MAX_CALENDAR_DAYS) {
    return { error: `El rango no puede superar ${MAX_CALENDAR_DAYS} días` }
  }
  if (input.guests !== undefined && (!Number.isFinite(input.guests) || Number(input.guests) < 1)) {
    return { error: 'guests debe ser un número mayor o igual a 1' }
  }
  const guests = input.guests !== undefined ? Math.floor(Number(input.guests)) : 2
  const currency = typeof input.currency === 'string' && input.currency
    ? input.currency.toUpperCase()
    : undefined
  return { value: { from, to, guests, currency } }
}
