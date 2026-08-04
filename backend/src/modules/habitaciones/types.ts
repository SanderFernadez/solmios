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
  // Campos computados, SOLO presentes cuando `GET /api/habitaciones` recibe `checkIn`/`checkOut`
  // (#648). NO persisten en `rooms` — no están en `HabitacionesModel` (model.ts).
  available?: boolean
  unavailableReason?: string
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
  // #648 — disponibilidad por rango de fechas para el selector de habitación del wizard de
  // reservas del staff. Ambos deben venir juntos; si faltan, `list()` se comporta EXACTAMENTE
  // igual que antes (housekeeping, mantenimiento y demás consumidores sin fechas no cambian).
  checkIn?: string
  checkOut?: string
}

export interface HabitacionesPaginated {
  data: HabitacionesDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
