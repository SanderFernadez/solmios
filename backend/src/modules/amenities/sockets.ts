export interface AmenitiesSockets {
  onHotelAmenitiesUpdated?: (hotelId: string, count: number) => Promise<void>
  onRoomAmenitiesUpdated?: (roomId: string, count: number) => Promise<void>
}
