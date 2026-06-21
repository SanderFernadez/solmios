// habitaciones/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface HabitacionesDTO {
  id: string
  number: string
  name?: string
  type?: string
  basePrice: number
  status?: string
  hotelId: string
  description?: string
  capacity?: number
  amenities?: any
  floor?: number
  createdAt: string
  updatedAt: string
}

export interface CreateHabitacionesDTO {
  number: string
  name?: string
  type?: string
  basePrice: number
  status?: string
  hotelId: string
  description?: string
  capacity?: number
  amenities?: any
  floor?: number
}

export interface UpdateHabitacionesDTO {
  number?: string
  name?: string
  type?: string
  basePrice?: number
  status?: string
  hotelId?: string
  description?: string
  capacity?: number
  amenities?: any
  floor?: number
}

// ─── Consultas ─────────────────────────────────────────
export interface HabitacionesQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface HabitacionesPaginated {
  data: HabitacionesDTO[]
  total: number
}
