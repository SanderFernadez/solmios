// housekeeping/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface HousekeepingDTO {
  id: string
  roomId: string
  hotelId: string
  staffId?: string
  type?: string
  priority?: string
  status?: string
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: any
  createdAt: string
  updatedAt: string
}

export interface CreateHousekeepingDTO {
  roomId: string
  hotelId: string
  staffId?: string
  type?: string
  priority?: string
  status?: string
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: any
}

export interface UpdateHousekeepingDTO {
  roomId?: string
  hotelId?: string
  staffId?: string
  type?: string
  priority?: string
  status?: string
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: any
}

// ─── Consultas ─────────────────────────────────────────
export interface HousekeepingQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface HousekeepingPaginated {
  data: HousekeepingDTO[]
  total: number
}
