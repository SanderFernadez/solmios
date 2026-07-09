export interface ReportContext {
  from: string
  to: string
  totalRooms: number
  taxRate: number
  reservations: any[]
  rooms: any[]
  guests: any[]
  /** Gastos del período. Acotados por `expenseDate`, no la tabla entera. */
  expenses: any[]
  /** Pagos del período — la fuente de verdad del dinero cobrado. Acotados por `paymentDate`. */
  payments: any[]
  folioCharges: any[]
  blocks: any[]
  hotel: any
}

export interface ReportStrategy {
  readonly type: string
  execute(ctx: ReportContext): any
}
