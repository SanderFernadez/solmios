// connectors/compras-treasury.ts — Compras → Treasury (COM-2). SOLO cablea: valida que el proveedor de
// una orden de compra exista en el catálogo treasury.suppliers. El módulo compras NO importa treasury.
import type { ConnectorContext } from 'arckode-framework'

interface TreasuryModule {
  listSuppliers: (user: any) => Promise<{ data?: any[] }>
}

export function comprasTreasuryConnector(ctx: ConnectorContext): void {
  const compras = ctx.resolveModule<{ setPorts: (p: any) => void }>('compras')
  const treasury = () => ctx.resolveModule<TreasuryModule>('treasury')

  compras.setPorts({
    supplierExists: async (supplierId: string, hotelId: string) => {
      try {
        // listSuppliers filtra server-side por el hotel del token; acá validamos por hotelId + id.
        const res = await treasury().listSuppliers({ id: 'system', hotelId, role: 'super_admin' } as any)
        return !!(res?.data ?? []).find((s: any) => s.id === supplierId && s.hotelId === hotelId)
      } catch {
        // Si treasury no está disponible, no bloqueamos la creación de la OC (best-effort).
        return true
      }
    },
  })
}
