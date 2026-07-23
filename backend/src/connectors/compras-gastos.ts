// connectors/compras-gastos.ts — Compras → Gastos (COM-4). SOLO cablea: al facturar una OC, crea UN
// gasto (source='purchase_order', sourceId=orderId). Ese gasto ya pega en caja (gastos-caja) y en
// contabilidad (gastos-accounting) por los conectores existentes. El módulo compras NO importa gastos.
// La dedup (1 gasto por OC) la garantiza `markInvoiced` (no crea si la OC ya tiene expenseId).
import type { ConnectorContext } from 'arckode-framework'

interface GastosModule {
  create: (dto: any, user: any) => Promise<{ id: string }>
}

export function comprasGastosConnector(ctx: ConnectorContext): void {
  const compras = ctx.resolveModule<{ setPorts: (p: any) => void }>('compras')
  const gastos = () => ctx.resolveModule<GastosModule>('gastos')

  compras.setPorts({
    createExpenseFromPO: async (input: { orderId: string; supplierId?: string; amount: number; invoiceNumber?: string; currency?: string }, user: any) => {
      const expense = await gastos().create({
        concept: `Compra · orden ${input.orderId}`,
        amount: input.amount,
        category: 'purchases',
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        source: 'purchase_order',
        sourceId: input.orderId,
        date: new Date().toISOString(),
      }, user)
      return { expenseId: expense.id }
    },
  })
}
