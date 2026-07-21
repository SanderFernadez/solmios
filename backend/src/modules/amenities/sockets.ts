export interface AmenitiesSockets {
  onHotelAmenitiesUpdated?: (hotelId: string, count: number) => Promise<void>
  // Amenities de una habitación reasignadas → el connector amenities-habitaciones sincroniza
  // el CSV vestigial Rooms.amenities (lo leen ai-recepcionista y bookingengine/availability).
  onRoomAmenitiesUpdated?: (roomId: string, amenityKeys: string[]) => Promise<void>
}
