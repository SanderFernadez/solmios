export interface AmenityCatalogDTO {
  key: string
  label: string
  category: string
  icon?: string
}

export interface HotelAmenityDTO {
  id: string
  hotelId: string
  amenityKey: string
  amenityCategory?: string
  isActive?: number
}

export interface RoomAmenityDTO {
  id: string
  roomId: string
  amenityKey: string
  isShared?: number
  isActive?: number
}

export interface UpdateHotelAmenitiesDTO {
  amenities: string[]
}

export interface UpdateRoomAmenitiesDTO {
  amenities: string[]
}
