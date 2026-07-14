export interface TTLockConfigDTO {
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  region?: string
  accountId?: string
  accessToken?: string
  refreshToken?: string
  /** Entrega del PIN a la cerradura: 1 bluetooth · 2 gateway · 3 NB-IoT */
  addType?: number
  configured?: boolean
  connected?: boolean
  /** El secret/password nunca se devuelven; estos flags dicen si están guardados. */
  hasSecret?: boolean
  hasPassword?: boolean
}

export interface LockDeviceDTO {
  id: string
  hotelId: string
  ttlockLockId: string
  name: string
  roomId: string
  mac: string
  batteryLevel: number
  status: string
}

export interface LockCodeDTO {
  id: string
  lockId: string
  hotelId: string
  reservationId: string
  code: string
  codeType: string
  startDate: string
  endDate: string
  status: string
  ttlockKeyboardPwdId: string
  sentVia: string
}

export interface UpdateLockDeviceDTO {
  roomId?: string
  name?: string
}

export interface TTLockConnectDTO {
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  region?: string
}
