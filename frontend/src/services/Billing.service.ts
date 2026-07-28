import { http } from './http'

// BM-4.1/4.2 — 'payment'/'folio'/'receipt' eran tipos muertos: billing-money-consolidation movió
// el dinero a `payments`, ya no se crean filas de ese tipo en `invoices`.
export type InvoiceType = 'invoice' | 'credit_note'
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

// Tolerante a inconsistencias ES/EN que pueda devolver el backend. Una fila legacy con
// type:'payment'/'folio'/'receipt' (de antes de billing-money-consolidation) cae al fallback
// 'invoice' del caller (mapInvoice) — no hay forma útil de distinguirla ya sin ese tipo.
const TYPE_MAP: Record<string, InvoiceType> = {
  invoice: 'invoice', factura: 'invoice',
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

/**
 * Pago real del módulo `payments` (fuente de verdad del dinero). NO confundir con los comprobantes
 * `type:'payment'` de la tabla `invoices` (modelo viejo): estos traen método, referencia y estado
 * REALES del cobro. `status` es el ciclo de vida del pago ('completed' = cobrado), no el de una factura.
 */
export interface Payment {
  id: string
  method: string   // card | cash | transfer | link | deposit | other
  status: string   // pending | processing | completed | failed | refunded
  amount: number
  currency: string
  reference: string
  description: string
  guestId?: string | null
  folioId?: string | null
  invoiceId?: string | null
  createdAt: string
}

function mapPayment(r: any): Payment {
  return {
    id: r.id,
    method: String(r.method ?? 'other'),
    status: String(r.status ?? 'pending'),
    amount: Number(r.amount ?? 0),
    currency: r.currency ?? 'USD',
    reference: r.reference ?? '',
    description: r.description ?? '',
    guestId: r.guestId ?? null,
    folioId: r.folioId ?? null,
    invoiceId: r.invoiceId ?? null,
    createdAt: r.createdAt ?? r.processedAt ?? '',
  }
}

interface PaymentsApiResponse {
  data: any[]
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }
}

export interface ListPaymentsParams {
  hotelId?: string
  method?: string
  status?: string
  page?: number
  limit?: number
}

export interface BillingStats {
  total: number
  pendingAmount: number
  paid: number
  overdueAmount: number
  cancelled: number
  monthlyRevenue: number
  todayRevenue: number
  totalTax: number
}

export interface ListInvoicesParams {
  hotelId?: string
  /** 'invoice' | 'payment' | 'folio'. Sin tipo, la API devuelve los tres mezclados. */
  type?: InvoiceType
  status?: InvoiceStatus
  page?: number
  limit?: number
}

/**
 * ¿Se puede eliminar esta factura? Espeja la regla del backend (usecases/deletable.ts):
 * una factura con efectos contables se anula con nota de crédito, no se borra.
 * Acá solo decide qué botón mostrar — quien manda es el backend, que rechaza con 409.
 */
export function isDeletable(inv: Invoice): boolean {
  if (inv.type !== 'invoice') return true
  if (inv.status === 'paid' || inv.status === 'overdue' || inv.status === 'cancelled') return false
  return (inv.amountPaid ?? 0) === 0
}

export const BillingService = {
  async list(params: ListInvoicesParams = {}): Promise<{ invoices: Invoice[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean }> {
    const { hotelId, type, status, page = 1, limit = 20 } = params
    const qs = new URLSearchParams()
    if (hotelId) qs.set('hotelId', hotelId)
    if (type) qs.set('type', type)
    if (status) qs.set('status', status)
    qs.set('page', String(page))
    qs.set('limit', String(limit))
    const data = await http.get<BillingResponse>(`/facturas?${qs.toString()}`)
    return {
      invoices: (data.data ?? []).map(mapInvoice),
      total: data.total ?? 0,
      pages: data.pages ?? 1,
      hasNext: data.hasNext ?? false,
      hasPrev: data.hasPrev ?? false,
    }
  },

  /**
   * Lista los pagos REALES desde el módulo `payments` (`GET /api/payments`), no los comprobantes
   * `type:'payment'` de `invoices`. Trae método, referencia y estado reales. El backend fuerza el
   * `hotelId` del JWT para merchants (el query param solo lo respeta super_admin).
   */
  async listPayments(params: ListPaymentsParams = {}): Promise<{ payments: Payment[]; total: number; pages: number; hasNext: boolean; hasPrev: boolean }> {
    const { hotelId, method, status, page = 1, limit = 20 } = params
    const qs = new URLSearchParams()
    if (hotelId) qs.set('hotelId', hotelId)
    if (method) qs.set('method', method)
    if (status) qs.set('status', status)
    qs.set('page', String(page))
    qs.set('limit', String(limit))
    const res = await http.get<PaymentsApiResponse>(`/payments?${qs.toString()}`)
    return {
      payments: (res.data ?? []).map(mapPayment),
      total: res.pagination?.total ?? 0,
      pages: res.pagination?.totalPages ?? 1,
      hasNext: res.pagination?.hasNext ?? false,
      hasPrev: res.pagination?.hasPrev ?? false,
    }
  },

  /** Anula una factura emitida. Es la vía correcta cuando `isDeletable()` da false. */
  async creditNote(invoiceId: string, reason: string): Promise<unknown> {
    return http.post(`/facturas/${invoiceId}/credit-note`, { reason })
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

  /**
   * Tasa fiscal vigente del hotel, calculada por el backend con la misma función que emite la
   * factura. No recalcular la tasa acá: dos fuentes de verdad hacen que el preview mienta.
   */
  async taxRate(): Promise<number> {
    const res = await http.get<{ rate: number }>('/facturas/tax-rate')
    return Number(res?.rate ?? 0)
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

  print(id: string): Promise<string> {
    return http.get<string>(`/facturas/${id}/print`)
  },

  remove(id: string): Promise<{ success: boolean }> {
    return http.delete<{ success: boolean }>(`/facturas/${id}`)
  },
}
