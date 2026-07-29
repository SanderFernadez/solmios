// bookingengine/model.ts — Schema de base de datos
// F4 4.2 — Modelo legacy de stock diario BORRADO (tabla + repo + constructor param).
// La disponibilidad se calcula live desde Rooms + Reservations (ver usecases/availability.ts).
// 2 tablas restantes: BookingConfig (config widget) + ConversionEvents (analytics legacy).

import type { ModelDefinition, ORM } from 'arckode-framework'

export const BookingConfigModel: ModelDefinition = {
  table: 'booking_config',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    enabled: { type: 'boolean', default: true },
    theme: { type: 'string', default: 'navy' },
    position: { type: 'string', default: 'corner' },
    currency: { type: 'string', default: 'USD' },
    language: { type: 'string', default: 'es' },
    minNights: { type: 'number', default: 1 },
    maxNights: { type: 'number', default: 30 },
    cancellationPolicy: { type: 'string', default: 'flexible' },
    showComparison: { type: 'boolean', default: true },
    googleAdsEnabled: { type: 'boolean', default: false },
    whatsappConfirmation: { type: 'boolean', default: false },
    instantConfirmation: { type: 'boolean', default: true },
    stripeAccountId: { type: 'string', default: '' },
    allowedCountries: { type: 'json', default: [] },
  },
}

export const ConversionEventsModel: ModelDefinition = {
  table: 'conversion_events',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    sessionId: { type: 'string', required: true },
    event: { type: 'string', required: true },
    roomType: { type: 'string' },
    amount: { type: 'number' },
    source: { type: 'string' },
    utmSource: { type: 'string' },
    utmMedium: { type: 'string' },
    utmCampaign: { type: 'string' },
    device: { type: 'string' },
    country: { type: 'string' },
  },
}

// Booking público generado por el motor de reservas (POST /api/public/bookings).
// Sin este modelo, `new OrmRepository(orm, 'BookingEngine')` en index.ts referencia
// un modelo inexistente → createBooking/getBooking crashean en runtime.
export const PublicBookingModel: ModelDefinition = {
  table: 'public_bookings',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    roomType: { type: 'string' },
    roomId: { type: 'string', indexed: true },
    guestName: { type: 'string' },
    guestEmail: { type: 'string' },
    guestPhone: { type: 'string' },
    checkIn: { type: 'string', indexed: true },
    checkOut: { type: 'string' },
    adults: { type: 'number', default: 1 },
    children: { type: 'number', default: 0 },
    totalAmount: { type: 'number', default: 0 },
    currency: { type: 'string', default: 'USD' },
    status: { type: 'string', default: 'pending', indexed: true },
    paymentStatus: { type: 'string', default: 'unpaid' },
    paymentRef: { type: 'string', default: '' },
    promoCode: { type: 'string', default: '' },
  },
}

// F2 2.3 (spec booking-widget) — Upsells: extras del widget de reservas (desayuno,
// transfer, late checkout). Modelo `Upsells`, tabla `upsells`. Vive como sub-dominio
// de bookingengine (no es módulo aparte): comparte hotelId y se gestiona desde el
// panel del hotel junto con la config del motor.
//
// Anti-patrón ORM (mem 1805): TODO campo persistido por service/DTO/validator está
// declarado acá — case-sensitive (`sortOrder` ≠ `sortorder`). `kind` se valida en el
// usecase (enum cerrado). `price` se guarda en la MONEDA DEL HOTEL (multi-moneda F2
// es display-only, el cobro siempre es en hotels.currency).
export const UpsellModel: ModelDefinition = {
  table: 'upsells',
  timestamps: true,
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    // 'Desayuno buffet', 'Transfer aeropuerto', 'Late checkout', etc.
    name: { type: 'string', required: true },
    // Descripción marketing para mostrar en el widget (opcional).
    description: { type: 'text' },
    // Precio en la moneda del hotel. >=0 validado en el usecase.
    price: { type: 'number', required: true },
    // 'per_room' | 'per_person' | 'per_stay' — cómo se calcula al multiplicar por qty/huésped.
    kind: { type: 'string', required: true },
    // Toggle visible desde el panel sin borrar. Default 1 (activo).
    active: { type: 'boolean', default: true },
    // Orden dentro del hotel para el step de upsells del widget. Default 0.
    sortOrder: { type: 'number', default: 0 },
  },
}

export function registerBookingengineModels(orm: ORM): void {
  orm.define('BookingConfig', BookingConfigModel)
  orm.define('ConversionEvents', ConversionEventsModel)
  orm.define('BookingEngine', PublicBookingModel)
  // F2 2.3 (spec booking-widget) — Upsells: extras del widget público (desayuno, transfer,
  // late checkout). Sub-dominio de bookingengine: comparte hotelId, NO amerita módulo
  // aparte. Dueño: este modelo (NO definir en shared/models.ts — regla anti-modelo-dual).
  orm.define('Upsells', UpsellModel)
}
