// connectors/restaurante-accounting.ts — POS → contabilidad (RES-6). SOLO cablea: la lógica evento→asiento
// vive en accounting/usecases/auto-from-events. Reconoce el ingreso "Ventas Restaurante" de una venta
// DIRECTA (onOrderPaid). El cargo a habitación NO se cablea: su ingreso ya lo devenga folios-accounting
// por el folio_charge (category 'restaurant') → si lo asentáramos acá también, se doblaría.
//
// ⚠️ PRECONDICIÓN DE DEPLOY (QA MEDIO): recordRestaurantSale usa las cuentas 4.2.02 (Ventas Restaurante)
// y 2.1.05 (Propinas por Pagar). Un hotel que sembró el plan ANTES de RES-6 NO las tiene → el asiento de
// venta se auto-saltea (self-gating), PERO el asiento del PAGO (Caja/Clientes) sí postea → Clientes queda
// con un crédito huérfano. Antes de habilitar la contabilidad del POS en un hotel existente: RE-SEED del
// plan (POST /api/accounting/seed, idempotente, agrega solo las cuentas faltantes). Ver RES-8.
import type { ConnectorContext } from 'arckode-framework'
import { recordRestaurantSale, type AccountingPort } from '../modules/accounting'

export function restauranteAccountingConnector(ctx: ConnectorContext): void {
  const restaurant = ctx.resolveModule<{ setSockets: (s: any) => void }>('restaurant')
  const acc = () => ctx.resolveModule<AccountingPort>('accounting')

  restaurant.setSockets({
    onOrderPaid: (order: any) => recordRestaurantSale(acc(), order),
    // onOrderCharged (cargo a folio): intencionalmente NO cableado — folios-accounting ya devenga
    // ese ingreso por el folio_charge. Cablearlo acá = doble conteo.
  })
}
