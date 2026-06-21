export type RoomType = 'single' | 'double' | 'twin' | 'triple' | 'quad' | 'suite' | 'deluxe' | 'presidential'
export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'out_of_order' | 'reserved'

export interface HabitacionesDTO {
  id: string
  number: string
  name?: string
  type?: RoomType
  basePrice: number
  status?: RoomStatus
  hotelId: string
  description?: string
  capacity?: number
  floor?: number
  surfaceArea?: number
  bathrooms?: number
  motorPosition?: number
  onlineBookingEnabled?: boolean
  excludeFromReports?: boolean
  descriptionJson?: string
  createdAt: string
  updatedAt: string
}

export interface CreateHabitacionesDTO {
  number: string
  name?: string
  type?: RoomType
  basePrice: number
  status?: RoomStatus
  hotelId: string
  description?: string
  capacity?: number
  floor?: number
  surfaceArea?: number
  bathrooms?: number
  motorPosition?: number
  onlineBookingEnabled?: boolean
  excludeFromReports?: boolean
  descriptionJson?: string
}

export interface UpdateHabitacionesDTO {
  number?: string
  name?: string
  type?: RoomType
  basePrice?: number
  status?: RoomStatus
  description?: string
  capacity?: number
  floor?: number
  surfaceArea?: number
  bathrooms?: number
  motorPosition?: number
  onlineBookingEnabled?: boolean
  excludeFromReports?: boolean
  descriptionJson?: string
  // NOTE: hotelId intentionally NOT here — cannot move room between hotels
}

export interface HabitacionesQuery {
  hotelId?: string
  status?: RoomStatus
  type?: RoomType
  search?: string
  page?: number
  limit?: number
}

export interface HabitacionesPaginated {
  data: HabitacionesDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
