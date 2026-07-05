export interface TTLockConfigDTO {
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  region?: string
  accountId?: string
  accessToken?: string
  refreshToken?: string
  configured?: boolean
  connected?: boolean
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
