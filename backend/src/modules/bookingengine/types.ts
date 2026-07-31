// bookingengine/types.ts — DTOs y tipos de queries
// Contrato TypeScript del módulo (cómo se ven los datos).

// ─── BookingConfig ─────────────────────────────────────
export interface BookingConfigDTO {
  id: string
  hotelId: string
  enabled: boolean
  theme: string
  position: string
  currency: string
  language: string
  minNights: number
  maxNights: number
  cancellationPolicy: string
  showComparison: boolean
  googleAdsEnabled: boolean
  whatsappConfirmation: boolean
  instantConfirmation: boolean
  stripeAccountId: string
  allowedCountries: string[]
  createdAt: string
  updatedAt: string
}

export interface UpdateBookingConfigDTO {
  enabled?: boolean
  theme?: string
  position?: string
  currency?: string
  language?: string
  minNights?: number
  maxNights?: number
  cancellationPolicy?: string
  showComparison?: boolean
  googleAdsEnabled?: boolean
  whatsappConfirmation?: boolean
  instantConfirmation?: boolean
  stripeAccountId?: string
  allowedCountries?: string[]
}

// ─── Availability ──────────────────────────────────────
export interface AvailabilityQuery {
  hotelId: string
  checkIn: string
  checkOut: string
  adults?: number
  children?: number
  promoCode?: string
}

export interface RoomTypeAvailability {
  roomType: string
  available: number
  price: number
  currency: string
  originalPrice?: number
  capacity: number
  /** Metros cuadrados (máximo entre las rooms reales del type). 0 si no está cargado. */
  surfaceArea: number
  amenities: string[]
}

export interface AvailabilityResult {
  hotelId: string
  hotelName: string
  checkIn: string
  checkOut: string
  nights: number
  roomTypes: RoomTypeAvailability[]
}

// ─── Public Booking ────────────────────────────────────
export interface PublicBookingDTO {
  id: string
  hotelId: string
  roomType: string
  roomId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  totalAmount: number
  currency: string
  status: string
  paymentStatus: string
  paymentRef: string
  promoCode: string
  createdAt: string
  updatedAt: string
}

export interface CreatePublicBookingDTO {
  hotelId: string
  roomType: string
  guestName: string
  guestEmail: string
  guestPhone: string
  checkIn: string
  checkOut: string
  adults: number
  children?: number
  promoCode?: string
}

// ─── Conversion Events ─────────────────────────────────
export interface ConversionEventDTO {
  id: string
  hotelId: string
  sessionId: string
  event: string
  roomType?: string
  amount?: number
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  device?: string
  country?: string
  createdAt: string
  updatedAt: string
}

export interface CreateConversionEventDTO {
  hotelId: string
  sessionId: string
  event: string
  roomType?: string
  amount?: number
  source?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  device?: string
  country?: string
}

// ─── Analytics ─────────────────────────────────────────

/**
 * Step del funnel de conversión (F4 4.1 / D13). Orden fijo:
 *   view → search → select → upsell → form → pay → confirm.
 *
 * `count` = número de tracking_events con ese `event` para el hotel en el rango.
 * `dropOff` = % que avanzó al siguiente step respecto del actual (0–100). Para el último
 * step (`confirm`) dropOff queda null (no hay step siguiente).
 *
 * Los eventos se persisten en `tracking_events` con `target='internal'` ( eventos del
 * funnel que NO se disparan a Meta/GA4 externos — esos fires llevan `target='meta'|'ga4'`).
 * El funnel cuenta TODOS los targets (un evento puede haberse disparado a Meta Y persistirse
 * como internal — para el funnel solo nos importa el hecho del step, no el disparo externo).
 */
export interface FunnelStep {
  /** Nombre del step (view|search|select|upsell|form|pay|confirm). */
  step: string
  /** Etiqueta legible para el panel ( Matches TrackingEventType del server-tracking). */
  label: string
  /** Número de eventos de este step en el rango. */
  count: number
  /** % de conversión al step siguiente (count_siguiente / count_actual * 100). null en el último. */
  dropOff: number | null
}

export interface BookingAnalytics {
  totalSearches: number
  totalBookings: number
  conversionRate: number
  totalRevenue: number
  averageBookingValue: number
  /** F4 4.1 (D13) — Funnel real desde tracking_events. Reemplaza `topRoomTypes:[]` vacío. */
  funnel: FunnelStep[]
}

// ─── Hotel Info (público) ──────────────────────────────
/** DTO público de hotel — allow-list estricta (F0 0.4 spec public-hotel-info).
 *  NUNCA debe contener campos privados del hotelero (taxId, ownerName, ownerTaxId,
 *  deviceEmail, wifiNetwork, wifiPassword, internalNotes, bookingEngineUrl,
 *  motorVersion, warningPhone, registrationNumber). */
export interface PublicHotelInfoDTO {
  id: string
  slug: string
  name: string
  title: string | null
  description: string | null
  descriptionTranslations: Record<string, { title?: string; description?: string }> | null
  accommodationType: string
  starRating: string | null
  latitude: number
  longitude: number
  address: string | null
  province: string | null
  municipality: string | null
  locality: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  website: string | null
  checkIn: string
  checkOut: string
  currency: string
  taxName: string
  taxRate: number
  cancellationType: string
  freeCancellation: boolean
  depositRequired: boolean
  depositPercent: number
  releaseHours: number
  logo: string | null
  amenities: string[] | null
  onlineBookingStatus: string
}

// ─── Upsells (F2 2.3 — sub-dominio de bookingengine) ────────────
/** Forma de cobro del upsell: cómo se multiplica al sumarlo al total de la reserva. */
export type UpsellKind = 'per_room' | 'per_person' | 'per_stay'

/** DTO de lectura. Espeja los campos persistidos en `upsells` (model.ts). */
export interface UpsellDTO {
  id: string
  hotelId: string
  name: string
  description: string | null
  /** Precio en la moneda del hotel. */
  price: number
  kind: UpsellKind
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Body del POST /api/upsells. */
export interface CreateUpsellDTO {
  name: string
  description?: string | null
  price: number
  kind: UpsellKind
  active?: boolean
  sortOrder?: number
}

/** Body del PUT /api/upsells/:id. Todos opcionales (partial). */
export interface UpdateUpsellDTO {
  name?: string
  description?: string | null
  price?: number
  kind?: UpsellKind
  active?: boolean
  sortOrder?: number
}

/** Usuario autenticado (req.user). Para ownership (IDOR) y forzar hotelId. */
export interface UpsellCurrentUser {
  id: string
  hotelId?: string | null
  role?: string
  userType?: string
}
