// pricing/usecases/date-restrictions.ts — Estadía mínima por FECHA (fila "Días Mínimos" del planning).
// Lógica pura sobre el repo `DateRestrictions`. Regla: default = 1 noche. Solo se guardan overrides
// (minStay > 1); poner una fecha de vuelta en 1 borra su fila (no ensucia la tabla con defaults).

import type { RepositoryAdapter } from 'arckode-framework'

export interface DateRestrictionRow { id: string; hotelId: string; date: string; minStay: number }
export interface DateRestrictionInput { date: string; minStay: number }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Normaliza un minStay a entero >= 1. */
export function normalizeMinStay(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 1 ? n : 1
}

/** Lista los overrides del hotel; si se pasa rango [from, to] (YYYY-MM-DD) filtra por él. */
export async function listDateRestrictions(
  repo: RepositoryAdapter<any>, hotelId: string, from?: string, to?: string,
): Promise<DateRestrictionRow[]> {
  let rows = (await repo.findMany({ hotelId })) as DateRestrictionRow[]
  if (from && to) rows = rows.filter((r) => r.date >= from && r.date <= to)
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/** Upsert de overrides. minStay <= 1 borra la fila (vuelve al default). Devuelve cuántas filas cambió. */
export async function upsertDateRestrictions(
  repo: RepositoryAdapter<any>, hotelId: string, items: DateRestrictionInput[],
): Promise<number> {
  let saved = 0
  for (const it of items || []) {
    const date = String(it?.date || '').slice(0, 10)
    if (!DATE_RE.test(date)) continue
    const minStay = normalizeMinStay(it?.minStay)
    const existing = ((await repo.findMany({ hotelId, date })) as DateRestrictionRow[])[0]
    if (minStay <= 1) {
      if (existing) { await repo.delete(existing.id); saved++ }
      continue
    }
    if (existing) await repo.update(existing.id, { minStay })
    else await repo.create({ id: crypto.randomUUID(), hotelId, date, minStay })
    saved++
  }
  return saved
}

/** minStay que aplica a una fecha de check-in (default 1 si no hay override). */
export async function minStayForDate(
  repo: RepositoryAdapter<any>, hotelId: string, date: string,
): Promise<number> {
  const row = ((await repo.findMany({ hotelId, date })) as DateRestrictionRow[])[0]
  return row ? normalizeMinStay(row.minStay) : 1
}
