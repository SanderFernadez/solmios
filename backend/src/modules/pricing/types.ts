export interface SeasonDTO {
  id: string
  hotelId: string
  name: string
  label?: string
  startDate: string
  endDate: string
  color?: string
  sortOrder?: number
}

export interface RoomRateDTO {
  id: string
  hotelId: string
  roomType: string
  occupancy: number
  season: string
  basePrice: number
  percentage: number
  price: number
  closed?: number
}

export interface RoomBlockDTO {
  id: string
  hotelId: string
  roomId: string
  reason?: string
  startDate: string
  endDate: string
  createdBy?: string
}

export interface RateRestrictionDTO {
  id: string
  hotelId: string
  roomType: string
  season: string
  minStay?: number
  maxStay?: number
  cta?: number
  ctd?: number
  closedToArrival?: number
  closedToDeparture?: number
}

export interface ChannelMetricDTO {
  channel: string
  bookings: number
  revenue: number
  adr: number
  revpar: number
  avgStay: string
}

export interface CreateRoomBlockDTO {
  roomIds: string[]
  reason?: string
  startDate: string
  endDate: string
}

export interface UpdateSeasonDTO {
  name?: string
  label?: string
  startDate?: string
  endDate?: string
  color?: string
  sortOrder?: number
}

export interface UpdateRateDTO {
  roomType: string
  season: string
  occupancy: number
  basePrice?: number
  percentage?: number
  closed?: boolean
}
