import { http } from './http'

export type InvoiceType = 'invoice' | 'payment' | 'folio' | 'receipt' | 'credit_note'
export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled' | 'draft'

export interface InvoiceItem {
  description: string
  amount: number
}

export interface Invoice {
  id: string
  hotelId?: string
  guestId?: string | null
  reservationId?: string | null
  number: string          // invoiceNumber
  type: InvoiceType
  status: InvoiceStatus
  // Dinero (computado por el backend):
  subtotal: number
  taxRate: number
  tax: number
  total: number
  currency: string
  // Datos resueltos por el backend:
  guest: string
  room: string
  ncf?: string | null
  paymentMethod?: string | null
  items: InvoiceItem[]
  issueDate: string
  dueDate: string | null
  notes?: string | null
}

// Tolerante a inconsistencias ES/EN que pueda devolver el backend.
const TYPE_MAP: Record<string, InvoiceType> = {
  invoice: 'invoice', factura: 'invoice',
  payment: 'payment', pago: 'payment',
  folio: 'folio',
  receipt: 'receipt', recibo: 'receipt',
  credit_note: 'credit_note', nota_credito: 'credit_note',
}

const STATUS_MAP: Record<string, InvoiceStatus> = {
  paid: 'paid', pagado: 'paid',
  pending: 'pending', pendiente: 'pending',
  overdue: 'overdue', vencido: 'overdue',
  cancelled: 'cancelled', cancelada: 'cancelled',
  draft: 'draft', borrador: 'draft',
}

export function mapInvoice(r: any): Invoice {
  const total = Number(r.amount ?? r.total ?? 0)
  const tax = Number(r.taxes ?? r.tax ?? 0)
  const subtotal = Number(r.subtotal ?? (total - tax))
  const taxRate = Number(r.taxRate ?? (subtotal > 0 ? Math.round((tax / subtotal) * 100) : 0))
  return {
    id: r.id,
    hotelId: r.hotelId,
    guestId: r.guestId ?? null,
    reservationId: r.reservationId ?? null,
    number: r.invoiceNumber ?? r.number ?? '—',
    type: TYPE_MAP[String(r.type ?? 'invoice').toLowerCase()] ?? 'invoice',
    status: STATUS_MAP[String(r.status ?? 'pending').toLowerCase()] ?? 'pending',
    subtotal,
    taxRate,
    tax,
    total,
    currency: r.currency ?? 'USD',
    guest: r.guest ?? '',
    room: r.room ?? '',
    ncf: r.ncf ?? null,
    paymentMethod: r.paymentMethod ?? null,
    items: Array.isArray(r.items) && r.items.length ? r.items : (r.type ? [{ description: r.type, amount: total }] : []),
    issueDate: r.issueDate ?? r.date ?? '',
    dueDate: r.dueDate ?? null,
    notes: r.notes ?? null,
  }
}

interface BillingResponse { data: any[]; total: number }

export const BillingService = {
  async list(hotelId?: string, type?: string): Promise<{ invoices: Invoice[]; total: number }> {
    const params = new URLSearchParams()
    if (hotelId) params.set('hotelId', hotelId)
    if (type) params.set('type', type)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const data = await http.get<BillingResponse>(`/facturas${qs}`)
    return { invoices: (data.data ?? []).map(mapInvoice), total: data.total ?? 0 }
  },

  async create(data: any): Promise<Invoice> {
    const r = await http.post('/facturas', data)
    return mapInvoice(r)
  },

  /** Aplica un pago a una factura: el backend marca la factura como pagada y registra el pago. */
  async pay(invoiceId: string, payload: { method?: string; amount?: number; reference?: string; notes?: string }): Promise<Invoice> {
    const r = await http.post(`/facturas/${invoiceId}/pay`, payload)
    return mapInvoice(r)
  },

  async update(id: string, data: any): Promise<Invoice> {
    const r = await http.put(`/facturas/${id}`, data)
    return mapInvoice(r)
  },
}
