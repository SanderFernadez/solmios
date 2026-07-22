export type ReviewChannel = 'direct' | 'booking' | 'airbnb' | 'expedia' | 'google' | 'other'
export type ReviewStatus = 'visible' | 'pending' // pending = invite creado en checkout, esperando respuesta del huésped

export interface OpinionesDTO {
  id: string
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: ReviewChannel
  status?: ReviewStatus
  token?: string
  createdAt: string
  updatedAt: string
}

export interface CreateOpinionesDTO {
  hotelId: string
  guestId?: string
  reservationId?: string
  rating: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: ReviewChannel
}

export interface UpdateOpinionesDTO {
  // NOTE: hotelId intentionally NOT here
  guestId?: string
  reservationId?: string
  rating?: number
  title?: string
  comment?: string
  response?: string
  date?: string
  visible?: number
  channel?: ReviewChannel
}

export interface OpinionesQuery {
  hotelId?: string
  channel?: ReviewChannel
  visible?: number
  minRating?: number
  maxRating?: number
  search?: string
  page?: number
  limit?: number
}

export interface OpinionesPaginated {
  data: OpinionesDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
