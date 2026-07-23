// connectors/restaurante-inventario.ts — POS → Inventario (INT-1). SOLO cablea: al liquidar una comanda
// (cobro directo `onOrderPaid` o cargo a habitación `onOrderCharged`), descuenta del stock los insumos
// según la receta de cada ítem vendido. Best-effort: un descuento de stock NUNCA rompe el cobro.
// Idempotente por línea (el ledger dedup por source='pos_sale', sourceId incluye el lineId).
// Usa un super_admin sintético: el hotelId viene de la comanda (contexto de sistema, sin request user).
import type { ConnectorContext } from 'arckode-framework'

interface RestaurantModule {
  getOrder: (id: string, user: any) => Promise<{ hotelId: string; lines?: any[] } | any>
}
interface InventarioModule {
  consumeForSale: (input: { hotelId: string; menuItemId: string; soldQty: number; lineId: string }, user: any) => Promise<void>
}

export function restauranteInventarioConnector(ctx: ConnectorContext): void {
  const restaurant = ctx.resolveModule<{ setSockets: (s: any) => void } & RestaurantModule>('restaurant')
  const inventario = () => ctx.resolveModule<InventarioModule>('inventario')

  async function consumeOrder(order: any): Promise<void> {
    try {
      const sys = { id: 'system', hotelId: order.hotelId, role: 'super_admin' }
      const full = await restaurant.getOrder(order.id, sys)
      const lines = (full?.lines ?? []) as any[]
      const inv = inventario()
      for (const l of lines) {
        if (!l.menuItemId || l.status === 'cancelled') continue
        await inv.consumeForSale({ hotelId: order.hotelId, menuItemId: l.menuItemId, soldQty: Number(l.quantity) || 0, lineId: l.id }, sys)
      }
    } catch { /* best-effort: no rompe la liquidación de la comanda */ }
  }

  restaurant.setSockets({
    onOrderPaid: (order: any) => consumeOrder(order),
    onOrderCharged: (order: any) => consumeOrder(order),
  })
}
