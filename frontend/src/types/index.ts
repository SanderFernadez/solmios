// === HOTEL ===
export interface Hotel {
  id: string
  name: string
  slug: string
  plan: 'essential' | 'starter' | 'professional' | 'enterprise' | 'ultra'
  country: string
  timezone: string
  currency: string
  createdAt: Date
}

// === ROOM ===
export type RoomType = 'single' | 'double' | 'suite' | 'villa' | 'dorm' | 'family'
export type RoomStatus = 'available' | 'occupied' | 'pending' | 'cleaning' | 'out_of_service'

export interface Room {
  id: string
  hotelId: string
  number: string
  name?: string
  type: RoomType
  floor: number
  status: RoomStatus
  amenities: string[]
  maxGuests: number
  basePrice: number
  surfaceArea?: number
  bathrooms?: number
  onlineBookingEnabled?: boolean
}

// === GUEST ===
export interface Guest {
  id: string
  hotelId: string
  firstName: string
  lastName: string
  name?: string
  email?: string
  phone?: string
  documentType: string
  documentNumber: string
  nationality: string
  language?: string
  country?: string
  sex?: 'male' | 'female' | 'non_binary' | 'other'
  dateOfBirth?: string
  address?: string
  city?: string
  province?: string
  documentIssueDate?: string
  observations?: string
  communicateClient?: 'none' | 'email_confirmation' | 'email_presaless'
  totalStays: number
  totalSpent: number
  loyaltyPoints: number
}

export interface EmergencyContact {
  name: string
  phone: string
  relation: string
  email?: string
}

// === CREDIT CARD ( reservation form only ) ===
export interface CreditCardInfo {
  holderName: string
  brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other'
  number: string
  cvv: string
  expMonth: string
  expYear: string
}

// === RESERVATION ===
export type ReservationStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type ReservationSource = 'direct' | 'phone' | 'whatsapp' | 'booking' | 'expedia' | 'agoda' | 'airbnb' | 'google' | 'other'

export interface Reservation {
  id: string
  hotelId: string
  guestId: string
  guest?: Guest
  roomId: string
  room?: Room
  checkIn: Date
  checkOut: Date
  adults: number
  children: number
  status: ReservationStatus
  source: ReservationSource
  channelReservationId?: string
  notes?: string
  ownerNotes?: string
  totalAmount: number
  depositAmount: number
  depositPercentage?: number
  depositStatus?: 'unpaid' | 'partial' | 'paid'
  paymentMethod?: string
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded'
  promoCode?: string
  regime?: string
  createdAt: Date
  roomNumber?: string
  roomType?: string
  guestName?: string
  guestEmail?: string
  emergencyContact?: EmergencyContact
  creditCard?: CreditCardInfo
}

// === FOLIO ===
export interface FolioItem {
  id: string
  description: string
  amount: number
  type: 'room' | 'service' | 'minibar' | 'tax' | 'discount'
  createdAt: Date
}

export interface RoomFolio {
  id: string
  reservationId: string
  items: FolioItem[]
  total: number
}

// === PAYMENT ===
export type PaymentMethod = 'card' | 'transfer' | 'cash' | 'link' | 'deposit'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export interface Payment {
  id: string
  hotelId: string
  reservationId?: string
  guestId: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  cardLast4?: string
  cardBrand?: string
  createdAt: Date
}

// === EMPLOYEE ===
export type Department = 'reception' | 'housekeeping' | 'maintenance' | 'accounting' | 'management' | 'kitchen' | 'bar'

export interface Employee {
  id: string
  hotelId: string
  firstName: string
  lastName: string
  position: string
  department: Department
  email: string
  phone: string
  hireDate: Date
  status: 'active' | 'inactive'
  salary: number
}

// === DASHBOARD ===
export interface DashboardStats {
  occupancy: number
  arrivalsToday: number
  departuresToday: number
  pendingClean: number
  openIncidents: number
  revenueToday: number
  revenueMTD: number
  avgRate: number
  revpar: number
}

// === USER ===
export type UserRole = 'super_admin' | 'hotel_admin' | 'receptionist'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  hotelId: string
  hotelName: string
  phone?: string
  avatar?: string
  plan?: string
  rooms?: number
  permissions?: string[]
}
