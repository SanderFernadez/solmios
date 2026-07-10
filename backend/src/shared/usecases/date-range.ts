// shared/usecases/date-range.ts — Rangos de fecha sobre un ORM que no tiene operadores.
//
// El WHERE del framework sólo sabe igualdad: `buildWhere` (kernel/db/orm-utils.ts) emite `campo = ?`
// por cada filtro y empuja el valor crudo al bind. Un `{ $gte: x }` llega como objeto al driver y
// revienta con `TypeError: Binding expected string, TypedArray, boolean, number, bigint or null`.
//
// No es un caso hipotético: así estuvo roto `GET /api/attendance/report` (500 en cada llamada) y el
// listado de huéspedes por segmento del CRM. Los tests no lo veían porque sus repos mock ignoran
// los filtros que reciben.
//
// La regla: al WHERE sólo va igualdad. Los rangos se acotan acá, en memoria.

/** Un timestamp ISO y una fecha `YYYY-MM-DD` comparan igual si se recortan al día. */
export const toDay = (iso: string): string => (iso || '').slice(0, 10)

/**
 * Filtra por rango de fechas inclusivo en ambos extremos.
 *
 * Compara por día, no por instante: sin esto, un `to` de `2026-07-10` dejaba afuera todo lo
 * ocurrido ese mismo día a partir de las 00:00:01.
 */
export function inDateRange<T>(rows: T[], field: keyof T, from?: string, to?: string): T[] {
  if (!from && !to) return rows
  const gte = from ? toDay(from) : undefined
  const lte = to ? toDay(to) : undefined
  return rows.filter((row) => {
    const day = toDay(String(row[field] ?? ''))
    if (!day) return false
    return (!gte || day >= gte) && (!lte || day <= lte)
  })
}

/**
 * Descarta del objeto de filtros cualquier valor que el ORM no sepa bindear (objetos: `{$gte}`,
 * `{increment}`, etc.). Red de seguridad para filtros armados dinámicamente.
 */
export function equalityOnly(filters: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && typeof value === 'object') continue
    if (value === undefined) continue
    safe[key] = value
  }
  return safe
}
