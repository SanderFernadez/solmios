// inventario/usecases/revert-pos-sale.ts — Revierte el stock descontado por una venta POS reembolsada.
// Lee los `out` pos_sale del hotel, filtra los cuya línea pertenece a la orden reembolsada, y crea un
// `in` pos_refund espejo por cada uno (mismo sourceId + quantity + unitCost del out original — la receta
// pudo cambiar post-cobro, NO se recalcula). Idempotente por UNIQUE (hotelId,source,sourceId): un
// reintento choca con el `in` previo (source='pos_refund', mismo sourceId) → no-op.
// Best-effort: el refund del payment ya ocurrió en settlement.ts antes del socket; este usecase NUNCA
// debe romper ese flujo (falla por insumo se traga; un insumo no revertido no revierte el resto).
import type { StockMovementDTO, CurrentUser } from '../types'
import { applyMovement, listMovementsBySource, type MovementDeps } from './movements'

export interface RevertPosSaleInput {
  hotelId: string
  /** ids de líneas de comanda a revertir (solo las no canceladas con menuItemId las manda el conector). */
  lineIds: string[]
}

export async function revertPosSale(deps: MovementDeps, input: RevertPosSaleInput, user: CurrentUser): Promise<void> {
  if (!input.hotelId || !input.lineIds?.length) return
  const lineIdSet = new Set(input.lineIds.map(String))
  const outs = await listMovementsBySource(deps, input.hotelId, 'pos_sale')
  const toRevert = outs.filter((m: StockMovementDTO) => {
    if (m.type !== 'out') return false
    const sid = String(m.sourceId ?? '')
    const colon = sid.indexOf(':')
    if (colon < 0) return false
    return lineIdSet.has(sid.slice(0, colon))
  })
  for (const out of toRevert) {
    try {
      await applyMovement(deps, {
        itemId: out.itemId,
        type: 'in',
        quantity: Number(out.quantity) || 0,
        unitCost: out.unitCost,
        reason: 'Reembolso POS',
        source: 'pos_refund',
        sourceId: out.sourceId,
      }, user)
    } catch { /* best-effort por insumo: una reversión fallida no rompe las demás */ }
  }
}
