export type CleaningType = 'full_cleaning' | 'quick_cleaning' | 'deep_cleaning' | 'inspection' | 'maintenance'
export type CleaningPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CleaningStatus = 'pending' | 'in_progress' | 'completed' | 'inspected'

/** Usuario autenticado derivado del JWT (HotelAuth reinyecta hotelId). */
export type HousekeepingUser = { id: string; role: string; hotelId?: string }

export interface CleaningItem {
  name: string
  done: boolean
}

export interface PhotoEvidence {
  url: string
  path: string
  name: string
  size: number
  mimeType: string
  uploadedAt: string
}

export interface StaffStats {
  staffId: string
  completed: number
  avgDurationMs: number
  totalDurationMs: number
}

export interface StaffStatsQuery {
  hotelId?: string
  from?: string
  to?: string
}

export interface HousekeepingDTO {
  id: string
  roomId: string
  hotelId: string
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
  startTime?: string
  endTime?: string
  /** Pausa del cronómetro: `pausedAt` = pausada desde (null si corre); `pausedSeconds` = acumulado. */
  pausedAt?: string | null
  pausedSeconds?: number
  photos?: PhotoEvidence[]
  supervisorId?: string
  /** Motivo con el que el supervisor/admin DEVOLVIÓ la limpieza (reject). La app lo muestra a la camarera. */
  supervisorNote?: string | null
  supOnSiteTime?: string
  /** Calificación 1–10 que el supervisor le puso a la limpieza al aprobarla. */
  rating?: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateHousekeepingDTO {
  roomId: string
  hotelId: string
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
}

export interface UpdateHousekeepingDTO {
  roomId?: string
  // NOTE: hotelId intentionally NOT here — cannot move task between hotels
  staffId?: string
  type?: CleaningType
  priority?: CleaningPriority
  status?: CleaningStatus
  notes?: string
  assignedDate?: string
  completedDate?: string
  cleaningItems?: CleaningItem[]
  startTime?: string
  endTime?: string
  photos?: PhotoEvidence[]
}

export interface HousekeepingQuery {
  hotelId?: string
  status?: CleaningStatus
  type?: CleaningType
  priority?: CleaningPriority
  roomId?: string
  staffId?: string
  search?: string
  page?: number
  limit?: number
}

export interface HousekeepingPaginated {
  data: HousekeepingDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
