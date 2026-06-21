export interface ApikeysDTO {
  id: string
  hotelId?: string
  name: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
  createdAt: string
  updatedAt: string
}

export interface CreateApikeysDTO {
  hotelId?: string
  name: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
}

export interface UpdateApikeysDTO {
  // NOTE: hotelId intentionally NOT here — cannot move key between hotels
  name?: string
  scope?: string
  masked?: string
  secretHash?: string
  active?: number
  requests?: number
  lastUsed?: string
}

export interface ApikeysQuery {
  hotelId?: string
  active?: number
  search?: string
  page?: number
  limit?: number
}

export interface ApikeysPaginated {
  data: ApikeysDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
