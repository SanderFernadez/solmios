// connectors/compras-inventario.ts — Compras → Inventario (COM-3). SOLO cablea: al recibir mercancía,
// suma el stock al insumo vía el ledger idempotente del inventario (source='purchase_receipt',
// sourceId=receiptItemId). El módulo compras NO importa inventario; le inyecta este puerto.
import type { ConnectorContext } from 'arckode-framework'

interface InventarioModule {
  applyExternalMovement: (input: { itemId: string; type: 'in' | 'out' | 'adjust'; quantity: number; unitCost?: number; reason?: string; source?: string; sourceId?: string }, user: any) => Promise<unknown>
}

export function comprasInventarioConnector(ctx: ConnectorContext): void {
  const compras = ctx.resolveModule<{ setPorts: (p: any) => void }>('compras')
  const inventario = () => ctx.resolveModule<InventarioModule>('inventario')

  compras.setPorts({
    addStock: async (input: { itemId: string; quantity: number; unitCost: number; sourceId: string }, user: any) => {
      await inventario().applyExternalMovement({
        itemId: input.itemId, type: 'in', quantity: input.quantity, unitCost: input.unitCost,
        reason: 'Recepción de compra', source: 'purchase_receipt', sourceId: input.sourceId,
      }, user)
    },
  })
}
