// activos/types.ts — DTOs de activos.

export type AssetCategory = 'uniform' | 'key' | 'equipment' | 'device' | 'other'
export type AssetStatus = 'available' | 'assigned' | 'retired'

export interface ActivosDTO {
  id: string
  hotelId: string
  name: string
  category: AssetCategory | string
  serialNumber: string | null
  status: AssetStatus | string
  assignedTo: string | null
  assignedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateActivosDTO {
  hotelId: string
  name: string
  category?: string
  serialNumber?: string
  notes?: string
}

export interface UpdateActivosDTO {
  name?: string
  category?: string
  serialNumber?: string
  notes?: string
  status?: string
}

export interface ActivosQuery {
  hotelId?: string
  status?: string
  category?: string
  assignedTo?: string
}

export interface ActivosSummary {
  data: ActivosDTO[]
  total: number
}
