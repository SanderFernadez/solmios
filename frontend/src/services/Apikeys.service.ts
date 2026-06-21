import { http } from './http'

export interface ApiKey {
  id?: string
  hotelId?: string
  name: string
  scope?: string
  masked?: string
  /** Solo se devuelve en creación — jamás se reenvía */
  plainKey?: string
  secretHash?: string
  active: boolean | number
  requests?: number
  lastUsed?: string
  createdAt?: string
}

export interface ApiKeyCreate {
  name: string
  hotelId?: string
  scope?: string
}

export const ApikeysService = {
  list: (hotelId?: string) => http.get<{ data: ApiKey[] }>(`/apikeys${hotelId ? `?hotelId=${hotelId}` : ''}`),
  create: (data: ApiKeyCreate) => http.post<ApiKey>('/apikeys', data),
  /** Toggle active/inactive */
  update: (id: string, data: Partial<Pick<ApiKey, 'name' | 'scope' | 'active'>>) =>
    http.put<ApiKey>(`/apikeys/${id}`, data),
  revoke: (id: string) => http.put<ApiKey>(`/apikeys/${id}`, { active: 0 }),
  reactivate: (id: string) => http.put<ApiKey>(`/apikeys/${id}`, { active: 1 }),
  remove: (id: string) => http.delete<{ success: boolean }>(`/apikeys/${id}`),
}
