export interface ReportContext {
  from: string
  to: string
  totalRooms: number
  taxRate: number
  reservations: any[]
  rooms: any[]
  guests: any[]
  expenses: any[]
  folioCharges: any[]
  blocks: any[]
  hotel: any
}

export interface ReportStrategy {
  readonly type: string
  execute(ctx: ReportContext): any
}
