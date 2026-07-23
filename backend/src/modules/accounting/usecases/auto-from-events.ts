// accounting/usecases/auto-from-events.ts — Mapeo evento → asiento automático (CTB-4).
// Toda la lógica de traducción vive acá (NO en los conectores: ellos solo cablean). Cada función
// arma el asiento y lo manda al port de contabilidad, best-effort (un fallo no rompe el módulo
// origen) y self-gating (recordAuto es no-op si el hotel no tiene plan de cuentas). Ver design.md.
import { ACC, cashAccountForMethod, incomeAccountForCategory, expenseAccountForSource } from './account-codes'
import type { RecordAutoInput } from './record-auto'

export interface AccountingPort {
  recordAuto: (hotelId: string, input: RecordAutoInput) => Promise<{ id?: string; skipped?: boolean; deduped?: boolean }>
}

const day = (d?: string) => (d ? String(d).slice(0, 10) : new Date().toISOString().slice(0, 10))
const amt = (v: any) => Math.abs(Number(v || 0))
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Envía el asiento al port, best-effort. Un fallo contable nunca rompe el flujo del dinero. */
async function emit(port: AccountingPort, hotelId: string, input: RecordAutoInput | null): Promise<void> {
  if (!input || !hotelId) return
  try { await port.recordAuto(hotelId, input) } catch { /* best-effort */ }
}

/** Cobro: DR Caja/Bancos (según método) / CR Clientes. */
export async function recordPaymentCompleted(port: AccountingPort, p: any): Promise<void> {
  if (p?.type && p.type !== 'charge') return   // depósitos/reembolsos tienen su propio evento
  const a = amt(p?.amount); if (!a) return
  await emit(port, p.hotelId, {
    entryDate: day(p.processedAt), reference: p.id, referenceType: 'payment',
    description: `Cobro ${p.method || ''} ${p.reference || ''}`.trim(),
    lines: [{ code: cashAccountForMethod(p.method), debit: a }, { code: ACC.CLIENTES, credit: a }],
  })
}

/** Reembolso: DR Clientes / CR Caja/Bancos (revierte el cobro). */
export async function recordRefund(port: AccountingPort, p: any): Promise<void> {
  const a = amt(p?.amount); if (!a) return
  await emit(port, p.hotelId, {
    entryDate: day(p.processedAt), reference: `${p.id}-ref`, referenceType: 'refund',
    description: `Reembolso ${p.method || ''}`.trim(),
    lines: [{ code: ACC.CLIENTES, debit: a }, { code: cashAccountForMethod(p.method), credit: a }],
  })
}

/** Depósito de garantía recibido: DR Bancos / CR Depósitos de Huéspedes (pasivo, no ingreso). */
export async function recordDeposit(port: AccountingPort, d: any): Promise<void> {
  const a = amt(d?.amount); if (!a) return
  await emit(port, d.hotelId, {
    entryDate: day(d.createdAt), reference: d.id, referenceType: 'deposit',
    description: 'Depósito de garantía',
    lines: [{ code: ACC.BANCOS, debit: a }, { code: ACC.DEPOSITOS_HUESPEDES, credit: a }],
  })
}

/** Liberación/devolución del depósito: DR Depósitos de Huéspedes / CR Bancos. */
export async function recordDepositRelease(port: AccountingPort, d: any): Promise<void> {
  const a = amt(d?.refundAmount ?? d?.amount); if (!a) return
  await emit(port, d.hotelId, {
    entryDate: day(d.releasedAt), reference: `${d.id}-rel`, referenceType: 'deposit_release',
    description: 'Liberación de depósito',
    lines: [{ code: ACC.DEPOSITOS_HUESPEDES, debit: a }, { code: ACC.BANCOS, credit: a }],
  })
}

/** Cargo de folio (devengado): DR Clientes (total) / CR Ingresos (neto) [+ CR ITBIS (impuesto)]. */
export async function recordFolioCharge(port: AccountingPort, folio: any, charge: any): Promise<void> {
  if (!charge || charge.kind === 'payment') return   // las líneas de pago no son ingreso
  const tax = Number(charge.taxes || 0)
  const total = Number(charge.total ?? Number(charge.amount || 0) + tax)
  // El neto se DERIVA del total (lo que el huésped debe) menos el impuesto: así el asiento SIEMPRE
  // cuadra aunque el cargo traiga descuento (total ≠ amount+taxes). Antes usaba charge.amount y un
  // total inconsistente descuadraba el asiento → se descartaba en silencio (best-effort).
  const net = Math.round((total - tax + Number.EPSILON) * 100) / 100
  if (total <= 0 || net < 0) return
  const lines: RecordAutoInput['lines'] = [
    { code: ACC.CLIENTES, debit: total },
    { code: incomeAccountForCategory(charge.category), credit: net },
  ]
  if (tax > 0) lines.push({ code: ACC.ITBIS_POR_PAGAR, credit: tax })
  await emit(port, charge.hotelId || folio?.hotelId, {
    entryDate: day(charge.postedAt), reference: charge.id, referenceType: 'folio_charge',
    description: charge.description || 'Cargo de folio', lines,
  })
}

/**
 * Venta directa de restaurante (cobro en mostrador, RES-6): DR Clientes (total) / CR Ventas Restaurante
 * (neto) [+ CR ITBIS] [+ CR Propinas por pagar]. Neteado con el asiento del pago (DR Caja / CR Clientes,
 * que hace payments-accounting) queda DR Caja / CR Ventas + ITBIS + Propinas. SOLO cobro directo: el
 * cargo a habitación ya devenga el ingreso por el folio (folios-accounting), no se dobla.
 */
export async function recordRestaurantSale(port: AccountingPort, order: any): Promise<void> {
  const tax = round2(Number(order?.tax || 0))
  const tip = round2(Number(order?.tip || 0))
  const total = round2(Number(order?.total ?? Number(order?.subtotal || 0) + tax + tip))
  if (total <= 0) return
  // El neto se DERIVA del total (como recordFolioCharge): así el asiento SIEMPRE cuadra aunque a
  // futuro se aplique un descuento al total y no al subtotal. Antes usaba order.subtotal directo, lo
  // que podría descuadrar (y emit lo tragaría → venta perdida del libro en silencio).
  const net = round2(total - tax - tip)
  if (net < 0) return
  const lines: RecordAutoInput['lines'] = [
    { code: ACC.CLIENTES, debit: total },
    { code: ACC.ING_RESTAURANTE, credit: net },
  ]
  if (tax > 0) lines.push({ code: ACC.ITBIS_POR_PAGAR, credit: tax })
  if (tip > 0) lines.push({ code: ACC.PROPINAS_POR_PAGAR, credit: tip })
  await emit(port, order.hotelId, {
    entryDate: day(order.closedAt), reference: order.id, referenceType: 'restaurant_sale',
    description: `Venta restaurante ${order.number || ''}`.trim(), lines,
  })
}

/** Gasto: DR Gasto (por origen) / CR Caja|Bancos (pagado) o Cuentas por Pagar (a crédito). */
export async function recordExpense(port: AccountingPort, e: any): Promise<void> {
  const a = Number(e?.amount || 0); if (a <= 0) return
  await emit(port, e.hotelId, {
    entryDate: day(e.date), reference: e.id, referenceType: 'expense',
    description: e.concept || 'Gasto',
    lines: [
      { code: expenseAccountForSource(e.source), debit: a },
      { code: e.paid ? cashAccountForMethod(e.paymentMethod) : ACC.AP, credit: a },
    ],
  })
}
