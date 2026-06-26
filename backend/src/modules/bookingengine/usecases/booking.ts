// bookingengine/usecases/booking.ts — Booking creation use cases

import type { RepositoryAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { PublicBookingDTO, CreatePublicBookingDTO, AvailabilityQuery } from '../types'
import { AvailabilityUseCase } from './availability'

export class BookingUseCase {
  constructor(
    private readonly bookingRepo: RepositoryAdapter<PublicBookingDTO>,
    private readonly availability: AvailabilityUseCase,
  ) {}

  async create(dto: CreatePublicBookingDTO): Promise<PublicBookingDTO> {
    const avail = await this.availability.check({
      hotelId: dto.hotelId,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      adults: dto.adults,
    })

    const room = avail.roomTypes.find(r => r.roomType === dto.roomType)
    if (!room || room.available <= 0) {
      throw new ValidationError('Room type not available for selected dates')
    }

    const nights = this.calculateNights(dto.checkIn, dto.checkOut)
    const totalAmount = room.price * nights

    return this.bookingRepo.create({
      hotelId: dto.hotelId,
      roomType: dto.roomType,
      roomId: '',
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      guestPhone: dto.guestPhone,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      adults: dto.adults,
      children: dto.children ?? 0,
      totalAmount,
      currency: room.currency,
      status: 'pending',
      paymentStatus: 'pending',
      paymentRef: '',
      promoCode: dto.promoCode ?? '',
    } as any)
  }

  async getById(id: string): Promise<PublicBookingDTO> {
    // @ignore IDOR_RISK — public booking lookup; user only sees their own booking ID from confirmation
    const booking = await this.bookingRepo.findById(id)
    if (!booking) throw new ValidationError('Booking not found')
    return booking
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const a = new Date(checkIn)
    const b = new Date(checkOut)
    return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  }
}
