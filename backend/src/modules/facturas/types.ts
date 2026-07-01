// facturas/types.ts — DTOs y tipos de queries
// Responsabilidad ÚNICA: contrato TypeScript del módulo (cómo se ven los datos).
// El schema de DB vive en ./model.ts — son conceptos distintos.
// Modelo de dinero: `amount` = TOTAL (subtotal + impuestos), `taxes` = monto de impuesto.

export type InvoiceType = 'invoice' | 'payment' | 'folio' | 'receipt' | 'credit_note'
export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'draft'

export interface InvoiceItem {
  description: string
  amount: number
  quantity?: number
  unitPrice?: number
  sortOrder?: number
}

export interface FacturasDTO {
  id: string
  hotelId: string
  guestId?: string | null
  reservationId?: string | null
  invoiceNumber: string
  type: InvoiceType
  amount: number              // TOTAL (subtotal + taxes)
  taxes: number               // monto de impuesto
  currency: string
  status: InvoiceStatus
  issueDate: string
  dueDate?: string | null
  ncf?: string | null
  paymentMethod?: string | null
  amountPaid?: number
  notes?: string | null
  createdAt: string
  updatedAt: string

  // Campos derivados (computados al leer, no viven en la DB):
  subtotal?: number           // amount - taxes
  taxRate?: number            // % aplicado (0 si no aplica)
  balance?: number            // amount - amountPaid (saldo pendiente)
  guest?: string              // nombre del huésped (resuelto desde guests)
  room?: string               // número de habitación (resuelto desde reservationId)
  items?: InvoiceItem[]       // desglose de líneas (desde notes si aplica)
}

export interface CreateFacturasDTO {
  hotelId: string
  guestId?: string | null
  reservationId?: string | null
  invoiceNumber?: string
  type?: InvoiceType
  amount: number              // base (para invoice: subtotal; service calcula tax y total)
  currency?: string
  status?: InvoiceStatus
  issueDate?: string
  dueDate?: string | null
  ncf?: string | null
  paymentMethod?: string | null
  notes?: string | null
  items?: InvoiceItem[]
}

export interface UpdateFacturasDTO {
  guestId?: string | null
  reservationId?: string | null
  type?: InvoiceType
  amount?: number
  taxes?: number
  currency?: string
  status?: InvoiceStatus
  dueDate?: string | null
  ncf?: string | null
  paymentMethod?: string | null
  notes?: string | null
}

export interface PayFacturasDTO {
  method?: string
  amount?: number
  reference?: string
  notes?: string
}

// ─── Consultas ─────────────────────────────────────────
export interface FacturasQuery {
  hotelId?: string
  type?: InvoiceType
  status?: InvoiceStatus
  page?: number
  limit?: number
  search?: string
}

export interface FacturasListResult {
  data: FacturasDTO[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

/** Usuario autenticado (para verificación de ownership multi-tenant). */
export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}

export interface FacturasStats {
  total: number
  pending: number
  paid: number
  overdue: number
  cancelled: number
  monthlyRevenue: number
  todayRevenue: number
  totalTax: number
}
