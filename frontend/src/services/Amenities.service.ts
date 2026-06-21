import { http } from './http'

export interface AmenityCatalog {
  interior: string[]
  exterior: string[]
  services: string[]
}

export const AmenitiesService = {
  catalog: () => http.get<AmenityCatalog>('/amenities/catalog'),
  listHotel: () => http.get<{ data: { amenityKey: string; amenityCategory: string }[] }>('/amenities/hotel'),
  listHotelKeys: async () => (await AmenitiesService.listHotel()).data.map(a => a.amenityKey),
  saveHotel: (amenities: string[]) => http.put<{ success: boolean; count: number }>('/amenities/hotel', { amenities }),
  listRoom: (roomId: string) => http.get<{ data: { amenityKey: string }[] }>(`/amenities/room/${roomId}`),
  saveRoom: (roomId: string, amenities: string[]) => http.put<{ success: boolean; count: number }>(`/amenities/room/${roomId}`, { amenities }),
}
