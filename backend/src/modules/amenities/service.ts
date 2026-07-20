import type { RepositoryAdapter, Logger } from 'arckode-framework'
import { hotelIdOfUserLegacy } from '../../shared/usecases/hotel-of-legacy'

export class AmenitiesService {
  constructor(
    private readonly hotelAmenitiesRepo: RepositoryAdapter<any>,
    private readonly roomAmenitiesRepo: RepositoryAdapter<any>,
    private readonly logger: Logger,
    // Para el ownership check del controller (assertRoomInHotel) y el fallback de
    // hotelOf con tokens legacy sin hotelId. El controller ANTES llamaba a
    // `(this.service as any).orm`, que nunca existió: devolvía siempre `[]`,
    // así que listRoom/updateRoom daban 404 en el 100% de los casos, en
    // cualquier hotel. roomsRepo y usersRepo son reales.
    private readonly roomsRepo?: RepositoryAdapter<any>,
    private readonly usersRepo?: RepositoryAdapter<any>,
  ) {}

  /** ¿La habitación pertenece a este hotel? Usa findById, no findMany con id: ownership check real. */
  async roomBelongsToHotel(roomId: string, hotelId: string): Promise<boolean> {
    if (!roomId || !this.roomsRepo) return false
    const room = await this.roomsRepo.findById(roomId).catch(() => null)
    return !!room && (room as any).hotelId === hotelId
  }

  /** Ver shared/usecases/hotel-of-legacy.ts — fallback de hotelOf() con tokens legacy. */
  hotelIdOfUser(userId?: string): Promise<string | undefined> {
    return hotelIdOfUserLegacy(this.usersRepo, userId)
  }

  getStaticCatalog(): Record<string, string[]> {
    return {
      interior: ['ac', 'heating', 'kitchen', 'microwave', 'fridge', 'coffee_maker', 'washer', 'dishwasher', 'tv', 'wifi', 'safe', 'minibar', 'hair_dryer', 'iron', 'balcony', 'bathtub', 'work_desk'],
      exterior: ['pool', 'pool_heated', 'parking_free', 'parking_paid', 'gym', 'spa', 'restaurant', 'bar', 'garden', 'terrace', 'bbq', 'elevator', 'lounge', 'kids_playground'],
      services: ['room_service', 'laundry', 'concierge', 'luggage_storage', 'pets_allowed', 'wheelchair_access'],
    }
  }

  async listHotelAmenities(hotelId: string): Promise<any[]> {
    return await this.hotelAmenitiesRepo.findMany({ hotelId, isActive: 1 }) as any[]
  }

  async updateHotelAmenities(hotelId: string, amenities: string[]): Promise<number> {
    const existing = await this.hotelAmenitiesRepo.findMany({ hotelId }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await this.hotelAmenitiesRepo.update(ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await this.hotelAmenitiesRepo.update(found.id, { isActive: 1 }) } else {
        const cat = key.includes('pool') || key.includes('parking') || key.includes('gym') || key.includes('spa') || key.includes('restaurant') || key.includes('bar') || key.includes('garden') || key.includes('terrace') || key.includes('bbq') || key.includes('kids') ? 'exterior' : key.includes('service') || key.includes('laundry') || key.includes('concierge') || key.includes('pets') || key.includes('wheelchair') ? 'services' : 'interior'
        await this.hotelAmenitiesRepo.create({ id: crypto.randomUUID(), hotelId, amenityKey: key, amenityCategory: cat, isActive: 1 })
      }
    }
    return amenities.length
  }

  async listRoomAmenities(roomId: string): Promise<any[]> {
    return await this.roomAmenitiesRepo.findMany({ roomId, isActive: 1 }) as any[]
  }

  async updateRoomAmenities(roomId: string, amenities: string[]): Promise<number> {
    const existing = await this.roomAmenitiesRepo.findMany({ roomId }) as any[]
    for (const ex of existing) { if (!amenities.includes(ex.amenityKey)) await this.roomAmenitiesRepo.update(ex.id, { isActive: 0 }) }
    for (const key of amenities) {
      const found = existing.find((e: any) => e.amenityKey === key)
      if (found) { await this.roomAmenitiesRepo.update(found.id, { isActive: 1 }) } else { await this.roomAmenitiesRepo.create({ id: crypto.randomUUID(), roomId, amenityKey: key, isShared: 0, isActive: 1 }) }
    }
    return amenities.length
  }
}
