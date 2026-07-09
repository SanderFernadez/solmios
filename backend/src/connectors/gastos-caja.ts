// connectors/gastos-caja.ts — Conector gastos→caja.
// Un gasto pagado en efectivo saca plata del cajón físico, así que el arqueo del turno tiene que
// verlo. Antes los egresos vivían en dos silos sin cruzar: `expenses` y `cash_movements`.
//
// Solo el efectivo mueve la caja (simétrico a payments-caja): tarjeta y transferencia ya están
// bancarizadas. Un gasto impago (`paid = 0`) todavía no sacó plata de ningún lado.
//
// Reacciona a create Y update porque un gasto se edita: cambiar el método de `cash` a `transfer`,
// o marcarlo impago, tiene que REVERTIR el egreso. Dedup e idempotencia por `expenseId`.
//
// Best-effort: si caja no resuelve, no falla el módulo gastos. La caja es un registro derivado;
// la fuente de verdad del gasto es la tabla `expenses`.

import type { ConnectorContext } from 'arckode-framework'
import type { GastosDTO } from '../modules/gastos'

interface CajaModule {
  registerExpenseOutflow: (i: {
    hotelId: string; expenseId: string; amount: number
    concept?: string; category?: string; reference?: string
  }) => Promise<unknown>
  removeExpenseOutflow: (expenseId: string) => Promise<boolean>
}

/** Un gasto mueve el cajón solo si ya se pagó Y se pagó en efectivo. */
export function movesCash(gasto: GastosDTO): boolean {
  return Number(gasto.paid) === 1 && gasto.paymentMethod === 'cash'
}

export function gastosCajaConnector(ctx: ConnectorContext): void {
  const gastos = ctx.resolveModule<{ setSockets: (s: any) => void }>('gastos')

  const sync = async (gasto: GastosDTO): Promise<void> => {
    try {
      const caja = ctx.resolveModule<CajaModule>('caja')
      if (movesCash(gasto)) {
        await caja.registerExpenseOutflow({
          hotelId: gasto.hotelId,
          expenseId: gasto.id,
          amount: Number(gasto.amount),
          concept: gasto.concept,
          category: gasto.category,
          reference: gasto.invoiceNumber,
        })
      } else {
        // Dejó de ser un egreso de efectivo (método cambiado, o marcado impago).
        await caja.removeExpenseOutflow(gasto.id)
      }
    } catch {
      // Conector best-effort: no falla el módulo principal si caja no resuelve.
    }
  }

  gastos.setSockets({
    onGastosCreated: sync,
    onGastosUpdated: sync,
    onGastosDeleted: async (id: string) => {
      try {
        const caja = ctx.resolveModule<CajaModule>('caja')
        await caja.removeExpenseOutflow(id)
      } catch {
        // Best-effort, igual que arriba.
      }
    },
  })
}
