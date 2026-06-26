// folios/types.ts — DTOs del dominio de folios.
// Un folio acumula cargos (kind='charge') y pagos (kind='payment') por reserva/huésped.
// balance = sum(cargos) - sum(pagos). Al cerrarse genera una factura.

export type FolioStatus = 'open' | 'closed' | 'void'
export type ChargeKind = 'charge' | 'payment'
export type ChargeCategory = 'room' | 'minibar' | 'restaurant' | 'spa' | 'laundry' | 'phone' | 'payment' | 'tax' | 'other'

export interface FolioChargeDTO {
  id: string
  folioId: string
  hotelId: string
  description: string | null
  category: ChargeCategory
  kind: ChargeKind
  quantity: number
  amount: number       // base (subtotal de la línea)
  taxes: number
  total: number        // amount + taxes (cargos positivo; pagos negativo)
  source: string
  postedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface FolioDTO {
  id: string
  hotelId: string
  reservationId: string | null
  guestId: string | null
  roomId: string | null
  status: FolioStatus
  currency: string
  invoiceId: string | null
  openedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string

  // Campos derivados (computados al leer):
  guestName?: string
  roomNumber?: string
  chargesTotal?: number     // suma de cargos (kind=charge)
  paymentsTotal?: number    // suma de pagos (kind=payment, valor absoluto)
  balance?: number          // chargesTotal - paymentsTotal
  chargeCount?: number
  charges?: FolioChargeDTO[] // sólo al pedir detalle
}

export interface OpenFolioDTO {
  hotelId: string
  reservationId?: string | null
  guestId?: string | null
  roomId?: string | null
  currency?: string
}

export interface PostChargeDTO {
  description: string
  category?: ChargeCategory
  amount: number          // base (se le calcula impuesto según config del hotel)
  quantity?: number
  source?: string
}

export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'link' | 'deposit' | 'other'

export interface ApplyPaymentDTO {
  amount: number
  method?: PaymentMethod
  reference?: string
}

export interface FolioQuery {
  hotelId?: string
  status?: FolioStatus
  reservationId?: string
  search?: string
}

export interface FolioListResult {
  data: FolioDTO[]
  total: number
}

export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
