// mantenimiento/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export type MaintenanceCategory = 'general' | 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'structural' | 'pest_control'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface MantenimientoDTO {
  id: string
  hotelId: string
  roomId?: string
  roomNumber?: string
  title: string
  description?: string
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  status?: MaintenanceStatus
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
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  status?: MaintenanceStatus
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
}

export interface UpdateMantenimientoDTO {
  // NOTE: hotelId intentionally NOT here — cannot move ticket between hotels
  roomId?: string
  roomNumber?: string
  title?: string
  description?: string
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  status?: MaintenanceStatus
  assignedTo?: string
  estimatedCost?: number
  reportedDate?: string
  resolvedDate?: string
}

export interface MantenimientoQuery {
  hotelId?: string
  status?: MaintenanceStatus
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  roomId?: string
  search?: string
  page?: number
  limit?: number
}

export interface MantenimientoPaginated {
  data: MantenimientoDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
