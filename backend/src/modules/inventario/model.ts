// inventario/model.ts — Schema de inventario de insumos (INV-0).
// 2 tablas: inventory_items (insumos con stock y costo promedio) + stock_movements (ledger auditable).
// DB en inglés, multi-tenant por hotelId, id = TEXT UUID, booleanos = INTEGER 0/1.
// El stock se mueve SOLO por movimientos (idempotentes, dedup por source+sourceId); currentStock es el
// balance materializado. Valuación = costo promedio ponderado. Ver openspec/changes/compras-inventario.
import type { ModelDefinition, ORM } from 'arckode-framework'

/** Insumo de inventario (comida, bebida/bar, suministro). `currentStock`/`avgCost` los mueve el ledger. */
export const InventoryItemModel: ModelDefinition = {
  table: 'inventory_items',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    sku: { type: 'string', indexed: true },        // código interno opcional
    name: { type: 'string', required: true },
    // food | beverage | supply  (bebida/bar entra en 'beverage')
    category: { type: 'string', default: 'supply' },
    // Unidad de medida: unit | kg | g | liter | ml | bottle | box … (texto libre validado en schema).
    unit: { type: 'string', default: 'unit' },
    currentStock: { type: 'number', default: 0 },  // balance materializado (lo mueve el ledger)
    minStock: { type: 'number', default: 0 },      // punto de reorden
    avgCost: { type: 'number', default: 0 },        // costo promedio ponderado
    active: { type: 'number', default: 1 },
  },
  timestamps: true,
}

/**
 * Movimiento de stock (ledger auditable). type: in (entrada, suma) | out (salida, resta) | adjust (fija).
 * `source`+`sourceId` identifican el origen (purchase_receipt / pos_sale / manual) y dan idempotencia:
 * el mismo (source,sourceId) no se aplica dos veces. `balanceAfter` = stock del ítem tras el movimiento.
 */
export const StockMovementModel: ModelDefinition = {
  table: 'stock_movements',
  fields: {
    id: { type: 'string', required: true },
    hotelId: { type: 'string', required: true, indexed: true },
    itemId: { type: 'string', required: true, indexed: true },
    // in | out | adjust
    type: { type: 'string', required: true },
    quantity: { type: 'number', required: true },
    unitCost: { type: 'number', default: 0 },        // costo unitario de la entrada (para el promedio)
    reason: { type: 'string' },
    // manual | purchase_receipt | pos_sale
    source: { type: 'string', default: 'manual', indexed: true },
    sourceId: { type: 'string', indexed: true },     // id del origen (receiptItemId / orderLineId)
    balanceAfter: { type: 'number', default: 0 },
  },
  timestamps: true,
}

export function registerInventarioModels(orm: ORM): void {
  orm.define('InventoryItems', InventoryItemModel)
  orm.define('StockMovements', StockMovementModel)
}
