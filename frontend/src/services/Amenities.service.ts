import { http } from './http'

export interface AmenityCatalog {
  interior: string[]
  exterior: string[]
  services: string[]
}

export interface AmenityCatalogItem {
  id: string
  key: string
  label: string
  category: string
  icon?: string
}

export const AmenitiesService = {
  catalog: () => http.get<AmenityCatalog>('/amenities/catalog'),
  listHotel: () => http.get<{ data: { amenityKey: string; amenityCategory: string }[] }>('/amenities/hotel'),
  listHotelKeys: async () => (await AmenitiesService.listHotel()).data.map(a => a.amenityKey),
  saveHotel: (amenities: string[]) => http.put<{ success: boolean; count: number }>('/amenities/hotel', { amenities }),
  listRoom: (roomId: string) => http.get<{ data: { amenityKey: string }[] }>(`/amenities/room/${roomId}`),
  saveRoom: (roomId: string, amenities: string[]) => http.put<{ success: boolean; count: number }>(`/amenities/room/${roomId}`, { amenities }),
  // Catálogo maestro — super-admin CRUD (/admin/amenities/catalog)
  adminListCatalog: () => http.get<{ data: AmenityCatalogItem[] }>('/admin/amenities/catalog'),
  adminCreateCatalogItem: (item: Partial<AmenityCatalogItem>) => http.post<{ success: boolean }>('/admin/amenities/catalog', item),
  adminUpdateCatalogItem: (id: string, item: Partial<AmenityCatalogItem>) => http.put<{ success: boolean }>(`/admin/amenities/catalog/${id}`, item),
  adminDeleteCatalogItem: (id: string) => http.delete<{ success: boolean }>(`/admin/amenities/catalog/${id}`),
}
