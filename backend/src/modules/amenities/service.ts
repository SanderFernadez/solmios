import type { Logger } from 'arckode-framework'

export class AmenitiesService {
  constructor(
    private readonly orm: any,
    private readonly logger: Logger,
  ) {}

  getStaticCatalog(): Record<string, string[]> {
    return {
      interior: ['ac', 'heating', 'kitchen', 'microwave', 'fridge', 'coffee_maker', 'washer', 'dishwasher', 'tv', 'wifi', 'safe', 'minibar', 'hair_dryer', 'iron', 'balcony', 'bathtub', 'work_desk'],
      exterior: ['pool', 'pool_heated', 'parking_free', 'parking_paid', 'gym', 'spa', 'restaurant', 'bar', 'garden', 'terrace', 'bbq', 'elevator', 'lounge', 'kids_playground'],
      services: ['room_service', 'laundry', 'concierge', 'luggage_storage', 'pets_allowed', 'wheelchair_access'],
    }
  }

  async listHotelAmenities(hotelId: string): Promise<any[]> {
    return await this.orm.findMany('HotelAmenities', { hotelId, isActive: 1 }) as any[]
  }

  async updateHotelAmenities(hotelId: string, amenities: string[]): Promise<number> {
    const existing = await this.orm.findMany('HotelAmenities', { hotelId }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await this.orm.update('HotelAmenities', ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await this.orm.update('HotelAmenities', found.id, { isActive: 1 }) } else {
        const cat = key.includes('pool') || key.includes('parking') || key.includes('gym') || key.includes('spa') || key.includes('restaurant') || key.includes('bar') || key.includes('garden') || key.includes('terrace') || key.includes('bbq') || key.includes('kids') ? 'exterior' : key.includes('service') || key.includes('laundry') || key.includes('concierge') || key.includes('pets') || key.includes('wheelchair') ? 'services' : 'interior'
        await this.orm.create('HotelAmenities', { id: crypto.randomUUID(), hotelId, amenityKey: key, amenityCategory: cat, isActive: 1 })
      }
    }
    return amenities.length
  }

  async listRoomAmenities(roomId: string): Promise<any[]> {
    return await this.orm.findMany('RoomAmenities', { roomId, isActive: 1 }) as any[]
  }

  async updateRoomAmenities(roomId: string, amenities: string[]): Promise<number> {
    const existing = await this.orm.findMany('RoomAmenities', { roomId }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await this.orm.update('RoomAmenities', ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await this.orm.update('RoomAmenities', found.id, { isActive: 1 }) } else { await this.orm.create('RoomAmenities', { id: crypto.randomUUID(), roomId, amenityKey: key, isShared: 0, isActive: 1 }) }
    }
    return amenities.length
  }
}
