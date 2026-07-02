// cash/types.ts — DTOs y tipos de queries (contrato TypeScript del módulo).
// El schema de DB vive en ./model.ts — son conceptos distintos.

export type MovementType = 'income' | 'expense' | 'opening' | 'closing'
export type MovementMethod = 'cash' | 'card' | 'transfer' | 'link' | 'other'
export type ShiftStatus = 'open' | 'closed'

export interface CashMovementDTO {
  id: string
  hotelId: string
  shiftId?: string | null
  type: MovementType
  amount: number
  method?: MovementMethod
  concept?: string
  category?: string
  source?: string
  guestName?: string
  roomNumber?: string
  reservationId?: string
  folioId?: string
  paymentId?: string
  reference?: string
  createdBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateMovementDTO {
  type: MovementType
  amount: number
  method?: MovementMethod
  concept?: string
  category?: string
  guestName?: string
  roomNumber?: string
  reservationId?: string
  folioId?: string
  reference?: string
  notes?: string
  // hotelId NUNCA del body — el service lo fuerza desde el JWT (P0 IDOR).
}

export interface UpdateMovementDTO {
  type?: MovementType
  amount?: number
  method?: MovementMethod
  concept?: string
  category?: string
  guestName?: string
  roomNumber?: string
  reference?: string
  notes?: string
}

export interface CashShiftDTO {
  id: string
  hotelId: string
  status: ShiftStatus
  openingAmount: number
  countedAmount?: number
  expectedAmount?: number
  difference?: number
  denominations?: string
  openedBy?: string
  closedBy?: string
  openedAt?: string
  closedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface OpenShiftDTO {
  openingAmount?: number
  notes?: string
}

export interface CloseShiftDTO {
  countedAmount: number
  denominations?: string  // JSON string con conteo de billetes
  notes?: string
}

export interface MovementQuery {
  hotelId?: string
  shiftId?: string
  type?: MovementType
  method?: MovementMethod
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface CashPaginated {
  data: CashMovementDTO[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ReconcileResult {
  shift: CashShiftDTO
  opening: number
  income: number
  expense: number
  expected: number
  counted: number
  difference: number
  byMethod: Record<string, number>
}

export interface CashStats {
  today: number
  week: number
  month: number
  count: number
  byMethod: Record<string, number>
}

// Usuario autenticado extraído del JWT (req.user).
export interface CurrentUser {
  id: string
  hotelId?: string
  role: string
}
