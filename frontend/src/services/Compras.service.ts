// services/Compras.service.ts — Cliente API de compras (COM-1/2/3/4). Requisición → orden de compra →
// recepción (suma stock) → factura (genera gasto). Backend: /api/compras/*. Tipos espejo de
// backend/src/modules/compras/types.ts. El http client desenvuelve el envelope e inyecta el JWT.
import { http } from './http'

// ─── Tipos del dominio ───
export type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'closed' | 'cancelled'

export interface Requisition {
  id: string
  hotelId: string
  number?: string
  status: RequisitionStatus
  requestedBy?: string
  approvedBy?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}
export interface RequisitionItem {
  id: string
  hotelId: string
  requisitionId: string
  inventoryItemId?: string
  description: string
  quantity: number
  unit: string
  notes?: string
}
export type RequisitionWithItems = Requisition & { items: RequisitionItem[] }

export interface PurchaseOrder {
  id: string
  hotelId: string
  number?: string
  requisitionId?: string
  supplierId?: string
  status: PurchaseOrderStatus
  subtotal: number
  tax: number
  total: number
  currency?: string
  expectedDate?: string
  invoiceNumber?: string
  expenseId?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}
export interface PurchaseOrderItem {
  id: string
  hotelId: string
  orderId: string
  inventoryItemId?: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  taxRate: number
  lineTotal: number
  receivedQty: number
}
export type PurchaseOrderWithItems = PurchaseOrder & { items: PurchaseOrderItem[] }

export interface GoodsReceipt {
  id: string
  hotelId: string
  number?: string
  orderId: string
  receivedBy?: string
  notes?: string
  createdAt?: string
}

// ─── Payloads ───
export interface RequisitionLinePayload { inventoryItemId?: string; description: string; quantity?: number; unit?: string; notes?: string }
export interface CreateRequisitionPayload { notes?: string; items?: RequisitionLinePayload[] }
export interface OrderLinePayload { inventoryItemId?: string; description: string; quantity?: number; unit?: string; unitPrice?: number; taxRate?: number }
export interface CreateOrderPayload { supplierId?: string; requisitionId?: string; expectedDate?: string; notes?: string; items?: OrderLinePayload[] }
export interface ReceiveLine { orderItemId: string; quantity: number }
export interface ReceivePayload { notes?: string; lines: ReceiveLine[] }

export const ComprasService = {
  // ─── Requisiciones ───
  async listRequisitions(status?: string): Promise<Requisition[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    const res = await http.get<{ data: Requisition[]; total: number }>(`/compras/requisitions${qs}`)
    return res.data ?? []
  },
  getRequisition: (id: string): Promise<RequisitionWithItems> => http.get(`/compras/requisitions/${id}`),
  createRequisition: (data: CreateRequisitionPayload): Promise<RequisitionWithItems> => http.post('/compras/requisitions', data),
  addRequisitionLine: (id: string, data: RequisitionLinePayload): Promise<RequisitionItem> => http.post(`/compras/requisitions/${id}/items`, data),
  removeRequisitionLine: (id: string, lineId: string): Promise<void> => http.delete(`/compras/requisitions/${id}/items/${lineId}`),
  transitionRequisition: (id: string, status: RequisitionStatus): Promise<Requisition> => http.post(`/compras/requisitions/${id}/transition`, { status }),
  // Enviar la PROPIA requisición a aprobación (draft→submitted). Requiere solo purchasing:create — a
  // diferencia de transitionRequisition (purchasing:edit, usado para aprobar/rechazar).
  submitRequisition: (id: string): Promise<Requisition> => http.post(`/compras/requisitions/${id}/submit`),
  deleteRequisition: (id: string): Promise<void> => http.delete(`/compras/requisitions/${id}`),

  // ─── Órdenes de compra ───
  async listOrders(query?: { status?: string; supplierId?: string }): Promise<PurchaseOrder[]> {
    const qs = new URLSearchParams()
    if (query?.status) qs.set('status', query.status)
    if (query?.supplierId) qs.set('supplierId', query.supplierId)
    const q = qs.toString()
    const res = await http.get<{ data: PurchaseOrder[]; total: number }>(`/compras/orders${q ? `?${q}` : ''}`)
    return res.data ?? []
  },
  getOrder: (id: string): Promise<PurchaseOrderWithItems> => http.get(`/compras/orders/${id}`),
  createOrder: (data: CreateOrderPayload): Promise<PurchaseOrderWithItems> => http.post('/compras/orders', data),
  addOrderLine: (id: string, data: OrderLinePayload): Promise<PurchaseOrderItem> => http.post(`/compras/orders/${id}/items`, data),
  removeOrderLine: (id: string, lineId: string): Promise<void> => http.delete(`/compras/orders/${id}/items/${lineId}`),
  transitionOrder: (id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder> => http.post(`/compras/orders/${id}/transition`, { status }),

  // ─── Recepción + facturación ───
  async listReceipts(orderId: string): Promise<GoodsReceipt[]> {
    const res = await http.get<{ data: GoodsReceipt[]; total: number }>(`/compras/orders/${orderId}/receipts`)
    return res.data ?? []
  },
  receive: (orderId: string, data: ReceivePayload): Promise<GoodsReceipt> => http.post(`/compras/orders/${orderId}/receive`, data),
  markInvoiced: (orderId: string, data: { invoiceNumber?: string }): Promise<PurchaseOrder> => http.post(`/compras/orders/${orderId}/invoice`, data),
}

// ─── Labels ES + estilos de estado ───
export const REQ_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviada', approved: 'Aprobada', rejected: 'Rechazada',
}
export const REQ_STATUS_STYLE: Record<string, string> = {
  draft: 'bg-surface text-text-muted', submitted: 'bg-gold/15 text-gold',
  approved: 'bg-teal/15 text-teal', rejected: 'bg-coral/10 text-coral',
}
export const OC_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', received: 'Recibida', closed: 'Cerrada', cancelled: 'Cancelada',
}
export const OC_STATUS_STYLE: Record<string, string> = {
  draft: 'bg-surface text-text-muted', sent: 'bg-gold/15 text-gold',
  received: 'bg-teal/15 text-teal', closed: 'bg-navy/10 text-navy', cancelled: 'bg-coral/10 text-coral',
}
