// gastos/types.ts — DTOs y tipos de queries (generado desde model.ts).
// Responsabilidad ÚNICA: contrato TypeScript del módulo. El schema de DB vive en ./model.ts.

/** Solo `cash` impacta el arqueo del cajón físico. El resto ya está bancarizado. */
export type ExpensePaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

/** `manual` lo cargó una persona; el resto lo generó un conector y no se edita a mano. */
export type ExpenseSource = 'manual' | 'payroll' | 'purchase_order'

export interface GastosDTO {
  id: string
  hotelId: string
  category?: string
  concept: string
  amount: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
  paymentMethod?: ExpensePaymentMethod
  source?: ExpenseSource
  sourceId?: string
  /** Fondo de caja chica (petty_cash_funds.id). Si está, descuenta del saldo del fondo. */
  pettyCashFundId?: string
  createdAt: string
  updatedAt: string
}

export interface CreateGastosDTO {
  hotelId: string
  category?: string
  concept: string
  amount: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
  paymentMethod?: ExpensePaymentMethod
  /** Solo lo setean los conectores: `validateSchema` los descarta si vinieran del body. */
  source?: ExpenseSource
  sourceId?: string
  /** Proveedor del catálogo (treasury.suppliers) para el aging de AP. Lo setea el conector de compras. */
  supplierId?: string
  /** Fondo de caja chica (petty_cash_funds.id). Descuenta del saldo del fondo vía conector. */
  pettyCashFundId?: string
}

export interface UpdateGastosDTO {
  hotelId?: string
  category?: string
  concept?: string
  amount?: number
  date?: string
  provider?: string
  invoiceNumber?: string
  notes?: string
  paid?: number
  paymentMethod?: ExpensePaymentMethod
}

// ─── Consultas ─────────────────────────────────────────
export interface GastosQuery {
  hotelId?: string
  status?: string
  type?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface GastosPaginated {
  data: GastosDTO[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

// Usuario autenticado extraído del JWT (req.user). Se usa para verificar ownership (IDOR).
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
