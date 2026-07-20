// folios/usecases/folio-math.ts — Matemática de folios (totales, balance, impuestos).
// Puramente funcional, sin ORM ni HTTP. Recibe RepositoryAdapter del dominio.

import type { RepositoryAdapter } from 'arckode-framework'
import type { FolioChargeDTO } from '../types'

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Tasa de impuesto del hotel. Copia hermana de facturas/usecases/billing.ts:taxRateFor — mismo
 * fallback y mismo motivo: `configuration(key='taxes')` nunca lo escribe ninguna pantalla, así
 * que sin el fallback a `hotels.taxRate` (lo que Configuración → Impuestos SÍ guarda) cada cargo
 * de folio se posteaba sin impuesto, y el balance que veía el huésped durante la estadía no
 * coincidía con lo que terminaba saliendo en la factura.
 *
 * `hotelsRepo` opcional para no romper los tests que instancian esto solo con el config repo.
 */
export async function taxRateFor(
  cfg: RepositoryAdapter<any>,
  hotelId: string,
  hotelsRepo?: RepositoryAdapter<any>,
): Promise<number> {
  try {
    let c = await cfg.findOne({ hotelId, key: 'taxes' })
    if (!c) c = await cfg.findOne({ hotelId, key: 'impuestos' })
    const arr: any[] = c?.value ?? []
    const configured = arr.filter((t) => t && (t.activo ?? t.active)).reduce((s, t) => s + Number(t.tasa ?? t.rate ?? 0), 0)
    if (configured > 0) return configured
  } catch { /* cae al fallback */ }

  if (!hotelsRepo) return 0
  try {
    // @ignore IDOR_RISK — `hotelId` no llega del cliente: es el hotelId propio del folio que el
    // llamador ya validó contra el usuario (assertOwnership aguas arriba). Acá solo se relee ESE
    // MISMO hotel para su tasa de impuesto, no un id elegido por quien llama.
    const hotel = await hotelsRepo.findById(hotelId)
    return Number((hotel as any)?.taxRate) || 0
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
