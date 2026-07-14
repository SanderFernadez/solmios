export interface ReportContext {
  from: string
  to: string
  totalRooms: number
  taxRate: number
  /** TODAS las reservas del período (incluye cancelled/no_show). Para conteos y ocupación real. */
  reservations: any[]
  /**
   * Reservas que generan ingreso: las del período MENOS cancelled y no_show. Una reserva cancelada
   * nunca fue plata; sumarla infla el revenue. Todo agregado de dinero (facturado, por-cobrar,
   * revenue por país/canal, ADR, RevPAR) DEBE usar ésta, no `reservations`.
   */
  revenueReservations: any[]
  rooms: any[]
  guests: any[]
  /** Gastos del período. Acotados por `expenseDate`, no la tabla entera. */
  expenses: any[]
  /** Pagos del período — la fuente de verdad del dinero cobrado. Acotados por `paymentDate`. */
  payments: any[]
  folioCharges: any[]
  folios: any[]
  /** folioId → reservationId. Los folio_charges no traen reservationId; el vínculo va por el folio. */
  folioToReservation: Map<string, string>
  blocks: any[]
  hotel: any
}

export interface ReportStrategy {
  readonly type: string
  execute(ctx: ReportContext): any
}
