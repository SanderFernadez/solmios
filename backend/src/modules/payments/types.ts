// payments/types.ts — DTOs y tipos de queries

export type PaymentType = 'charge' | 'refund' | 'deposit' | 'withdrawal'
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'link' | 'deposit' | 'other'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
export type DepositStatus = 'held' | 'partially_refunded' | 'fully_refunded' | 'released'
export type LinkStatus = 'active' | 'used' | 'expired' | 'cancelled'

// ─── Payment ───────────────────────────────────────────
export interface PaymentDTO {
  id: string
  hotelId: string
  folioId?: string
  invoiceId?: string
  guestId?: string
  type: PaymentType
  method: PaymentMethod
  status: PaymentStatus
  amount: number
  currency: string
  description: string
  reference: string
  stripePaymentId: string
  stripeSessionId: string
  metadata: Record<string, any>
  processedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentDTO {
  hotelId: string
  folioId?: string
  invoiceId?: string
  guestId?: string
  type: PaymentType
  method: PaymentMethod
  amount: number
  currency?: string
  description?: string
  reference?: string
  metadata?: Record<string, any>
  /**
   * Estado explícito. Sin esto, `cash` se asume cobrado y todo lo demás queda `pending` (correcto
   * para tarjeta vía Stripe: se confirma por webhook). Un cobro registrado a mano — "el huésped ya
   * transfirió" — es dinero recibido y debe entrar `completed`, o nunca dispara `onPaymentCompleted`
   * y la caja/conciliación no se enteran.
   */
  status?: PaymentStatus
  /** Identidad del cobro en Stripe. Permite deduplicar los reintentos del webhook. */
  stripeSessionId?: string
  stripePaymentId?: string
}

export interface ChargeCardDTO {
  hotelId: string
  amount: number
  currency?: string
  description: string
  folioId?: string
  guestId?: string
  successUrl: string
  cancelUrl: string
}

// ─── Payment Link ──────────────────────────────────────
export interface PaymentLinkDTO {
  id: string
  hotelId: string
  guestId?: string
  folioId?: string
  amount: number
  currency: string
  description: string
  status: LinkStatus
  token: string
  expiresAt?: string
  maxUses: number
  useCount: number
  paymentId?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePaymentLinkDTO {
  hotelId: string
  guestId?: string
  folioId?: string
  amount: number
  currency?: string
  description?: string
  expiresInHours?: number
  maxUses?: number
}

// ─── Deposit ───────────────────────────────────────────
export interface DepositDTO {
  id: string
  hotelId: string
  reservationId?: string
  guestId?: string
  roomId?: string
  amount: number
  currency: string
  status: DepositStatus
  paymentMethod: string
  stripePaymentId: string
  holdReason: string
  releasedAt?: string
  refundAmount: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateDepositDTO {
  hotelId: string
  reservationId?: string
  guestId?: string
  roomId?: string
  amount: number
  currency?: string
  paymentMethod?: string
  holdReason?: string
  notes?: string
}

export interface RefundDepositDTO {
  amount?: number // partial refund, or full if omitted
  reason?: string
}

// ─── Queries ───────────────────────────────────────────
export interface PaymentsQuery {
  hotelId?: string
  folioId?: string
  invoiceId?: string
  type?: PaymentType
  method?: PaymentMethod
  status?: PaymentStatus
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PaymentsPaginated {
  data: PaymentDTO[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Reconciliation ────────────────────────────────────
export interface ReconciliationEntry {
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  reference?: string
}

export interface ReconciliationResult {
  matched: { bank: ReconciliationEntry; system: PaymentDTO }[]
  unmatchedBank: ReconciliationEntry[]
  unmatchedSystem: PaymentDTO[]
  difference: number
}

// ─── Current User ──────────────────────────────────────
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
