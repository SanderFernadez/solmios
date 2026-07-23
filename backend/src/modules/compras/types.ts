// compras/types.ts — Contrato TypeScript (API). El schema de DB vive en model.ts.

export type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'closed' | 'cancelled'

export interface RequisitionDTO {
  id: string
  hotelId: string
  number?: string
  status: RequisitionStatus
  requestedBy?: string
  approvedBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RequisitionItemDTO {
  id: string
  hotelId: string
  requisitionId: string
  inventoryItemId?: string
  description: string
  quantity: number
  unit: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderDTO {
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
  createdAt: string
  updatedAt: string
}

export interface PurchaseOrderItemDTO {
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
  createdAt: string
  updatedAt: string
}

export interface GoodsReceiptDTO {
  id: string
  hotelId: string
  number?: string
  orderId: string
  receivedBy?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ReceiptItemDTO {
  id: string
  hotelId: string
  receiptId: string
  orderItemId: string
  inventoryItemId?: string
  quantity: number
  unitCost: number
  createdAt: string
  updatedAt: string
}

// Puerto que provee un conector para sumar stock al inventario en la recepción (COM-3). El módulo NO
// importa inventario: recibe esta función inyectada.
export interface ComprasPorts {
  addStock?: (input: { itemId: string; quantity: number; unitCost: number; sourceId: string }, user: CurrentUser) => Promise<void>
  createExpenseFromPO?: (input: { orderId: string; supplierId?: string; amount: number; invoiceNumber?: string; currency?: string }, user: CurrentUser) => Promise<{ expenseId: string }>
  supplierExists?: (supplierId: string, hotelId: string) => Promise<boolean>
}

export interface CurrentUser {
  id: string
  hotelId?: string | null
  role?: string
}
