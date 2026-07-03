export interface DashboardDTO {
  ocupacion: number
  revenue: number
  revenueToday: number
  totalRooms: number
  occupied: number
  checkins: number
  checkouts: number
  huespedes: number
  reservas: number
  dirty: number
  maintenance: number
  roomsByType: Record<string, number>
  roomsByStatus: Record<string, number>
  trends: {
    ocupacion: { value: number; direction: 'up' | 'down' | 'stable' }
    revenue: { value: number; direction: 'up' | 'down' | 'stable' }
  }
}

export interface PlanningRoomDTO {
  id: string
  number?: string
  type?: string
  status?: string
  floor?: string
}

export interface PlanningReservationDTO {
  id: string
  guestId: string
  roomId: string
  checkIn: string
  checkOut: string
  status: string
  totalAmount?: number
  guestName?: string
  guestEmail?: string
  roomNumber?: string
  paymentStatus?: string
}

export interface PlanningDTO {
  rooms: PlanningRoomDTO[]
  reservas: PlanningReservationDTO[]
}

export interface CheckinItemDTO {
  id: string
  guestId: string
  roomId: string
  checkIn: string
  checkOut: string
  status: string
  totalAmount?: number
  guestName?: string
  guestEmail?: string
  roomNumber?: string
}

export interface CheckinListDTO {
  checkins: CheckinItemDTO[]
  checkouts: CheckinItemDTO[]
  pendingCheckins: number
  todayCheckouts: number
}
