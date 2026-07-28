// types/public-hotel.ts — Tipos del dominio PÚBLICO (F0 0.19, solmi-direct-booking).
// Espejo del backend:
//   - bookingengine/types.ts PublicHotelInfoDTO (32 campos, allow-list estricta)
//   - opiniones/types.ts PublicReviewsResponse (reviews + aggregate + distribution + pagination)
//   - hotel-media: endpoint `/api/public/hotels/:slug/media` (F0 0.8 — controller/rutas vienen
//     en otra pieza; el contrato de respuesta YA está decidido en specs/hotel-media/spec.md).
//
// Estos tipos VIVEN separados de `index.ts` porque son públicos (sin hotelId, sin datos del
// hotelero, sin token interno). Re-exportados desde `@/types` para que el resto del frontend
// siga importando de un solo lugar.

// ─── PublicHotelInfo ───────────────────────────────────
// Espejo EXACTO de backend/src/modules/bookingengine/types.ts PublicHotelInfoDTO.
// NUNCA debe contener: taxId, ownerName, ownerTaxId, deviceEmail, wifiNetwork, wifiPassword,
// internalNotes, bookingEngineUrl, motorVersion, warningPhone, registrationNumber.
// Si se agrega un campo público nuevo en el backend, reflejarlo acá para mantener el contract.
export interface PublicHotelInfo {
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

// ─── Media (GET /api/public/hotels/:slug/media) ────────
// Endpoint futuro (F0 0.8). El backend devolverá media agrupada por type: hero/gallery/rooms.
// Mismo shape que el modelo HotelMedia (`type 'gallery'|'hero'|'room'`, sortOrder, roomId nullable).
export type PublicMediaType = 'gallery' | 'hero' | 'room'

export interface PublicMediaItem {
  id: string
  type: PublicMediaType
  url: string
  alt: string | null
  sortOrder: number
  roomId: string | null
}

export interface PublicRoomMedia {
  roomId: string
  photos: PublicMediaItem[]
}

export interface PublicHotelMedia {
  hero: PublicMediaItem[]
  gallery: PublicMediaItem[]
  rooms: PublicRoomMedia[]
}

// ─── Reviews (GET /api/public/hotels/:slug/reviews) ────
// Espejo de backend/src/modules/opiniones/types.ts PublicReviewsResponse.
// `score` null cuando el hotel tiene publishReviewScore=false;
// `comment` null cuando publishReviewComments=false (el backend lo aplica en el controller).
export type PublicReviewSource =
  | 'all'
  | 'direct'
  | 'google'
  | 'tripadvisor'
  | 'booking'
  | 'airbnb'
  | 'expedia'

export interface PublicReview {
  rating: number
  title: string | null
  comment: string | null
  channel: string
  date: string | null
  authorName: string | null
}

export interface PublicReviewSourceStat {
  score: number
  count: number
}

export interface PublicReviewAggregate {
  score: number | null
  count: number
  perSource: { [channel: string]: PublicReviewSourceStat }
}

/** Distribución de estrellas (siempre 1..5, mismo shape que el backend). */
export interface PublicReviewDistribution {
  '1': number
  '2': number
  '3': number
  '4': number
  '5': number
}

export interface PublicReviewPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PublicReviewsResponse {
  reviews: PublicReview[]
  aggregate: PublicReviewAggregate
  distribution: PublicReviewDistribution
  pagination: PublicReviewPagination
}

/** Query params del endpoint público de reviews. `source`/`lang` validados contra enums
 *  en el backend; acá los dejamos como string para no romper si el backend suma una fuente. */
export interface PublicReviewsQuery {
  page?: number
  limit?: number
  source?: PublicReviewSource | string
  lang?: 'es' | 'en' | 'pt' | string
}
