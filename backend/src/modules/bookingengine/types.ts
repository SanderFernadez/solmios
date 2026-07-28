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
export interface BookingAnalytics {
  totalSearches: number
  totalBookings: number
  conversionRate: number
  totalRevenue: number
  averageBookingValue: number
  topRoomTypes: { roomType: string; bookings: number; revenue: number }[]
  dailyTrend: { date: string; searches: number; bookings: number }[]
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
