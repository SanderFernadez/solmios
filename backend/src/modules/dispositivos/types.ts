export interface DispositivosDTO {
  id: string
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
  createdAt: string
  updatedAt: string
}

export interface CreateDispositivosDTO {
  hotelId?: string
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
}

export interface UpdateDispositivosDTO {
  // NOTE: hotelId intentionally NOT here
  userId?: string
  userName?: string
  device?: string
  icon?: string
  browser?: string
  os?: string
  ip?: string
  isMobile?: number
  lastActivity?: string
}

export interface DispositivosQuery {
  hotelId?: string
  userId?: string
  device?: string
  search?: string
  page?: number
  limit?: number
}

export interface DispositivosPaginated {
  data: DispositivosDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
