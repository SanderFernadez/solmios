// mantenimiento/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export interface MantenimientoDTO {
  id: string
  hotelId: string
  roomId?: string
  roomNumber?: string
  title: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
  createdAt: string
  updatedAt: string
}

export interface CreateMantenimientoDTO {
  hotelId: string
  roomId?: string
  roomNumber?: string
  title: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
}

export interface UpdateMantenimientoDTO {
  hotelId?: string
  roomId?: string
  roomNumber?: string
  title?: string
  description?: string
  category?: string
  priority?: string
  status?: string
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface MantenimientoQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface MantenimientoPaginated {
  data: MantenimientoDTO[]
  total: number
}
