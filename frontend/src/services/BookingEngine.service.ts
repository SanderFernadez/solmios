// services/BookingEngine.service.ts — API client for booking engine
import { http } from './http'

export interface BookingConfig {
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
}

export interface BookingAnalytics {
  totalSearches: number
  totalBookings: number
  conversionRate: number
  totalRevenue: number
  averageBookingValue: number
}

export const BookingEngineService = {
  async getConfig(): Promise<BookingConfig> {
    return http.get('/booking-engine/config')
  },

  async updateConfig(config: Partial<BookingConfig>): Promise<BookingConfig> {
    return http.put('/booking-engine/config', config)
  },

  async getAnalytics(from?: string, to?: string): Promise<BookingAnalytics> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return http.get(`/booking-engine/analytics?${params.toString()}`)
  },
}
