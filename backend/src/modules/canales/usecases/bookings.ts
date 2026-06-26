// canales/usecases/bookings.ts — Bookings ingestion from Channex
import type { ORM } from 'arckode-framework'
import { ChannexUseCase } from './channex'
import { applyBookingRevision } from './booking-ingestion'
import type { BookingRevisionDTO, BookingIngestionResult } from '../types'

export class BookingsUseCase {
  constructor(
    private readonly channex: ChannexUseCase,
    private readonly orm: ORM,
  ) {}

  async getBookings(cfg: any): Promise<BookingRevisionDTO[]> {
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    return this.channex.fetchBookingFeed(key)
  }

  async ingestBookings(hotelId: string, cfg: any): Promise<BookingIngestionResult> {
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    return this.channex.ingestBookings(cfg, async (dto: any) => {
      await applyBookingRevision({ orm: this.orm, channex: this.channex, hotelId, apiKey: key }, dto)
    })
  }
}
