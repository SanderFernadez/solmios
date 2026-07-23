import type { BodyRule as ValidationRule } from '../../../shared/validators/validate-body'

// validateSchema devuelve SOLO los campos declarados (los demás se descartan en silencio, mem 1805).

// ─── Requisiciones (COM-1) ───
export const CreateRequisitionSchema: Record<string, ValidationRule> = {
  notes: { type: 'text' as const },
  items: { type: 'array' as const },
}
export const RequisitionLineSchema: Record<string, ValidationRule> = {
  inventoryItemId: { type: 'string' as const },
  description: { type: 'string' as const, required: true },
  quantity: { type: 'number' as const },
  unit: { type: 'string' as const },
  notes: { type: 'text' as const },
}
const REQ_STATUS = ['submitted', 'approved', 'rejected']
export const RequisitionTransitionSchema: Record<string, ValidationRule> = {
  status: { type: 'string' as const, required: true, enum: REQ_STATUS },
}

// ─── Órdenes de compra (COM-2) ───
export const CreateOrderSchema: Record<string, ValidationRule> = {
  supplierId: { type: 'string' as const },
  requisitionId: { type: 'string' as const },
  expectedDate: { type: 'string' as const },
  notes: { type: 'text' as const },
  items: { type: 'array' as const },
}
export const OrderLineSchema: Record<string, ValidationRule> = {
  inventoryItemId: { type: 'string' as const },
  description: { type: 'string' as const, required: true },
  quantity: { type: 'number' as const },
  unit: { type: 'string' as const },
  unitPrice: { type: 'number' as const },
  taxRate: { type: 'number' as const },
}
const OC_STATUS = ['sent', 'received', 'closed', 'cancelled']
export const OrderTransitionSchema: Record<string, ValidationRule> = {
  status: { type: 'string' as const, required: true, enum: OC_STATUS },
}

// ─── Recepción + facturación (COM-3/4) ───
export const ReceiveSchema: Record<string, ValidationRule> = {
  notes: { type: 'text' as const },
  lines: { type: 'array' as const, required: true },
}
export const InvoiceSchema: Record<string, ValidationRule> = {
  invoiceNumber: { type: 'string' as const },
}

export const ComprasValidator = { createRequisition: CreateRequisitionSchema, createOrder: CreateOrderSchema }
