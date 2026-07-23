// compras/model.ts — Schema de compras (COM-0). Cadena: requisición → orden de compra → recepción.
// 6 tablas. DB en inglés, multi-tenant por hotelId, id = TEXT UUID, booleanos = INTEGER 0/1, plata = number.
// Los proveedores viven en treasury.suppliers (se resuelven por connector, NO se importa). El inventario
// (inventory_items) se referencia por id lógico. Ver openspec/changes/compras-inventario.
import type { ModelDefinition, ORM } from 'arckode-framework'

/** Requisición de compra: pedido interno de insumos. Se aprueba antes de convertirse en orden. */
export const PurchaseRequisitionModel: ModelDefinition = {
  table: 'purchase_requisitions',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    number: { type: 'string' },                    // REQ-YYYY-NNNN (counter atómico en configuration)
    // draft | submitted | approved | rejected
    status: { type: 'string', default: 'draft' },
    requestedBy: { type: 'string', indexed: true }, // users.id (nombre por /usuarios)
    approvedBy: { type: 'string' },
    notes: { type: 'text' },
  },
  timestamps: true,
}

/** Línea de requisición. `inventoryItemId` opcional (puede pedirse algo aún no catalogado por descripción). */
export const RequisitionItemModel: ModelDefinition = {
  table: 'requisition_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    requisitionId: { type: 'string', required: true, indexed: true },
    inventoryItemId: { type: 'string', indexed: true },
    description: { type: 'string', required: true },  // snapshot del nombre/pedido
    quantity: { type: 'number', default: 1 },
    unit: { type: 'string', default: 'unit' },
    notes: { type: 'text' },
  },
  timestamps: true,
}

/** Orden de compra al proveedor. Totales calculados por el server. `expenseId` se setea al facturar. */
export const PurchaseOrderModel: ModelDefinition = {
  table: 'purchase_orders',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    number: { type: 'string' },                    // OC-YYYY-NNNN
    requisitionId: { type: 'string', indexed: true },
    supplierId: { type: 'string', indexed: true }, // treasury.suppliers.id (validado por connector)
    // draft | sent | received | closed | cancelled
    status: { type: 'string', default: 'draft' },
    subtotal: { type: 'number', default: 0 },
    tax: { type: 'number', default: 0 },
    total: { type: 'number', default: 0 },
    currency: { type: 'string' },                  // moneda del hotel (NO hardcode)
    expectedDate: { type: 'string' },
    invoiceNumber: { type: 'string' },             // factura del proveedor (al facturar)
    expenseId: { type: 'string' },                 // Expense generado (dedup: 1 gasto por OC)
    notes: { type: 'text' },
  },
  timestamps: true,
}

/** Línea de OC. `receivedQty` acumula lo recibido (recepción total o parcial). `unitPrice` neto. */
export const PurchaseOrderItemModel: ModelDefinition = {
  table: 'purchase_order_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    orderId: { type: 'string', required: true, indexed: true },
    inventoryItemId: { type: 'string', indexed: true },
    description: { type: 'string', required: true },  // snapshot
    quantity: { type: 'number', default: 1 },
    unit: { type: 'string', default: 'unit' },
    unitPrice: { type: 'number', default: 0 },        // neto
    taxRate: { type: 'number', default: 0 },          // % congelado (tasa del hotel)
    lineTotal: { type: 'number', default: 0 },        // neto (quantity × unitPrice)
    receivedQty: { type: 'number', default: 0 },
  },
  timestamps: true,
}

/** Recepción de mercancía contra una OC. Cada recepción es un evento (permite parciales). */
export const GoodsReceiptModel: ModelDefinition = {
  table: 'goods_receipts',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    number: { type: 'string' },                    // REC-YYYY-NNNN
    orderId: { type: 'string', required: true, indexed: true },
    receivedBy: { type: 'string' },                // users.id
    notes: { type: 'text' },
  },
  timestamps: true,
}

/** Línea recibida: cuánto de una línea de OC llegó, y a qué costo (para el promedio del inventario). */
export const ReceiptItemModel: ModelDefinition = {
  table: 'receipt_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    receiptId: { type: 'string', required: true, indexed: true },
    orderItemId: { type: 'string', required: true, indexed: true },
    inventoryItemId: { type: 'string', indexed: true },  // a qué insumo suma stock (si aplica)
    quantity: { type: 'number', required: true },
    unitCost: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerComprasModels(orm: ORM): void {
  orm.define('PurchaseRequisitions', PurchaseRequisitionModel)
  orm.define('RequisitionItems', RequisitionItemModel)
  orm.define('PurchaseOrders', PurchaseOrderModel)
  orm.define('PurchaseOrderItems', PurchaseOrderItemModel)
  orm.define('GoodsReceipts', GoodsReceiptModel)
  orm.define('ReceiptItems', ReceiptItemModel)
}
