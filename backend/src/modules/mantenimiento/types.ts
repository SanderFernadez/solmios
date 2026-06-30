// mantenimiento/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export type MaintenanceCategory = 'general' | 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'appliance' | 'structural' | 'pest_control' | 'carpentry' | 'painting' | 'electronics'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type MaintenanceStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
export type MaintenancePhotoType = 'before' | 'after' | 'during'

export interface MaintenancePhoto {
  url: string
  type: MaintenancePhotoType
  uploadedBy: string
  uploadedAt: string
}

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
  // Timer
  startTime?: string
  endTime?: string
  // Notas del técnico
  notes?: string
  // Fotos antes/después
  photos?: MaintenancePhoto[]
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

// ─── Consultas y paginación ────────────────────────────
export interface MantenimientoQuery {
  hotelId?: string
  status?: MaintenanceStatus
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  roomId?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface MantenimientoPaginated {
  data: MantenimientoDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Audit Trail ───────────────────────────────────────
export type MaintenanceAuditAction = 'created' | 'status_change' | 'assignment' | 'notes_added' | 'photo_added' | 'priority_change' | 'cost_updated'

export interface MaintenanceAuditDTO {
  id: string
  orderId: string
  hotelId: string
  userId: string
  action: MaintenanceAuditAction
  oldValue: string | null
  newValue: string | null
  timestamp: string
}

export interface CreateMaintenanceAuditDTO {
  orderId: string
  hotelId: string
  userId: string
  action: MaintenanceAuditAction
  oldValue?: string | null
  newValue?: string | null
}
