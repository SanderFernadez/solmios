// bookingengine/usecases/analytics.ts — Analytics and tracking use cases

import type { RepositoryAdapter } from 'arckode-framework'
import type { ConversionEventDTO, CreateConversionEventDTO, BookingAnalytics } from '../types'
import { inDateRange } from '../../../shared/usecases/date-range'

export class AnalyticsUseCase {
  constructor(
    private readonly eventsRepo: RepositoryAdapter<ConversionEventDTO>,
  ) {}

  async track(dto: CreateConversionEventDTO): Promise<ConversionEventDTO> {
    return this.eventsRepo.create(dto as any)
  }

  async getAnalytics(hotelId: string, from?: string, to?: string): Promise<BookingAnalytics> {
    // El rango se acota en memoria: el ORM no bindea `{ $gte }` (ver shared/usecases/date-range).
    const all = await this.eventsRepo.findMany({ hotelId })
    const events = inDateRange(all, 'createdAt', from, to)

    const searches = events.filter((e: ConversionEventDTO) => e.event === 'search').length
    const bookings = events.filter((e: ConversionEventDTO) => e.event === 'booking_created').length
    const revenue = events
      .filter((e: ConversionEventDTO) => e.event === 'booking_created')
      .reduce((sum: number, e: ConversionEventDTO) => sum + (e.amount ?? 0), 0)

    return {
      totalSearches: searches,
      totalBookings: bookings,
      conversionRate: searches > 0 ? (bookings / searches) * 100 : 0,
      totalRevenue: revenue,
      averageBookingValue: bookings > 0 ? revenue / bookings : 0,
      topRoomTypes: [],
      dailyTrend: [],
    }
  }
}
