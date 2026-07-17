// pricing/usecases/season-assignments.ts — Asignación de temporada por FECHA (diálogo "Asignación de
// temporadas" del planning, estilo MrPlan). A diferencia de Seasons (catálogo con un rango contiguo),
// esto mapea CADA fecha a una temporada del catálogo, y se asigna en lote sobre un rango filtrado por
// día de la semana. Lógica pura sobre el repo `SeasonAssignments`.

import type { RepositoryAdapter } from 'arckode-framework'

export interface SeasonAssignmentRow { id: string; hotelId: string; date: string; season: string }
export interface AssignSeasonInput { from: string; to: string; weekdays?: number[]; season: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MS_PER_DAY = 86_400_000
const MAX_DAYS = 366 * 3   // tope anti-abuso: ~3 años por asignación

/**
 * Fechas (YYYY-MM-DD) en [from, to] INCLUSIVE cuyo día de la semana ∈ weekdays.
 * weekday: 0=Domingo … 6=Sábado (getUTCDay). weekdays vacío/undefined → todos los días.
 */
export function datesInRange(from: string, to: string, weekdays?: number[]): string[] {
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return []
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []
  const set = weekdays && weekdays.length ? new Set(weekdays) : null
  const out: string[] = []
  for (let t = start, i = 0; t <= end && i < MAX_DAYS; t += MS_PER_DAY, i++) {
    const d = new Date(t)
    if (!set || set.has(d.getUTCDay())) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/** Asignaciones del hotel; si se pasa rango [from, to] filtra por él. Ordenadas por fecha. */
export async function listSeasonAssignments(
  repo: RepositoryAdapter<any>, hotelId: string, from?: string, to?: string,
): Promise<SeasonAssignmentRow[]> {
  let rows = (await repo.findMany({ hotelId })) as SeasonAssignmentRow[]
  if (from && to) rows = rows.filter((r) => r.date >= from && r.date <= to)
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Upsert de `season` en cada fecha del rango filtrada por weekday. season vacío ('' / 'none') BORRA la
 * asignación (vuelve a "sin temporada"). Devuelve cuántas fechas se tocaron.
 */
export async function assignSeason(
  repo: RepositoryAdapter<any>, hotelId: string, input: AssignSeasonInput,
): Promise<number> {
  const dates = datesInRange(input.from, input.to, input.weekdays)
  const season = String(input.season || '').trim()
  const clear = season === '' || season === 'none'
  let saved = 0
  for (const date of dates) {
    const existing = ((await repo.findMany({ hotelId, date })) as SeasonAssignmentRow[])[0]
    if (clear) {
      if (existing) { await repo.delete(existing.id); saved++ }
      continue
    }
    if (existing) {
      if (existing.season !== season) await repo.update(existing.id, { season })
    } else {
      await repo.create({ id: crypto.randomUUID(), hotelId, date, season })
    }
    saved++
  }
  return saved
}
