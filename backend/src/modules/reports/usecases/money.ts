// reports/usecases/money.ts — Lectura del dinero para los reportes. Funciones puras.
//
// Los reportes mezclan DOS magnitudes que no son la misma y nunca hay que sumar entre sí:
//
//   facturado (devengado) → lo que el hotel tiene derecho a cobrar. Sale de reservas + consumos.
//   ingresado (cobrado)   → lo que efectivamente entró. Sale de `payments`, la fuente de verdad.
//
// La brecha entre las dos es la cuenta por cobrar. Antes solo se reportaba la primera, así que los
// reportes nunca cuadraban contra caja ni contra la conciliación bancaria.

const day = (value?: string): string => (value || '').slice(0, 10)

/** Acota filas a un rango [from, to] inclusivo por día, tolerando timestamps con hora. */
export function inDateRange<T>(rows: T[], from: string, to: string, dateOf: (row: T) => string | undefined): T[] {
  const start = day(from)
  const end = day(to)
  return rows.filter((row) => {
    const d = day(dateOf(row))
    return !!d && d >= start && d <= end
  })
}

/** Fecha en que el dinero se movió de verdad; `processedAt` solo existe si el pago se completó. */
export const paymentDate = (payment: any): string | undefined => payment?.processedAt || payment?.createdAt

/** Un gasto se imputa a la fecha en que ocurrió, no a la de carga en el sistema. */
export const expenseDate = (expense: any): string | undefined => expense?.date || expense?.createdAt

/**
 * Dinero efectivamente cobrado: cargos completados menos devoluciones completadas.
 *
 * `deposit` y `withdrawal` quedan afuera a propósito: un depósito en garantía es plata retenida que
 * todavía es del huésped, no un ingreso del hotel. Contarlo infla los ingresos y después descuadra
 * cuando se devuelve.
 */
export function sumCollected(payments: any[]): number {
  return payments.reduce((total: number, p: any) => {
    if (p.status !== 'completed') return total
    // `Math.abs`: una devolución se guarda a veces con monto negativo. Sin esto, restar el crudo la
    // sumaría, y `sumCharged - sumRefunded` dejaría de dar `sumCollected`.
    if (p.type === 'refund') return total - Math.abs(Number(p.amount || 0))
    if (p.type === 'charge') return total + Number(p.amount || 0)
    return total
  }, 0)
}

/** Cobrado neto por método de pago. Un reembolso descuenta del método por el que se cobró. */
export function collectedByMethod(payments: any[]): Record<string, number> {
  const byMethod: Record<string, number> = {}
  for (const p of payments) {
    if (p.status !== 'completed') continue
    const method = p.method || 'other'
    if (p.type === 'charge') byMethod[method] = (byMethod[method] || 0) + Number(p.amount || 0)
    else if (p.type === 'refund') byMethod[method] = (byMethod[method] || 0) - Math.abs(Number(p.amount || 0))
  }
  return byMethod
}

/** Un gasto solo sale de la plata cuando está pagado. `paid` es 0/1. */
export const isPaid = (expense: any): boolean => Number(expense?.paid) === 1

export function sumByCategory(expenses: any[]): Record<string, number> {
  return expenses.reduce((acc: Record<string, number>, e: any) => {
    const category = e.category || 'general'
    acc[category] = (acc[category] || 0) + Number(e.amount || 0)
    return acc
  }, {})
}

/**
 * Cobros brutos del período, sin restar devoluciones. Para vistas que muestran "pagos recibidos" y
 * "reembolsos" como líneas separadas: usar el neto ahí restaría las devoluciones dos veces.
 */
export function sumCharged(payments: any[]): number {
  return payments
    .filter((p: any) => p.status === 'completed' && p.type === 'charge')
    .reduce((total: number, p: any) => total + Number(p.amount || 0), 0)
}

/** Total devuelto en el período, como número positivo. */
export function sumRefunded(payments: any[]): number {
  return payments
    .filter((p: any) => p.status === 'completed' && p.type === 'refund')
    .reduce((total: number, p: any) => total + Math.abs(Number(p.amount || 0)), 0)
}

export function sumExpenses(expenses: any[]): number {
  return expenses.reduce((total: number, e: any) => total + Number(e.amount || 0), 0)
}

/** Importe de una línea de folio. `kind: 'payment'` no es consumo: es el pago que baja el saldo. */
export const chargeTotal = (charge: any): number => Number(charge.amount || 0) * Number(charge.quantity || 1)

export const isConsumption = (charge: any): boolean => charge?.kind !== 'payment'
