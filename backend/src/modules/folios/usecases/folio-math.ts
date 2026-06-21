// folios/usecases/folio-math.ts — Matemática de folios (totales, balance, impuestos).
// Puramente funcional, sin ORM ni HTTP. Recibe RepositoryAdapter del dominio.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FolioChargeDTO } from '../types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Suma las tasas activas de la config fiscal del hotel (key 'taxes' o 'impuestos'). */
export async function taxRateFor(cfg: RepositoryAdapter<any>, hotelId: string): Promise<number> {
  try {
    let c = await cfg.findOne({ hotelId, key: 'taxes' })
    if (!c) c = await cfg.findOne({ hotelId, key: 'impuestos' })
    const arr: any[] = c?.value ?? []
    return arr.filter((t) => t && (t.activo ?? t.active)).reduce((s, t) => s + Number(t.tasa ?? t.rate ?? 0), 0) || 0
  } catch {
    return 0
  }
}

/** base = subtotal (neto) → { tax, total }. */
export function applyTax(base: number, rate: number): { tax: number; total: number } {
  const tax = round2((base * rate) / 100)
  return { tax, total: round2(base + tax) }
}

/** Totales de un folio a partir de sus líneas. Los pagos (kind='payment') son total negativo. */
export function computeTotals(charges: FolioChargeDTO[]) {
  const cargos = charges.filter((c) => c.kind === 'charge')
  const pagos = charges.filter((c) => c.kind === 'payment')
  const chargesTotal = round2(cargos.reduce((s, c) => s + Number(c.total || 0), 0))
  const paymentsTotal = round2(pagos.reduce((s, c) => s + Math.abs(Number(c.total || 0)), 0))
  return {
    chargesTotal,
    paymentsTotal,
    balance: round2(chargesTotal - paymentsTotal),
    chargeCount: charges.length,
  }
}
