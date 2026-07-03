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
export type RoomStatus = 'available' | 'occupied' | 'pending' | 'cleaning' | 'dirty' | 'out_of_service'

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
// Naming canónico = modelo DB `guests` (backend huespedes/model.ts). Sin dobles.
export interface Guest {
  id: string
  hotelId: string
  name: string
  email?: string
  phone?: string
  documentType?: string
  document?: string
  nationality: string
  language?: string
  country?: string
  sex?: 'male' | 'female' | 'non_binary' | 'other'
  address?: string
  city?: string
  province?: string
  documentIssueDate?: string
  communicateClient?: 'none' | 'email_confirmation' | 'email_presaless'
  totalStays: number
  totalSpent: number
  loyaltyPoints: number
  birthDate?: string
  preferences?: string[]
  notes?: string
  tier?: string
  profession?: string
  emergencyContact?: EmergencyContact
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

// === RESERVATION DETAIL (GET /reservations/:id — composition-root.ts:1202) ===
// Sub-tipos que reflejan EXACTAMENTE el response del backend (guest usa `name`/`document`,
// no firstName/lastName; room usa number/type/basePrice).
export interface ReservationDetailGuest {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  document?: string | null
  nationality?: string | null
  language?: string | null
  birthDate?: string | null
  loyaltyPoints?: number
  totalStays?: number
  totalSpent?: number
  tier?: string
}

export interface ReservationDetailRoom {
  id: string
  number: string
  name?: string | null
  type: string
  basePrice: number
  capacity?: number
  floor?: number | null
}

export interface ReservationDetailCompanion {
  id: string
  name: string
  documentType?: string | null
  documentNumber?: string | null
  nationality?: string | null
  birthDate?: string | null
  isMainGuest?: boolean
}

export interface ReservationDetailLockCode {
  code?: string | null
  status?: string
  startDate?: string | null
  endDate?: string | null
}

export interface ReservationDetailPayment {
  amount?: number
  currency?: string
  status?: string
  stripePaymentUrl?: string | null
  sentVia?: string
  paidAt?: string | null
}

export interface ReservationDetailMessageLog {
  messageType?: string
  status?: string
  recipient?: string | null
  response?: string | null
  sentAt?: string | null
}

export interface ReservationDetailAddon {
  id: string
  description: string
  kind?: 'service' | 'discount'
  amount?: number
  quantity?: number
}

export interface CurrencyConfig {
  secondaryCurrency?: string
  exchangeRate?: number
}

export interface GuaranteeCardData {
  cardHolder: string
  cardBrand: string
  cardLast4: string
  cardExpMonth: string
  cardExpYear: string
}

// === AUDIT LOG (historial de cambios de una reserva) ===
export interface AuditLogEntry {
  id: string
  action: string
  performedBy?: string | null
  details?: string | null
  createdAt?: string
}

export interface ReservationDetail {
  id: string
  hotelId: string
  guestId: string | null
  roomId: string
  checkIn: string
  checkOut: string
  status: string
  channel?: string
  source?: string
  externalLocator?: string | null
  totalAmount: number
  deposit?: number
  pendingAmount?: number
  currency?: string
  commission?: number
  commissionAmount?: number
  paymentMethod?: string | null
  depositPercentage?: number
  depositStatus?: string
  regime?: string
  notes?: string | null
  otaNotes?: string | null
  ownerNotes?: string | null
  promoCode?: string | null
  autoSendEnabled?: boolean
  communicateClient?: string
  adults?: number
  children?: number
  createdAt?: string
  checkedInAt?: string | null
  checkedOutAt?: string | null
  // F3 MisterPlan: condiciones + otros cobros + código de check-in digital
  gdprAccepted?: boolean
  marketingAccepted?: boolean
  termsAccepted?: boolean
  otherCharges?: number
  checkinCode?: string
  // Tarjeta de garantía (MisterPlan): bandera; los datos se revelan vía unlock con PIN.
  hasGuaranteeCard?: boolean
  guest?: ReservationDetailGuest | null
  room?: ReservationDetailRoom | null
  companions?: ReservationDetailCompanion[]
  lockCodes?: ReservationDetailLockCode[]
  payments?: ReservationDetailPayment[]
  messageLogs?: ReservationDetailMessageLog[]
  addons?: ReservationDetailAddon[]
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

// === CHECKIN ===
export interface CheckinRoom {
  id: string
  number: string
  type: string
  status: RoomStatus
  basePrice: number
  floor: number
  capacity: number
  bathrooms: number
  surfaceArea: number
  guestName: string | null
  channel: string | null
  checkIn: string | null
  checkOut: string | null
  checkDates: string
  guestEmail: string | null
  resId: string | null
}

export interface CheckinGuest {
  id: string
  guestName: string
  guestEmail: string
  initials: string
  roomNumber: string
  roomId: string
  checkIn: string
  checkOut: string
  nights: number
  status: string
  channel: string
  channelLabel: string
  channelColor: string
  totalAmount: number
  adults: number
  children: number
  checkedIn: boolean
  checkedOut: boolean
}

// === FEEDBACK ===
export type FeedbackPriority = 'low' | 'medium' | 'high'
export type FeedbackCategory = 'UI' | 'Bug' | 'Improvement'
export type FeedbackStatus = 'open' | 'in_progress' | 'done'

export interface FeedbackPin {
  id: string
  x: number
  y: number
  route: string
  comment: string
  priority: FeedbackPriority
  category: FeedbackCategory
  status: FeedbackStatus
  viewportWidth: number
  viewportHeight: number
  browser: string
  createdAt: Date
}

export interface CreateFeedbackPayload {
  x: number
  y: number
  route: string
  comment: string
  priority: FeedbackPriority
  category: FeedbackCategory
  viewportWidth: number
  viewportHeight: number
  browser: string
}
