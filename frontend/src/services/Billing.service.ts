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
  amountPaid: number
  balance: number
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
  const amountPaid = Number(r.amountPaid ?? 0)
  const subtotal = Number(r.subtotal ?? (total - tax))
  const taxRate = Number(r.taxRate ?? (subtotal > 0 ? Math.round((tax / subtotal) * 100) : 0))
  const balance = Number(r.balance ?? (total - amountPaid))
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
    amountPaid,
    balance,
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

interface BillingResponse {
  data: any[]
  total: number
  limit: number
  offset: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface BillingStats {
  total: number
  pending: number
  paid: number
  overdue: number
  cancelled: number
  monthlyRevenue: number
  todayRevenue: number
  totalTax: number
}

export const BillingService = {
  async list(hotelId?: string, type?: string, page = 1, limit = 20): Promise<{ invoices: Invoice[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean }> {
    const params = new URLSearchParams()
    if (hotelId) params.set('hotelId', hotelId)
    if (type) params.set('type', type)
    params.set('page', String(page))
    params.set('limit', String(limit))
    const data = await http.get<BillingResponse>(`/facturas?${params.toString()}`)
    return {
      invoices: (data.data ?? []).map(mapInvoice),
      total: data.total ?? 0,
      pages: data.pages ?? 1,
      hasNext: data.hasNext ?? false,
      hasPrev: data.hasPrev ?? false,
    }
  },

  async stats(): Promise<BillingStats> {
    return http.get<BillingStats>('/facturas/stats')
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

  /** Encola el envío de una factura por email (cola persistente del backend con reintentos). */
  async emailInvoice(invoiceId: string, to: string): Promise<{ sent: boolean; messageId: string; configured: boolean }> {
    return http.post(`/facturas/${invoiceId}/email`, { to })
  },

  /** Descarga el PDF de una factura (endpoint con auth JWT). Devuelve Blob para descarga. */
  async downloadPdf(invoiceId: string): Promise<Blob> {
    return http.getBlob(`/facturas/${invoiceId}/pdf`)
  },

  async update(id: string, data: any): Promise<Invoice> {
    const r = await http.put(`/facturas/${id}`, data)
    return mapInvoice(r)
  },

  exportCsv(invoices: Invoice[]): string {
    const headers = ['Número', 'Huésped', 'Habitación', 'Tipo', 'Estado', 'Subtotal', 'Impuestos', 'Total', 'Pagado', 'Saldo', 'Fecha', 'Método']
    const rows = invoices.map(inv => [
      inv.number, inv.guest, inv.room, inv.type, inv.status,
      inv.subtotal.toFixed(2), inv.tax.toFixed(2), inv.total.toFixed(2),
      inv.amountPaid.toFixed(2), inv.balance.toFixed(2),
      inv.issueDate, inv.paymentMethod || '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    return csv
  },

  downloadCsv(invoices: Invoice[], filename = 'facturas.csv'): void {
    const csv = this.exportCsv(invoices)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
