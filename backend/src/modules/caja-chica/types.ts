// caja-chica/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

export type PettyCashFundStatus = 'requested' | 'completed' | 'cancelled'

export interface PettyCashFundDTO {
  id: string
  hotelId: string
  name: string
  /** Responsable del fondo (users.id). */
  custodianId: string
  /** Tope del fondo. */
  targetAmount: number
  /** Saldo persistido (se descuenta al gastar, se repone al completar reposición). */
  currentBalance: number
  currency?: string
  active?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePettyCashFundDTO {
  hotelId?: string
  name: string
  custodianId: string
  targetAmount: number
  currency?: string
  active?: number
  notes?: string
}

export interface UpdatePettyCashFundDTO {
  name?: string
  custodianId?: string
  targetAmount?: number
  currency?: string
  active?: number
  notes?: string
}

export interface PettyCashReplenishmentDTO {
  id: string
  hotelId: string
  fundId: string
  amount: number
  status: PettyCashFundStatus
  requestedBy?: string
  approvedBy?: string
  sourceBankAccountId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePettyCashReplenishmentDTO {
  hotelId?: string
  fundId: string
  amount: number
  sourceBankAccountId?: string
  notes?: string
}

// Usuario autenticado del JWT (req.user). Para ownership (IDOR).
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}

export interface PettyCashQuery {
  hotelId?: string
  fundId?: string
  status?: PettyCashFundStatus
  active?: number
}
