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
  username?: string
  password?: string
  region?: string
  accountId?: string
  accessToken?: string
  /** Entrega del PIN a la cerradura: 1 bluetooth · 2 gateway · 3 NB-IoT */
  addType?: number
  configured: boolean
  connected?: boolean
  /** El backend nunca devuelve el secret/password; estos flags dicen si ya están guardados. */
  hasSecret?: boolean
  hasPassword?: boolean
}

export const TTLockService = {
  getConfig: () => http.get<TTLockConfig>('/ttlock/config'),
  saveConfig: (config: Partial<TTLockConfig>) => http.put<{ success: boolean }>('/ttlock/config', config),
  /** OAuth2 Resource Owner Password: valida usuario+password contra TTLock y guarda el access_token. */
  connect: (data: { username?: string; password?: string; clientId?: string; clientSecret?: string; region?: string }) =>
    http.post<{ success: boolean; connected: boolean }>('/ttlock/connect', data),
  listLocks: () => http.get<{ data: LockDevice[] }>('/ttlock/locks'),
  listCodes: () => http.get<{ data: LockCode[] }>('/ttlock/codes'),
  sync: () => http.post<{ success: boolean; synced: number; message?: string }>('/ttlock/sync'),
  updateLock: (id: string, patch: { roomId?: string; name?: string }) =>
    http.put<LockDevice>(`/ttlock/lock/${id}`, patch),
  generateCode: (reservationId: string) => http.post<LockCode>(`/ttlock/generate-code/${reservationId}`),
  revokeCode: (id: string) => http.delete<{ success: boolean }>(`/ttlock/code/${id}`),
}
