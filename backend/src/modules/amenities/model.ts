import type { ModelDefinition, ORM } from 'arckode-framework'

export const HotelAmenitiesModel: ModelDefinition = {
  table: 'hotel_amenities',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true },
    amenityKey: { type: 'string', required: true },
    amenityCategory: { type: 'string' },
    isActive: { type: 'number', default: 1 },
  },
  timestamps: true,
}

export const RoomAmenitiesModel: ModelDefinition = {
  table: 'room_amenities',
  fields: {
    id: { type: 'string', required: true },
    roomId: { type: 'string', required: true },
    amenityKey: { type: 'string', required: true },
    isShared: { type: 'number', default: 0 },
    isActive: { type: 'number', default: 1 },
  },
  timestamps: true,
}

export function registerAmenitiesModels(orm: ORM): void {
  orm.define('HotelAmenities', HotelAmenitiesModel)
  orm.define('RoomAmenities', RoomAmenitiesModel)
}
