// canales/usecases/bookings.ts — Bookings ingestion from Channex
import { ChannexUseCase } from './channex'
import type { BookingRevisionDTO, BookingIngestionResult } from '../types'
import type { CanalesQueries } from './canales-queries'

export class BookingsUseCase {
  constructor(
    private readonly channex: ChannexUseCase,
    private readonly queries: CanalesQueries,
  ) {}

  async getBookings(cfg: any): Promise<BookingRevisionDTO[]> {
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    return this.channex.fetchBookingFeed(key)
  }

  async ingestBookings(hotelId: string, cfg: any): Promise<BookingIngestionResult> {
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    return this.channex.ingestBookings(cfg, async (dto: any) => {
      await this.queries.applyBookingRevision(dto, hotelId, this.channex, key)
    })
  }
}
