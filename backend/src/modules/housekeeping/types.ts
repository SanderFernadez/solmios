export type CleaningType = 'full_cleaning' | 'quick_cleaning' | 'deep_cleaning' | 'inspection' | 'maintenance'
export type CleaningPriority = 'low' | 'medium' | 'high' | 'urgent'
export type CleaningStatus = 'pending' | 'in_progress' | 'completed' | 'inspected'

export interface CleaningItem {
  name: string
  done: boolean
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
