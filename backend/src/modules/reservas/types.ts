export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
export type ReservationChannel = 'direct' | 'booking' | 'airbnb' | 'expedia' | 'agoda' | 'trip' | 'phone' | 'email' | 'walk_in'
export type PreCheckinStatus = 'pending' | 'sent' | 'completed' | 'expired'

export interface ReservasDTO {
  id: string
  guestId?: string
  roomId: string
  hotelId: string
  checkIn: string
  checkOut: string
  status?: ReservationStatus
  channel?: ReservationChannel
  totalAmount: number
  deposit?: number
  currency?: string
  adults?: number
  children?: number
  notes?: string
  // OTA + payments
  source?: string
  externalLocator?: string
  commission?: number
  commissionAmount?: number
  paymentMethod?: string
  pendingAmount?: number
  autoSendEnabled?: boolean
  preCheckinStatus?: PreCheckinStatus
  preCheckinHash?: string
  groupId?: string
  otaNotes?: string
  checkedInAt?: string
  checkedOutAt?: string
  folioId?: string
  // F3 MisterPlan: condiciones + otros cobros
  gdprAccepted?: boolean
  marketingAccepted?: boolean
  termsAccepted?: boolean
  otherCharges?: number
  createdAt: string
  updatedAt: string
}

export interface CreateReservasDTO {
  guestId?: string
  roomId: string
  hotelId: string
  checkIn: string
  checkOut: string
  status?: ReservationStatus
  channel?: ReservationChannel
  totalAmount: number
  deposit?: number
  depositPercentage?: number
  depositStatus?: string
  currency?: string
  adults?: number
  children?: number
  notes?: string
  ownerNotes?: string
  source?: string
  externalLocator?: string
  commission?: number
  commissionAmount?: number
  paymentMethod?: string
  pendingAmount?: number
  autoSendEnabled?: boolean
  preCheckinStatus?: PreCheckinStatus
  preCheckinHash?: string
  groupId?: string
  otaNotes?: string
  regime?: string
  promoCode?: string
  communicateClient?: string
  // F3 MisterPlan: condiciones + otros cobros
  gdprAccepted?: boolean
  marketingAccepted?: boolean
  termsAccepted?: boolean
  otherCharges?: number
}

export interface UpdateReservasDTO {
  guestId?: string
  roomId?: string
  // NOTE: hotelId intentionally NOT here — cannot move reservation between hotels
  checkIn?: string
  checkOut?: string
  status?: ReservationStatus
  channel?: ReservationChannel
  totalAmount?: number
  deposit?: number
  currency?: string
  adults?: number
  children?: number
  notes?: string
  source?: string
  externalLocator?: string
  commission?: number
  commissionAmount?: number
  paymentMethod?: string
  pendingAmount?: number
  autoSendEnabled?: boolean
  preCheckinStatus?: PreCheckinStatus
  preCheckinHash?: string
  groupId?: string
  otaNotes?: string
  checkedInAt?: string
  checkedOutAt?: string
  folioId?: string
  // F3 MisterPlan: condiciones + otros cobros
  gdprAccepted?: boolean
  marketingAccepted?: boolean
  termsAccepted?: boolean
  otherCharges?: number
}

export interface ReservasQuery {
  hotelId?: string
  status?: ReservationStatus
  channel?: ReservationChannel
  roomId?: string
  guestId?: string
  checkInFrom?: string
  checkInTo?: string
  search?: string
  page?: number
  limit?: number
}

export interface ReservasPaginated {
  data: ReservasDTO[]
  total: number
  page?: number
  limit?: number
  pages?: number
}
