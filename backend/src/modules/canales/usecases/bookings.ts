// canales/usecases/bookings.ts — Bookings: lectura del feed de Channex (solo-lectura).
// La ingesta + ack migró al usecase global booking-sync.ts (cron #564, issue #564).
import { ChannexUseCase } from './channex'
import type { BookingRevisionDTO } from '../types'

export class BookingsUseCase {
  constructor(private readonly channex: ChannexUseCase) {}

  async getBookings(cfg: any): Promise<BookingRevisionDTO[]> {
    const key = cfg?.channexApiKey || process.env.CHANNEX_API_KEY || ''
    return this.channex.fetchBookingFeed(key)
  }
}
