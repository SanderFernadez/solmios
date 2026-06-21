import { http } from './http'

export interface LockDevice {
  id?: string
  hotelId?: string
  roomId?: string
  ttlockLockId?: string
  name?: string
  mac?: string
  batteryLevel?: number
  status?: string
  roomNumber?: string
}

export interface LockCode {
  id?: string
  lockId: string
  reservationId: string
  code: string
  codeType?: string
  startDate: string
  endDate: string
  status: 'pending' | 'active' | 'revoked' | 'expired'
  sentVia?: string
  sentAt?: string
}

export interface TTLockConfig {
  clientId?: string
  clientSecret?: string
  accountId?: string
  accessToken?: string
  configured: boolean
}

export const TTLockService = {
  getConfig: () => http.get<TTLockConfig>('/ttlock/config'),
  saveConfig: (config: Partial<TTLockConfig>) => http.put<{ success: boolean }>('/ttlock/config', config),
  listLocks: () => http.get<{ data: LockDevice[] }>('/ttlock/locks'),
  sync: () => http.post<{ success: boolean; synced: number; message?: string }>('/ttlock/sync'),
  updateLock: (id: string, patch: { roomId?: string; name?: string }) =>
    http.put<LockDevice>(`/ttlock/lock/${id}`, patch),
  generateCode: (reservationId: string) => http.post<LockCode>(`/ttlock/generate-code/${reservationId}`),
  revokeCode: (id: string) => http.delete<{ success: boolean }>(`/ttlock/code/${id}`),
}
