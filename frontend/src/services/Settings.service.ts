import { http } from './http'
import type { RoomRate } from './Rates.service'
import type { Season } from './Seasons.service'
import type { AutoMessage } from './AutoMessages.service'

export interface HotelFull {
  id: string
  name: string
  country?: string
  address?: string
  phone?: string
  phone2?: string
  warningPhone?: string
  email?: string
  timezone?: string
  currency?: string
  secondaryCurrency?: string
  checkIn?: string
  checkOut?: string
  plan?: string
  status?: string
  logo?: string
  website?: string
  bookingEngineUrl?: string
  youtubeUrl?: string
  starRating?: number | string
  onlineBookingStatus?: string
  motorVersion?: string
  // Propietario
  ownerName?: string
  ownerTaxId?: string
  deviceEmail?: string
  // Alojamiento
  accommodationType?: string
  registrationNumber?: string
  // Localización
  latitude?: number | string
  longitude?: number | string
  province?: string
  municipality?: string
  locality?: string
  postalCode?: string
  // Condiciones
  cleaningType?: string
  depositType?: string
  depositFixed?: number
  advanceType?: string
  advanceAmount?: number
  releaseHours?: number
  defaultPaymentMethod?: string
  freeCancellation?: string
  depositRequired?: boolean
  depositPercent?: number
  weekendSurcharge?: number
  // Reseñas
  requestReviews?: boolean
  publishReviewScore?: boolean
  publishReviewComments?: boolean
  // Impuestos
  taxName?: string
  taxRate?: number
  // Multilingüe + WiFi
  descriptionJson?: Record<string, string>
  wifiNetwork?: string
  wifiPassword?: string
}

export interface SettingsFull {
  hotel: HotelFull
  amenities: string[]
  seasons: Season[]
  rates: RoomRate[]
  blocks: any[]
  autoMessages: AutoMessage[]
  roomTypes: string[]
  ttlock: { clientId?: string; clientSecret?: string; accountId?: string; accessToken?: string; configured: boolean }
}

export interface HotelPatch {
  [key: string]: unknown
}

const HOTEL_ALLOWED_FIELDS = [
  'name','country','address','phone','email','timezone','currency','checkIn','checkOut','plan',
  'freeCancellation','depositRequired','depositPercent','weekendSurcharge',
  'ownerName','ownerTaxId','deviceEmail','accommodationType','registrationNumber','website',
  'bookingEngineUrl','phone2','warningPhone','secondaryCurrency','youtubeUrl','starRating',
  'onlineBookingStatus','motorVersion','latitude','longitude','province','municipality',
  'locality','postalCode','cleaningType','depositType','depositFixed','advanceType','advanceAmount',
  'releaseHours','defaultPaymentMethod','requestReviews','publishReviewScore','publishReviewComments',
  'taxName','taxRate','descriptionJson','wifiNetwork','wifiPassword',
] as const

export const SettingsService = {
  full: () => http.get<SettingsFull>('/settings/full'),
  get: () => http.get<{ hotel: HotelFull; baseRates: { type: string; price: number }[] }>('/settings'),
  patchHotel: (patch: HotelPatch) => {
    const safe: HotelPatch = {}
    for (const k of HOTEL_ALLOWED_FIELDS) if (patch[k] !== undefined) safe[k] = patch[k]
    return http.put<HotelFull>('/settings/hotel', { ...safe, id: undefined })
  },
}
