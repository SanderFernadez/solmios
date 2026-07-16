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

export interface LockGateway {
  gatewayId: number
  gatewayName?: string
  gatewayMac?: string
  networkName?: string
  isOnline?: number
  lockNum?: number
}

export interface LockActiveCode {
  keyboardPwdId: number
  keyboardPwd?: string
  keyboardPwdName?: string
  /** 1 permanente · 2 temporal · 3 período · 4 borrado (Sciener). */
  keyboardPwdType?: number
  startDate?: number
  endDate?: number
  status?: number
}

export interface LockRecord {
  recordId: number
  /** Código del evento de Sciener (4 = apertura con código, 1 = app, etc.). */
  recordType?: number
  /** 1 = OK · 0 = falló. */
  success?: number
  keyboardPwd?: string
  keyName?: string
  username?: string
  lockDate?: number
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
  /** Gateways de la cuenta TTLock del hotel. */
  listGateways: () => http.get<{ data: LockGateway[] }>('/ttlock/gateways'),
  /** Códigos REALES vivos en el hardware de una cerradura (lockId = id de lock_devices). */
  listActiveCodes: (lockId: string) => http.get<{ data: LockActiveCode[] }>(`/ttlock/locks/${lockId}/active-codes`),
  /** Historial de actividad (aperturas/intentos) de una cerradura (últimos 30 días). */
  listLockRecords: (lockId: string) => http.get<{ data: LockRecord[] }>(`/ttlock/locks/${lockId}/records`),
  /** Abre la puerta en remoto por el gateway. */
  unlockLock: (lockId: string) => http.post<{ success: boolean }>(`/ttlock/locks/${lockId}/unlock`),
  /** Borra un PIN directo del hardware (keyboardPwdId de la cerradura). */
  deletePasscode: (lockId: string, pwdId: string | number) => http.delete<{ success: boolean }>(`/ttlock/locks/${lockId}/passcodes/${pwdId}`),
}
