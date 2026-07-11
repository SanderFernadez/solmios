// services/Assets.service.ts — Inventario de activos y su asignación a empleados.
import { http } from './http'

export type AssetCategory = 'uniform' | 'key' | 'equipment' | 'device' | 'other'
export type AssetStatus = 'available' | 'assigned' | 'retired'

export interface Asset {
  id: string
  hotelId: string
  name: string
  category: AssetCategory | string
  serialNumber: string | null
  status: AssetStatus | string
  assignedTo: string | null
  assignedAt: string | null
  notes: string | null
}

export const AssetsService = {
  async list(status?: string): Promise<Asset[]> {
    const qs = status ? `?status=${status}` : ''
    const res = await http.get<{ data: Asset[]; total: number }>(`/api/assets${qs}`)
    return res.data ?? []
  },
  create: (data: { name: string; category?: string; serialNumber?: string; notes?: string }): Promise<Asset> => http.post('/api/assets', data),
  update: (id: string, data: Partial<Asset>): Promise<Asset> => http.put(`/api/assets/${id}`, data),
  remove: (id: string): Promise<void> => http.delete(`/api/assets/${id}`),
  assign: (id: string, employeeId: string): Promise<Asset> => http.post(`/api/assets/${id}/assign`, { employeeId }),
  returnAsset: (id: string): Promise<Asset> => http.post(`/api/assets/${id}/return`),
}

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  uniform: 'Uniforme', key: 'Llave', equipment: 'Equipo', device: 'Dispositivo', other: 'Otro',
}
export const ASSET_STATUS_LABELS: Record<string, string> = {
  available: 'Disponible', assigned: 'Asignado', retired: 'Retirado',
}
