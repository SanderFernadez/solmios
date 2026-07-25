// connectors/caja-chica-gastos.ts — Conector gastos→caja-chica.
// Un gasto con `pettyCashFundId` sale del fondo fijo: descuenta `fund.currentBalance` al crear
// y revierte al borrar (simétrico a gastos-caja). El gasto vive en `expenses` (no se fuga del
// AP ni de la contabilidad) — solo marcando su origen con pettyCashFundId.
//
// El conector SOLO wirea: extrae del DTO y delega al service de caja-chica. El dedup por
// expenseId, la reversión y el manejo de saldo viven en el service (es dueño del currentBalance).
//
// Best-effort: si caja-chica no resuelve, no falla el módulo gastos. La fuente de verdad del
// gasto es `expenses`; el saldo del fondo es un registro derivado.

import type { ConnectorContext } from 'arckode-framework'
import type { GastosDTO } from '../modules/gastos'

interface CajaChicaModule {
  applyExpenseOutflow: (p: { expenseId: string; fundId?: string; amount: number }) => Promise<void>
  revertExpenseOutflow: (expenseId: string) => Promise<void>
}

export function cajaChicaGastosConnector(ctx: ConnectorContext): void {
  const gastos = ctx.resolveModule<{ setSockets: (s: any) => void }>('gastos')

  // Al crear/editar: pasa el DTO al service. El service decide: si tiene fundId descuenta (dedup
  // por expenseId, maneja cambios de fundId/monto); si NO tiene fundId y había descuento, revierte.
  const sync = async (gasto: GastosDTO): Promise<void> => {
    try {
      const caja = ctx.resolveModule<CajaChicaModule>('caja-chica')
      await caja.applyExpenseOutflow({
        expenseId: gasto.id,
        fundId: (gasto as any).pettyCashFundId as string | undefined,
        amount: Number(gasto.amount),
      })
    } catch {
      // Conector best-effort: no falla el módulo principal si caja-chica no resuelve.
    }
  }

  gastos.setSockets({
    onGastosCreated: sync,
    onGastosUpdated: sync,
    onGastosDeleted: async (id: string) => {
      try {
        const caja = ctx.resolveModule<CajaChicaModule>('caja-chica')
        // El service trackea qué aplicó por expenseId; acá solo pedimos revertir.
        await caja.revertExpenseOutflow(id)
      } catch {
        // Best-effort, igual que arriba.
      }
    },
  })
}
