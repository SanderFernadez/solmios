// bookingengine/usecases/availability.ts — Availability checking use cases

import type { RepositoryAdapter, CacheAdapter } from 'arckode-framework'
import { ValidationError } from 'arckode-framework'
import type { AvailabilityQuery, AvailabilityResult, RoomTypeAvailability } from '../types'

export class AvailabilityUseCase {
  constructor(
    private readonly availabilityRepo: RepositoryAdapter<any>,
    private readonly cache: CacheAdapter,
  ) {}

  async check(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const nights = this.calculateNights(query.checkIn, query.checkOut)
    if (nights <= 0) throw new ValidationError('checkOut must be after checkIn')

    const cacheKey = `availability:${query.hotelId}:${query.checkIn}:${query.checkOut}`
    const cached = await this.cache.get<AvailabilityResult>(cacheKey)
    if (cached) return cached

    const today = new Date().toISOString().split('T')[0]
    const items = await this.availabilityRepo.findMany({
      hotelId: query.hotelId,
      date: { $gte: query.checkIn, $lte: today },
    })

    const roomTypes = this.aggregateAvailability(items, query.adults ?? 2)
    const result: AvailabilityResult = {
      hotelId: query.hotelId,
      hotelName: '',
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      nights,
      roomTypes,
    }

    await this.cache.set(cacheKey, result, 300)
    return result
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const a = new Date(checkIn)
    const b = new Date(checkOut)
    return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  }

  private aggregateAvailability(items: any[], adults: number): RoomTypeAvailability[] {
    const grouped: Record<string, { total: number; occupied: number; blocked: number; price: number }> = {}
    for (const item of items) {
      if (!grouped[item.roomType]) {
        grouped[item.roomType] = { total: 0, occupied: 0, blocked: 0, price: 0 }
      }
      grouped[item.roomType].total += item.totalRooms ?? 0
      grouped[item.roomType].occupied += item.occupied ?? 0
      grouped[item.roomType].blocked += item.blocked ?? 0
      grouped[item.roomType].price = item.price ?? grouped[item.roomType].price
    }

    return Object.entries(grouped).map(([roomType, data]) => ({
      roomType,
      available: Math.max(0, data.total - data.occupied - data.blocked),
      price: data.price,
      currency: 'USD',
      capacity: adults,
      amenities: [],
    }))
  }
}
